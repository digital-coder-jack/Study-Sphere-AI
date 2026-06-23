package com.aichat.app.domain.model

import java.util.UUID

enum class Role { USER, ASSISTANT, SYSTEM }

/** Which provider/model the user wants the gateway to route to. */
enum class AiModel(val id: String, val label: String) {
    AUTO("auto", "Auto"),
    GROQ("groq", "Groq"),
    GEMINI("gemini", "Gemini"),
    KIMI("kimi", "Kimi");

    companion object {
        fun fromId(id: String) = entries.firstOrNull { it.id == id } ?: AUTO
    }
}

data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val chatId: String,
    val role: Role,
    val content: String,
    val createdAt: Long = System.currentTimeMillis(),
    /** true while this assistant message is actively being streamed into. */
    val streaming: Boolean = false,
    /** set when the message ended in an error so UI can show a retry affordance. */
    val error: Boolean = false,
)

data class ChatSession(
    val id: String = UUID.randomUUID().toString(),
    val title: String = "New chat",
    val model: AiModel = AiModel.AUTO,
    val updatedAt: Long = System.currentTimeMillis(),
)
