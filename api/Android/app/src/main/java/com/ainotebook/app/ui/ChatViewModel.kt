package com.ainotebook.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ainotebook.app.data.Chat
import com.ainotebook.app.data.ChatMessage
import com.ainotebook.app.data.Repository
import com.ainotebook.app.data.StreamEvent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update          // ← required for atomic CAS updates
import kotlinx.coroutines.launch

data class ChatUiState(
    val chats: List<Chat> = emptyList(),
    val currentChatId: Int? = null,
    val currentTitle: String = "New Chat",
    val messages: List<ChatMessage> = emptyList(),
    val streaming: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null,
    val model: String = "auto",
    val modelOptions: List<String> = listOf("auto"),
    val pinnedChatIds: Set<Int> = emptySet(),
    val searchQuery: String = ""
) {
    val visibleChats: List<Chat>
        get() {
            val filtered = if (searchQuery.isBlank()) chats
            else chats.filter { it.title.contains(searchQuery, ignoreCase = true) }
            // Pinned chats float to the top, preserving recency order within each group.
            return filtered.sortedByDescending { it.id in pinnedChatIds }
        }
}

class ChatViewModel(private val repo: Repository) : ViewModel() {

    private val _state = MutableStateFlow(ChatUiState())
    val state: StateFlow<ChatUiState> = _state.asStateFlow()

    init { loadModelOptions() }

    // ─── Chat list ────────────────────────────────────────────────────────────

    fun loadChats() {
        viewModelScope.launch {
            try {
                val chats = repo.listChats()
                _state.update { it.copy(chats = chats) }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendly(e)) }
            }
        }
    }

    // ─── Model selection ──────────────────────────────────────────────────────

    private fun loadModelOptions() {
        viewModelScope.launch {
            try {
                val res = repo.aiModels()
                _state.update {
                    it.copy(
                        model = res.selected.ifBlank { "auto" },
                        modelOptions = res.options.ifEmpty { listOf("auto") }
                    )
                }
            } catch (_: Exception) {
                // Non-fatal — defaults already set in ChatUiState.
            }
        }
    }

    fun selectModel(model: String) {
        _state.update { it.copy(model = model) }
        viewModelScope.launch {
            try { repo.setAiModel(model) } catch (_: Exception) { /* best-effort persist */ }
        }
    }

    // ─── Search / pin ─────────────────────────────────────────────────────────

    fun setSearchQuery(q: String) {
        _state.update { it.copy(searchQuery = q) }
    }

    fun togglePin(chatId: Int) {
        // FIX: entire read-modify-write is inside update {} so it cannot race.
        _state.update { current ->
            val pins = current.pinnedChatIds.toMutableSet()
            if (!pins.add(chatId)) pins.remove(chatId)
            current.copy(pinnedChatIds = pins)
        }
    }

    // ─── Chat lifecycle ───────────────────────────────────────────────────────

    fun openChat(chatId: Int) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val detail = repo.getChat(chatId)
                _state.update {
                    it.copy(
                        loading = false,
                        currentChatId = detail.chat.id,
                        currentTitle = detail.chat.title,
                        messages = detail.messages
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = friendly(e)) }
            }
        }
    }

    fun startNewChat() {
        _state.update {
            it.copy(
                currentChatId = null,
                currentTitle = "New Chat",
                messages = emptyList(),
                error = null
            )
        }
    }

    fun deleteChat(chatId: Int) {
        viewModelScope.launch {
            try {
                repo.deleteChat(chatId)
                // FIX: capture wasCurrentChat BEFORE mutating state so we don't
                // read a value we just changed.
                val wasCurrentChat = _state.value.currentChatId == chatId
                _state.update { current ->
                    val pins = current.pinnedChatIds.toMutableSet().apply { remove(chatId) }
                    current.copy(pinnedChatIds = pins)
                }
                if (wasCurrentChat) startNewChat()
                loadChats()
            } catch (e: Exception) {
                _state.update { it.copy(error = friendly(e)) }
            }
        }
    }

    fun renameChat(chatId: Int, title: String) {
        if (title.isBlank()) return
        viewModelScope.launch {
            try {
                val chat = repo.renameChat(chatId, title.trim())
                _state.update { current ->
                    if (current.currentChatId == chatId) current.copy(currentTitle = chat.title)
                    else current
                }
                loadChats()
            } catch (e: Exception) {
                _state.update { it.copy(error = friendly(e)) }
            }
        }
    }

    // ─── Messaging ────────────────────────────────────────────────────────────

    /**
     * Send a message — creating a chat first if needed — and stream the reply.
     */
    fun send(content: String) {
        if (content.isBlank() || _state.value.streaming) return
        viewModelScope.launch {
            try {
                // Resolve or create a chat ID before touching the message list.
                val chatId = _state.value.currentChatId ?: run {
                    val chat = repo.newChat()
                    _state.update {
                        it.copy(currentChatId = chat.id, currentTitle = chat.title)
                    }
                    chat.id
                }

                // FIX: append both bubbles AND set streaming=true in a single atomic
                // update so the UI never sees a partial state (e.g. streaming=false
                // while the assistant bubble already exists).
                val userMsg = ChatMessage(id = -1, role = "user", content = content)
                val assistantMsg = ChatMessage(id = -2, role = "assistant", content = "")
                _state.update {
                    it.copy(
                        // FIX: read it.messages inside the lambda — not _state.value.messages
                        // from an outer scope — to guarantee we append to the latest list.
                        messages = it.messages + userMsg + assistantMsg,
                        streaming = true,
                        error = null
                    )
                }

                streamReply(chatId, content)
            } catch (e: Exception) {
                _state.update { it.copy(streaming = false, error = friendly(e)) }
            }
        }
    }

    /**
     * Regenerate the latest assistant reply: re-send the most recent user
     * message and stream a fresh answer in place (ChatGPT/Gemini behaviour).
     */
    fun regenerateLast() {
        if (_state.value.streaming) return
        // Snapshot outside the coroutine; these values are immutable data.
        val currentState = _state.value
        val lastUser = currentState.messages.lastOrNull { it.role == "user" } ?: return
        val chatId = currentState.currentChatId ?: return

        viewModelScope.launch {
            // FIX: added try-catch — without it, any exception thrown by streamReply
            // (e.g. from repo.currentToken()) would leave streaming=true forever and
            // swallow the error silently.
            try {
                // FIX: atomic swap of the trailing assistant bubble.
                _state.update { current ->
                    val trimmed = current.messages.toMutableList()
                    if (trimmed.isNotEmpty() && trimmed.last().role == "assistant") {
                        trimmed.removeAt(trimmed.lastIndex)
                    }
                    trimmed.add(ChatMessage(id = -2, role = "assistant", content = ""))
                    current.copy(messages = trimmed, streaming = true, error = null)
                }
                streamReply(chatId, lastUser.content)
            } catch (e: Exception) {
                _state.update { it.copy(streaming = false, error = friendly(e)) }
            }
        }
    }

    /**
     * Edit the last user message and resend it (Claude/ChatGPT-style edit).
     * Removes the old user+assistant pair and submits the new text.
     */
    fun editAndResend(newContent: String) {
        if (newContent.isBlank() || _state.value.streaming) return
        val lastUserIdx = _state.value.messages.indexOfLast { it.role == "user" }
        if (lastUserIdx < 0) {
            send(newContent)
            return
        }
        // FIX: trim happens atomically inside update {}; the subsequent send() will
        // then read the already-trimmed list when it appends the new bubbles.
        _state.update { current ->
            val trimmed = current.messages.toMutableList()
            while (trimmed.size > lastUserIdx) trimmed.removeAt(trimmed.lastIndex)
            current.copy(messages = trimmed)
        }
        send(newContent)
    }

    // ─── Internal streaming ───────────────────────────────────────────────────

    private suspend fun streamReply(chatId: Int, content: String) {
        val token = repo.currentToken()
        val sb = StringBuilder()
        try {
            repo.streamMessage(chatId, content, token, _state.value.model).collect { event ->
                when (event) {
                    is StreamEvent.Token -> {
                        sb.append(event.text)
                        updateLastAssistant(sb.toString())
                    }
                    is StreamEvent.Done -> {
                        _state.update { it.copy(streaming = false) }
                        loadChats()
                    }
                    is StreamEvent.Error -> {
                        if (sb.isEmpty()) updateLastAssistant("⚠️ ${event.message}")
                        _state.update { it.copy(streaming = false) }
                    }
                }
            }
        } finally {
            // FIX: conditional update avoids emitting a spurious state change when
            // Done/Error already cleared the flag. Coroutine cancellation is also
            // covered — streaming will always be false when this scope exits.
            _state.update { if (it.streaming) it.copy(streaming = false) else it }
        }
    }

    /**
     * Atomically patch the last assistant bubble's text.
     * FIX: using update {} prevents a torn read-modify-write on every streaming
     * token, which was the highest-frequency race in the original code.
     */
    private fun updateLastAssistant(text: String) {
        _state.update { current ->
            val msgs = current.messages.toMutableList()
            val idx = msgs.indexOfLast { it.role == "assistant" }
            if (idx >= 0) {
                msgs[idx] = msgs[idx].copy(content = text)
                current.copy(messages = msgs)
            } else current   // guard: no-op if the bubble is somehow missing
        }
    }

    // ─── Misc ─────────────────────────────────────────────────────────────────

    fun clearError() {
        _state.update { it.copy(error = null) }
    }

    private fun friendly(e: Exception): String {
        val msg = e.message ?: "Something went wrong."
        return when {
            msg.contains("Unable to resolve host", true) ||
                msg.contains("timeout", true) ||
                msg.contains("failed to connect", true) ->
                "Cannot reach the server. Check your connection and try again."
            else -> msg
        }
    }
}
