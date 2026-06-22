package com.studysphere.ai.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Consumes the backend's Server-Sent Events stream from
 * POST /api/chats/{id}/stream and emits incremental tokens.
 *
 * Each SSE line is `data: {"token":"..."}` or `data: {"done":true,...}`.
 */
sealed class StreamEvent {
    data class Token(val text: String) : StreamEvent()
    data class Done(val messageId: Int?) : StreamEvent()
    data class Error(val message: String) : StreamEvent()
}

object StreamClient {

    private val json = Json { ignoreUnknownKeys = true }

    fun streamMessage(
        chatId: Int,
        content: String,
        token: String?,
        model: String? = null
    ): Flow<StreamEvent> =
        callbackFlow {
            val url = ApiClient.baseUrl() + "api/chats/$chatId/stream"
            val mediaType = "application/json".toMediaType()
            // Only send an override when a concrete provider is chosen ("auto"
            // lets the backend pick via the fallback chain, matching the web app).
            val override = model?.takeIf { it.isNotBlank() && it != "auto" }
            val payload = json.encodeToString(
                StreamRequest.serializer(),
                StreamRequest(content, override)
            )

            val reqBuilder = Request.Builder()
                .url(url)
                .addHeader("Accept", "text/event-stream")
                .post(payload.toRequestBody(mediaType))
            if (!token.isNullOrBlank()) {
                reqBuilder.addHeader("Authorization", "Bearer $token")
            }

            val call = ApiClient.okHttp.newCall(reqBuilder.build())

            try {
                call.execute().use { response ->
                    if (!response.isSuccessful) {
                        trySend(StreamEvent.Error("Request failed (${response.code})"))
                        close()
                        return@use
                    }
                    val source = response.body?.source()
                    if (source == null) {
                        trySend(StreamEvent.Error("Empty response"))
                        close()
                        return@use
                    }

                    while (!source.exhausted()) {
                        val line = source.readUtf8Line() ?: break
                        if (line.isBlank()) continue
                        if (!line.startsWith("data:")) continue
                        val data = line.removePrefix("data:").trim()
                        if (data.isEmpty()) continue

                        val obj = runCatching {
                            json.parseToJsonElement(data) as? JsonObject
                        }.getOrNull() ?: continue

                        obj["done"]?.jsonPrimitive?.booleanOrNull?.let { done ->
                            if (done) {
                                val mid = obj["message_id"]?.jsonPrimitive?.content?.toIntOrNull()
                                trySend(StreamEvent.Done(mid))
                            }
                        }
                        obj["token"]?.let { tokenEl ->
                            val text = tokenEl.jsonPrimitive.content
                            trySend(StreamEvent.Token(text))
                        }
                    }
                    close()
                }
            } catch (e: Exception) {
                trySend(StreamEvent.Error(e.message ?: "Stream interrupted"))
                close()
            }

            awaitClose { call.cancel() }
        }.flowOn(Dispatchers.IO)
}
