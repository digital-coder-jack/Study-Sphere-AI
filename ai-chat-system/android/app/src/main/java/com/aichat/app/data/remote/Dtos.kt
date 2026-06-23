package com.aichat.app.data.remote

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ChatRequestDto(
    val model: String,
    val messages: List<MessageDto>,
    val stream: Boolean,
    val chatId: String? = null,
)

@JsonClass(generateAdapter = true)
data class MessageDto(val role: String, val content: String)

@JsonClass(generateAdapter = true)
data class ChatCompletionDto(
    val id: String?,
    val model: String?,
    val choices: List<ChoiceDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class ChoiceDto(val message: MessageDto?, val finish_reason: String?)

@JsonClass(generateAdapter = true)
data class TitleRequestDto(val messages: List<MessageDto>)

@JsonClass(generateAdapter = true)
data class TitleResponseDto(val title: String)
