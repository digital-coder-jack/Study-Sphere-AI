package com.aichat.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sessions")
data class SessionEntity(
    @PrimaryKey val id: String,
    val title: String,
    val model: String,
    val updatedAt: Long,
)

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey val id: String,
    val chatId: String,
    val role: String,
    val content: String,
    val createdAt: Long,
    val error: Boolean,
)
