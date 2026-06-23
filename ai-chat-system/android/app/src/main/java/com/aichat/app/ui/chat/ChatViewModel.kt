package com.aichat.app.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aichat.app.domain.model.AiModel
import com.aichat.app.domain.model.ChatMessage
import com.aichat.app.domain.model.Role
import com.aichat.app.domain.model.StreamEvent
import com.aichat.app.domain.repository.ChatRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * ViewModel holds STATE ONLY. All IO is delegated to the repository.
 *
 * Streaming concurrency model (the critical rules):
 *  - A SINGLE [streamingJob] reference is kept.
 *  - sendMessage()/regenerate() ALWAYS cancel the previous job first
 *    (cancelAndJoin) before starting a new one -> only one active stream.
 *  - State is mutated exclusively through _uiState.update { } (atomic) so
 *    concurrent emissions can never interleave into a torn state.
 *  - ensureActive() inside the collect loop makes cancellation cooperative:
 *    a cancelled stream stops mutating state immediately.
 */
@HiltViewModel
class ChatViewModel @Inject constructor(
    private val repo: ChatRepository,
    private val mainDispatcher: CoroutineDispatcher = Dispatchers.Main.immediate,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    /** The one and only active streaming job. */
    private var streamingJob: Job? = null
    private var messagesObserver: Job? = null

    // ---------------- session lifecycle ----------------
    fun openChat(chatId: String, model: AiModel) {
        _uiState.update { it.copy(chatId = chatId, model = model) }
        observeMessages(chatId)
    }

    private fun observeMessages(chatId: String) {
        messagesObserver?.cancel()
        messagesObserver = repo.observeMessages(chatId)
            .onEach { persisted ->
                // Only adopt persisted history when NOT actively streaming, so we
                // never clobber the in-flight assistant bubble with DB snapshots.
                _uiState.update { state ->
                    if (state.isStreaming) state else state.copy(messages = persisted)
                }
            }
            .launchIn(viewModelScope)
    }

    fun onInputChange(text: String) = _uiState.update { it.copy(input = text) }

    fun selectModel(model: AiModel) {
        _uiState.update { it.copy(model = model) }
        _uiState.value.chatId?.let { id ->
            viewModelScope.launch { repo.setModel(id, model) }
        }
    }

    fun dismissError() = _uiState.update { it.copy(errorBanner = null) }

    // ---------------- send ----------------
    fun sendMessage() {
        val state = _uiState.value
        val text = state.input.trim()
        val chatId = state.chatId ?: return
        if (text.isEmpty() || state.isStreaming) return

        val userMsg = ChatMessage(chatId = chatId, role = Role.USER, content = text)
        startAssistantStream(
            chatId = chatId,
            newUserMessage = userMsg,
            clearInput = true,
        )
    }

    /** Regenerate: drop the last assistant message and re-stream from the same history. */
    fun regenerate() {
        val state = _uiState.value
        val chatId = state.chatId ?: return
        if (state.isStreaming) return
        val withoutLastAssistant = state.messages
            .toMutableList()
            .also { list -> list.indexOfLast { it.role == Role.ASSISTANT }.let { if (it >= 0) list.removeAt(it) } }
        _uiState.update { it.copy(messages = withoutLastAssistant) }
        startAssistantStream(chatId = chatId, newUserMessage = null, clearInput = false)
    }

    fun editUserMessage(messageId: String, newText: String) {
        val state = _uiState.value
        val chatId = state.chatId ?: return
        // Truncate history after the edited message, replace its text, then re-stream.
        val idx = state.messages.indexOfFirst { it.id == messageId }
        if (idx < 0) return
        val edited = state.messages[idx].copy(content = newText)
        val truncated = state.messages.subList(0, idx).toMutableList().apply { add(edited) }
        _uiState.update { it.copy(messages = truncated) }
        viewModelScope.launch {
            repo.upsertMessage(edited)
            state.messages.drop(idx + 1).forEach { repo.deleteMessage(it.id) }
        }
        startAssistantStream(chatId = chatId, newUserMessage = null, clearInput = false)
    }

    fun deleteMessage(messageId: String) {
        _uiState.update { it.copy(messages = it.messages.filterNot { m -> m.id == messageId }) }
        viewModelScope.launch { repo.deleteMessage(messageId) }
    }

    fun stopStreaming() {
        viewModelScope.launch {
            streamingJob?.cancelAndJoin()
            _uiState.update { it.copy(isStreaming = false, streamingMessageId = null) }
        }
    }

    // ---------------- core streaming routine ----------------
    private fun startAssistantStream(
        chatId: String,
        newUserMessage: ChatMessage?,
        clearInput: Boolean,
    ) {
        viewModelScope.launch {
            // RULE: cancel the previous stream and WAIT for it to fully stop
            // before mutating state for the new one. This eliminates the race
            // where a stale collector writes into the new assistant bubble.
            streamingJob?.cancelAndJoin()

            val assistant = ChatMessage(
                chatId = chatId, role = Role.ASSISTANT, content = "", streaming = true,
            )

            // Atomic state setup: add user msg (if any) + the single assistant placeholder.
            _uiState.update { s ->
                val msgs = s.messages.toMutableList()
                newUserMessage?.let { msgs.add(it) }
                msgs.add(assistant)
                s.copy(
                    messages = msgs,
                    streamingMessageId = assistant.id, // RULE: token target locked here
                    isStreaming = true,
                    input = if (clearInput) "" else s.input,
                    errorBanner = null,
                )
            }

            newUserMessage?.let { repo.upsertMessage(it) }

            val history = _uiState.value.messages.filter { it.id != assistant.id }
            val model = _uiState.value.model

            // RULE: store the single Job reference so the next send can cancel it.
            streamingJob = launch {
                try {
                    repo.streamChat(chatId, history, model)
                        .onEach { event ->
                            ensureActive() // cooperative cancellation checkpoint
                            // RULE: all mutations atomic + reducer guarantees
                            // "update only the streaming message".
                            withContext(mainDispatcher) {
                                _uiState.update { MessageReducer.reduce(it, event) }
                            }
                            if (event is StreamEvent.Done || event is StreamEvent.Error) {
                                finalize(chatId, assistant.id, history, isError = event is StreamEvent.Error)
                            }
                        }
                        .launchIn(this)
                        .join()
                } catch (_: Exception) {
                    // Repository never throws fatal errors into the flow, but guard anyway.
                    _uiState.update { it.copy(isStreaming = false, streamingMessageId = null) }
                }
            }
        }
    }

    private suspend fun finalize(
        chatId: String,
        assistantId: String,
        priorHistory: List<ChatMessage>,
        isError: Boolean,
    ) {
        val finished = MessageReducer.finishedAssistantMessage(_uiState.value, assistantId) ?: return
        repo.upsertMessage(finished.copy(streaming = false))

        // Auto-title once, after the first real exchange.
        if (!isError && _uiState.value.title == "New chat") {
            val title = repo.generateTitle(priorHistory + finished)
            _uiState.update { it.copy(title = title) }
            repo.renameSession(chatId, title)
        }
    }

    override fun onCleared() {
        streamingJob?.cancel()
        super.onCleared()
    }
}
