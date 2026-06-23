package com.aichat.app

import com.aichat.app.domain.model.ChatMessage
import com.aichat.app.domain.model.Role
import com.aichat.app.domain.model.StreamEvent
import com.aichat.app.ui.chat.ChatUiState
import com.aichat.app.ui.chat.MessageReducer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MessageReducerTest {

    private fun baseState(): ChatUiState {
        val assistant = ChatMessage(id = "A", chatId = "c", role = Role.ASSISTANT, content = "", streaming = true)
        return ChatUiState(
            chatId = "c",
            messages = listOf(
                ChatMessage(id = "U", chatId = "c", role = Role.USER, content = "hi"),
                assistant,
            ),
            streamingMessageId = "A",
            isStreaming = true,
        )
    }

    @Test fun tokens_append_only_to_streaming_message() {
        var s = baseState()
        s = MessageReducer.reduce(s, StreamEvent.Token("He"))
        s = MessageReducer.reduce(s, StreamEvent.Token("llo"))
        assertEquals("Hello", s.messages.first { it.id == "A" }.content)
        assertEquals("hi", s.messages.first { it.id == "U" }.content) // user untouched
    }

    @Test fun tokens_never_create_duplicate_messages() {
        var s = baseState()
        val before = s.messages.size
        repeat(5) { s = MessageReducer.reduce(s, StreamEvent.Token("x")) }
        assertEquals(before, s.messages.size) // no new bubbles
    }

    @Test fun token_with_no_active_target_is_ignored() {
        val s = baseState().copy(streamingMessageId = null)
        val out = MessageReducer.reduce(s, StreamEvent.Token("ghost"))
        assertEquals(s, out) // unchanged -> can't write into wrong message
    }

    @Test fun done_finalizes_and_clears_streaming() {
        var s = baseState()
        s = MessageReducer.reduce(s, StreamEvent.Token("done"))
        s = MessageReducer.reduce(s, StreamEvent.Done("stop"))
        assertFalse(s.isStreaming)
        assertEquals(null, s.streamingMessageId)
        assertFalse(s.messages.first { it.id == "A" }.streaming)
    }

    @Test fun error_with_empty_body_shows_fallback_text() {
        var s = baseState()
        s = MessageReducer.reduce(s, StreamEvent.Error("boom", fatal = true))
        val a = s.messages.first { it.id == "A" }
        assertTrue(a.error)
        assertFalse(s.isStreaming)
        assertTrue(a.content.isNotEmpty()) // fallback message injected
    }
}
