package com.aichat.app.stream

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Raw JSON shape of a single SSE frame emitted by the gateway. */
@JsonClass(generateAdapter = true)
data class GatewayFrame(
    val type: String?,
    val delta: String?,
    val message: String?,
    val fatal: Boolean?,
    @Json(name = "chatId") val chatId: String?,
    @Json(name = "messageId") val messageId: String?,
    val model: String?,
    @Json(name = "finishReason") val finishReason: String?,
)
