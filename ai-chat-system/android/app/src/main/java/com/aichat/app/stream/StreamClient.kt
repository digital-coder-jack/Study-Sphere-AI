package com.aichat.app.stream

import com.aichat.app.domain.model.StreamEvent
import com.squareup.moshi.Moshi
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Robust SSE client built on OkHttp's EventSource.
 *
 * Responsibilities:
 *  - open one SSE connection per request
 *  - parse each `data:` frame into a [StreamEvent] via the gateway's JSON shape
 *  - terminate cleanly on `[DONE]`, error, or flow-collector cancellation
 *
 * It NEVER throws into the collector: transport failures are surfaced as
 * StreamEvent.Error(fatal=true) so upper layers can decide on retry/fallback.
 */
@Singleton
class StreamClient @Inject constructor(
    private val client: OkHttpClient,
    moshi: Moshi,
) {
    private val frameAdapter = moshi.adapter(GatewayFrame::class.java)

    fun stream(
        url: String,
        bearer: String,
        jsonBody: String,
    ): Flow<StreamEvent> = callbackFlow {
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $bearer")
            .addHeader("Accept", "text/event-stream")
            .post(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()

        val listener = object : EventSourceListener() {
            override fun onEvent(
                eventSource: EventSource,
                id: String?,
                type: String?,
                data: String,
            ) {
                // Gateway terminates the SSE with a literal [DONE] sentinel.
                if (data == "[DONE]") {
                    close()
                    return
                }
                val event = parse(data) ?: return
                trySend(event)
                if (event is StreamEvent.Error && event.fatal) close()
                if (event is StreamEvent.Done) close()
            }

            override fun onFailure(
                eventSource: EventSource,
                t: Throwable?,
                response: Response?,
            ) {
                val msg = t?.message ?: "HTTP ${response?.code ?: "?"}"
                // Surface as a fatal error event rather than throwing.
                trySend(StreamEvent.Error(message = msg, fatal = true))
                close()
            }

            override fun onClosed(eventSource: EventSource) {
                close()
            }
        }

        val source = EventSources.createFactory(client).newEventSource(request, listener)

        // When the collector cancels (e.g. a new stream starts), cancel the connection.
        awaitClose { source.cancel() }
    }

    private fun parse(data: String): StreamEvent? {
        return try {
            val f = frameAdapter.fromJson(data) ?: return null
            when (f.type) {
                "start" -> StreamEvent.Start(
                    chatId = f.chatId.orEmpty(),
                    messageId = f.messageId.orEmpty(),
                    model = f.model.orEmpty(),
                )
                "token" -> f.delta?.let { StreamEvent.Token(it) }
                "error" -> StreamEvent.Error(f.message ?: "unknown error", f.fatal ?: true)
                "done" -> StreamEvent.Done(f.finishReason ?: "stop")
                else -> null
            }
        } catch (_: Exception) {
            null // ignore malformed frames defensively
        }
    }
}
