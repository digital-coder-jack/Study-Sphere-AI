package com.aichat.app.domain.model

/**
 * The single normalized streaming event the whole app understands.
 * Provider-specific shapes are converted to this by the backend gateway,
 * and the SSE StreamClient parses gateway frames into these.
 */
sealed interface StreamEvent {
    data class Start(val chatId: String, val messageId: String, val model: String) : StreamEvent
    data class Token(val delta: String) : StreamEvent
    data class Error(val message: String, val fatal: Boolean) : StreamEvent
    data class Done(val finishReason: String) : StreamEvent
}
