package com.aichat.app.ui.chat

import com.aichat.app.domain.model.AiModel
import com.aichat.app.domain.model.ChatMessage

data class ChatUiState(
    val chatId: String? = null,
    val title: String = "New chat",
    val model: AiModel = AiModel.AUTO,
    val messages: List<ChatMessage> = emptyList(),
    /** id of the assistant message currently being streamed into (null = idle). */
    val streamingMessageId: String? = null,
    val isStreaming: Boolean = false,
    val input: String = "",
    val errorBanner: String? = null,
) {
    val canSend: Boolean get() = input.isNotBlank() && !isStreaming
}
