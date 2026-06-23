package com.aichat.app.data.model

import com.aichat.app.data.local.MessageEntity
import com.aichat.app.data.local.SessionEntity
import com.aichat.app.data.remote.MessageDto
import com.aichat.app.domain.model.AiModel
import com.aichat.app.domain.model.ChatMessage
import com.aichat.app.domain.model.ChatSession
import com.aichat.app.domain.model.Role

fun SessionEntity.toDomain() = ChatSession(
    id = id,
    title = title,
    model = AiModel.fromId(model),
    updatedAt = updatedAt,
)

fun ChatSession.toEntity() = SessionEntity(
    id = id,
    title = title,
    model = model.id,
    updatedAt = updatedAt,
)

fun MessageEntity.toDomain() = ChatMessage(
    id = id,
    chatId = chatId,
    role = Role.valueOf(role),
    content = content,
    createdAt = createdAt,
    streaming = false,
    error = error,
)

fun ChatMessage.toEntity() = MessageEntity(
    id = id,
    chatId = chatId,
    role = role.name,
    content = content,
    createdAt = createdAt,
    error = error,
)

fun ChatMessage.toDto() = MessageDto(role = role.name.lowercase(), content = content)
