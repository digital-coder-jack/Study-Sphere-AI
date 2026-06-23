package com.aichat.app.ui.chat

import com.aichat.app.domain.model.ChatMessage
import com.aichat.app.domain.model.StreamEvent

/**
 * Pure reducer. Given the current state and a StreamEvent, returns the next state.
 *
 * GUARANTEES (the critical stability rules, enforced here):
 *  - Tokens are appended ONLY to the message identified by [ChatUiState.streamingMessageId].
 *  - Tokens NEVER create a new message -> no duplicate assistant bubbles.
 *  - If for any reason the streaming target is missing, the event is ignored
 *    (defensive: prevents writing into the wrong/last message).
 *  - Being a pure function makes it trivially testable and free of races;
 *    the ViewModel applies it atomically via MutableStateFlow.update { }.
 */
object MessageReducer {

    fun reduce(state: ChatUiState, event: StreamEvent): ChatUiState = when (event) {

        is StreamEvent.Start -> state.copy(
            isStreaming = true,
            errorBanner = null,
        )

        is StreamEvent.Token -> {
            val targetId = state.streamingMessageId ?: return state
            state.copy(
                messages = state.messages.map { msg ->
                    if (msg.id == targetId) {
                        msg.copy(content = msg.content + event.delta, streaming = true)
                    } else msg
                }
            )
        }

        is StreamEvent.Error -> {
            val targetId = state.streamingMessageId
            state.copy(
                isStreaming = false,
                streamingMessageId = null,
                errorBanner = event.message,
                messages = state.messages.map { msg ->
                    if (msg.id == targetId) {
                        // If nothing streamed yet, show a fallback line in the bubble.
                        val body = msg.content.ifEmpty { "⚠️ Couldn't get a response. Please try again." }
                        msg.copy(content = body, streaming = false, error = true)
                    } else msg
                }
            )
        }

        is StreamEvent.Done -> {
            val targetId = state.streamingMessageId
            state.copy(
                isStreaming = false,
                streamingMessageId = null,
                messages = state.messages.map { msg ->
                    if (msg.id == targetId) msg.copy(streaming = false) else msg
                }
            )
        }
    }

    /** Helper to finalize the streamed assistant message for persistence. */
    fun finishedAssistantMessage(state: ChatUiState, messageId: String): ChatMessage? =
        state.messages.firstOrNull { it.id == messageId }
}
