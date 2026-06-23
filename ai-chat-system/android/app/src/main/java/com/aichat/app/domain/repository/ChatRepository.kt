package com.aichat.app.domain.repository

import com.aichat.app.domain.model.AiModel
import com.aichat.app.domain.model.ChatMessage
import com.aichat.app.domain.model.ChatSession
import com.aichat.app.domain.model.StreamEvent
import kotlinx.coroutines.flow.Flow

/**
 * Repository abstraction. The ViewModel depends ONLY on this interface,
 * never on Retrofit/OkHttp/Room directly (clean architecture boundary).
 */
interface ChatRepository {

    // --- sessions ---
    fun observeSessions(): Flow<List<ChatSession>>
    suspend fun createSession(model: AiModel): ChatSession
    suspend fun deleteSession(chatId: String)
    suspend fun renameSession(chatId: String, title: String)
    suspend fun setModel(chatId: String, model: AiModel)

    // --- messages ---
    fun observeMessages(chatId: String): Flow<List<ChatMessage>>
    suspend fun upsertMessage(message: ChatMessage)
    suspend fun deleteMessage(messageId: String)

    /**
     * Streams a completion as normalized [StreamEvent]s.
     * The flow:
     *  - emits StreamEvent.Error (never throws) on network failure
     *  - retries ONCE on transient failure
     *  - falls back to a non-streaming response if streaming fails twice
     * Cancellation is honored cooperatively (collector cancels the Job).
     */
    fun streamChat(
        chatId: String,
        history: List<ChatMessage>,
        model: AiModel,
    ): Flow<StreamEvent>

    /** Cheap auto-title generation from the first user message. */
    suspend fun generateTitle(history: List<ChatMessage>): String
}
