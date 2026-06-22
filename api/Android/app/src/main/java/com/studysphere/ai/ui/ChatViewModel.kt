package com.studysphere.ai.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.studysphere.ai.data.Chat
import com.studysphere.ai.data.ChatMessage
import com.studysphere.ai.data.Repository
import com.studysphere.ai.data.StreamEvent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ChatUiState(
    val chats: List<Chat> = emptyList(),
    val currentChatId: Int? = null,
    val currentTitle: String = "New Chat",
    val messages: List<ChatMessage> = emptyList(),
    val streaming: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null,
    // Premium assistant additions:
    val model: String = "auto",
    val modelOptions: List<String> = listOf("auto"),
    val pinnedChatIds: Set<Int> = emptySet(),
    val searchQuery: String = ""
) {
    val visibleChats: List<Chat>
        get() {
            val filtered = if (searchQuery.isBlank()) chats
            else chats.filter { it.title.contains(searchQuery, ignoreCase = true) }
            // Pinned chats float to the top, preserving recency order within groups.
            return filtered.sortedByDescending { it.id in pinnedChatIds }
        }
}

class ChatViewModel(private val repo: Repository) : ViewModel() {

    private val _state = MutableStateFlow(ChatUiState())
    val state: StateFlow<ChatUiState> = _state.asStateFlow()

    init { loadModelOptions() }

    fun loadChats() {
        viewModelScope.launch {
            try {
                _state.value = _state.value.copy(chats = repo.listChats())
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = friendly(e))
            }
        }
    }

    private fun loadModelOptions() {
        viewModelScope.launch {
            try {
                val res = repo.aiModels()
                _state.value = _state.value.copy(
                    model = res.selected.ifBlank { "auto" },
                    modelOptions = res.options.ifEmpty { listOf("auto") }
                )
            } catch (_: Exception) {
                // Non-fatal — default to "auto" with the fallback chain.
            }
        }
    }

    fun selectModel(model: String) {
        _state.value = _state.value.copy(model = model)
        viewModelScope.launch {
            try { repo.setAiModel(model) } catch (_: Exception) { /* best-effort persist */ }
        }
    }

    fun setSearchQuery(q: String) {
        _state.value = _state.value.copy(searchQuery = q)
    }

    fun togglePin(chatId: Int) {
        val pins = _state.value.pinnedChatIds.toMutableSet()
        if (!pins.add(chatId)) pins.remove(chatId)
        _state.value = _state.value.copy(pinnedChatIds = pins)
    }

    fun openChat(chatId: Int) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val detail = repo.getChat(chatId)
                _state.value = _state.value.copy(
                    loading = false,
                    currentChatId = detail.chat.id,
                    currentTitle = detail.chat.title,
                    messages = detail.messages
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = friendly(e))
            }
        }
    }

    fun startNewChat() {
        _state.value = _state.value.copy(
            currentChatId = null,
            currentTitle = "New Chat",
            messages = emptyList(),
            error = null
        )
    }

    fun deleteChat(chatId: Int) {
        viewModelScope.launch {
            try {
                repo.deleteChat(chatId)
                if (_state.value.currentChatId == chatId) startNewChat()
                val pins = _state.value.pinnedChatIds.toMutableSet().apply { remove(chatId) }
                _state.value = _state.value.copy(pinnedChatIds = pins)
                loadChats()
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = friendly(e))
            }
        }
    }

    fun renameChat(chatId: Int, title: String) {
        if (title.isBlank()) return
        viewModelScope.launch {
            try {
                val chat = repo.renameChat(chatId, title.trim())
                if (_state.value.currentChatId == chatId) {
                    _state.value = _state.value.copy(currentTitle = chat.title)
                }
                loadChats()
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = friendly(e))
            }
        }
    }

    /** Send a message — creating a chat first if needed — and stream the reply. */
    fun send(content: String) {
        if (content.isBlank() || _state.value.streaming) return
        viewModelScope.launch {
            try {
                var chatId = _state.value.currentChatId
                if (chatId == null) {
                    val chat = repo.newChat()
                    chatId = chat.id
                    _state.value = _state.value.copy(
                        currentChatId = chat.id,
                        currentTitle = chat.title
                    )
                }

                val userMsg = ChatMessage(id = -1, role = "user", content = content)
                val assistantMsg = ChatMessage(id = -2, role = "assistant", content = "")
                _state.value = _state.value.copy(
                    messages = _state.value.messages + userMsg + assistantMsg,
                    streaming = true,
                    error = null
                )

                streamReply(chatId, content)
            } catch (e: Exception) {
                _state.value = _state.value.copy(streaming = false, error = friendly(e))
            }
        }
    }

    /**
     * Regenerate the latest assistant reply: re-send the most recent user
     * message and stream a fresh answer in place (ChatGPT/Gemini behaviour).
     */
    fun regenerateLast() {
        if (_state.value.streaming) return
        val msgs = _state.value.messages
        val lastUser = msgs.lastOrNull { it.role == "user" } ?: return
        val chatId = _state.value.currentChatId ?: return
        viewModelScope.launch {
            // Drop the trailing assistant message, replace with an empty bubble.
            val trimmed = msgs.toMutableList()
            if (trimmed.isNotEmpty() && trimmed.last().role == "assistant") {
                trimmed.removeAt(trimmed.lastIndex)
            }
            trimmed.add(ChatMessage(id = -2, role = "assistant", content = ""))
            _state.value = _state.value.copy(messages = trimmed, streaming = true, error = null)
            streamReply(chatId, lastUser.content)
        }
    }

    /**
     * Edit the last user message and resend it (Claude/ChatGPT-style edit).
     * Removes the old user+assistant pair and submits the new text.
     */
    fun editAndResend(newContent: String) {
        if (newContent.isBlank() || _state.value.streaming) return
        val msgs = _state.value.messages.toMutableList()
        val lastUserIdx = msgs.indexOfLast { it.role == "user" }
        if (lastUserIdx < 0) { send(newContent); return }
        // Remove everything from the last user message onward.
        while (msgs.size > lastUserIdx) msgs.removeAt(msgs.lastIndex)
        _state.value = _state.value.copy(messages = msgs)
        send(newContent)
    }

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
                        _state.value = _state.value.copy(streaming = false)
                        loadChats()
                    }
                    is StreamEvent.Error -> {
                        if (sb.isEmpty()) updateLastAssistant("⚠️ ${event.message}")
                        _state.value = _state.value.copy(streaming = false)
                    }
                }
            }
        } finally {
            if (_state.value.streaming) {
                _state.value = _state.value.copy(streaming = false)
            }
        }
    }

    private fun updateLastAssistant(text: String) {
        val msgs = _state.value.messages.toMutableList()
        val idx = msgs.indexOfLast { it.role == "assistant" }
        if (idx >= 0) {
            msgs[idx] = msgs[idx].copy(content = text)
            _state.value = _state.value.copy(messages = msgs)
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
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
