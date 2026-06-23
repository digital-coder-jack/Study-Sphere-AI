package com.aichat.app.data.repository

import com.aichat.app.BuildConfig
import com.aichat.app.data.local.MessageDao
import com.aichat.app.data.local.SessionDao
import com.aichat.app.data.model.toDomain
import com.aichat.app.data.model.toDto
import com.aichat.app.data.model.toEntity
import com.aichat.app.data.remote.ApiService
import com.aichat.app.data.remote.ChatRequestDto
import com.aichat.app.data.remote.TitleRequestDto
import com.aichat.app.domain.model.AiModel
import com.aichat.app.domain.model.ChatMessage
import com.aichat.app.domain.model.ChatSession
import com.aichat.app.domain.model.StreamEvent
import com.aichat.app.domain.repository.ChatRepository
import com.aichat.app.stream.StreamClient
import com.squareup.moshi.Moshi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ChatRepositoryImpl @Inject constructor(
    private val sessionDao: SessionDao,
    private val messageDao: MessageDao,
    private val api: ApiService,
    private val streamClient: StreamClient,
    moshi: Moshi,
) : ChatRepository {

    private val requestAdapter = moshi.adapter(ChatRequestDto::class.java)
    private val baseUrl = BuildConfig.GATEWAY_BASE_URL
    private val apiKey = BuildConfig.GATEWAY_API_KEY

    // ---------------- sessions ----------------
    override fun observeSessions(): Flow<List<ChatSession>> =
        sessionDao.observeAll().map { list -> list.map { it.toDomain() } }

    override suspend fun createSession(model: AiModel): ChatSession {
        val session = ChatSession(model = model)
        sessionDao.upsert(session.toEntity())
        return session
    }

    override suspend fun deleteSession(chatId: String) {
        messageDao.deleteForChat(chatId)
        sessionDao.delete(chatId)
    }

    override suspend fun renameSession(chatId: String, title: String) =
        sessionDao.rename(chatId, title, System.currentTimeMillis())

    override suspend fun setModel(chatId: String, model: AiModel) =
        sessionDao.setModel(chatId, model.id, System.currentTimeMillis())

    // ---------------- messages ----------------
    override fun observeMessages(chatId: String): Flow<List<ChatMessage>> =
        messageDao.observeForChat(chatId).map { list -> list.map { it.toDomain() } }

    override suspend fun upsertMessage(message: ChatMessage) =
        messageDao.upsert(message.toEntity())

    override suspend fun deleteMessage(messageId: String) =
        messageDao.delete(messageId)

    // ---------------- streaming ----------------
    /**
     * Streaming with the critical stability guarantees:
     *  - retry ONCE on a fatal transport error
     *  - if streaming yields no tokens twice -> non-streaming fallback
     *  - never throws into the collector (errors surface as StreamEvent.Error)
     */
    override fun streamChat(
        chatId: String,
        history: List<ChatMessage>,
        model: AiModel,
    ): Flow<StreamEvent> = flow {
        val body = requestAdapter.toJson(
            ChatRequestDto(
                model = model.id,
                messages = history.map { it.toDto() },
                stream = true,
                chatId = chatId,
            )
        )
        val url = baseUrl.trimEnd('/') + "/v1/chat/completions"

        var attempt = 0
        var producedToken = false
        var lastFatal: StreamEvent.Error? = null

        while (attempt < 2) {
            attempt++
            var sawFatal = false
            // Collect one full stream attempt.
            streamClient.stream(url, apiKey, body).collect { ev ->
                when (ev) {
                    is StreamEvent.Token -> { producedToken = true; emit(ev) }
                    is StreamEvent.Error -> {
                        if (ev.fatal) { sawFatal = true; lastFatal = ev } else emit(ev)
                    }
                    else -> emit(ev) // Start / Done
                }
            }
            if (producedToken || !sawFatal) {
                // Success (got tokens) or a clean finish without fatal error.
                if (producedToken) return@flow
                if (!sawFatal) return@flow
            }
            // else: fatal with no tokens -> retry once (loop), then fallback
        }

        // Both streaming attempts failed -> non-streaming fallback.
        try {
            val resp = api.complete(
                ChatRequestDto(
                    model = model.id,
                    messages = history.map { it.toDto() },
                    stream = false,
                    chatId = chatId,
                )
            )
            val text = resp.choices.firstOrNull()?.message?.content
            if (!text.isNullOrEmpty()) {
                emit(StreamEvent.Token(text))
                emit(StreamEvent.Done("fallback"))
                return@flow
            }
            emit(lastFatal ?: StreamEvent.Error("Empty response", true))
        } catch (e: Exception) {
            emit(StreamEvent.Error(e.message ?: "Network error", true))
        }
    }

    override suspend fun generateTitle(history: List<ChatMessage>): String =
        try {
            api.title(TitleRequestDto(history.map { it.toDto() })).title
        } catch (_: Exception) {
            history.firstOrNull { it.role.name == "USER" }
                ?.content?.split(" ")?.take(6)?.joinToString(" ")?.take(48)
                ?: "New chat"
        }
}
