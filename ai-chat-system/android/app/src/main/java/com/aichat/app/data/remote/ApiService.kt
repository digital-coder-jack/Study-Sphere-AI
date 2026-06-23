package com.aichat.app.data.remote

import retrofit2.http.Body
import retrofit2.http.POST

/** Non-streaming endpoints. Streaming uses StreamClient (OkHttp SSE) directly. */
interface ApiService {

    @POST("v1/chat/completions")
    suspend fun complete(@Body body: ChatRequestDto): ChatCompletionDto

    @POST("v1/title")
    suspend fun title(@Body body: TitleRequestDto): TitleResponseDto
}
