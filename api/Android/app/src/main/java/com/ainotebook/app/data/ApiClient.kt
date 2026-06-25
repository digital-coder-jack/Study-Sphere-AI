package com.ainotebook.app.data

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.ainotebook.app.BuildConfig
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

/**
 * Builds the shared OkHttp + Retrofit stack. The auth interceptor injects the
 * current JWT (read from [SessionStore]) into every request's Authorization
 * header, matching the web app's `Bearer <token>` scheme.
 */
object ApiClient {

    private const val BASE = BuildConfig.API_BASE_URL

    val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    @Volatile
    private var service: ApiService? = null

    @Volatile
    lateinit var okHttp: OkHttpClient
        private set

    fun baseUrl(): String = if (BASE.endsWith("/")) BASE else "$BASE/"

    fun init(session: SessionStore) {
        val authInterceptor = Interceptor { chain ->
            val token = runBlocking { session.token() }
            val builder = chain.request().newBuilder()
            if (!token.isNullOrBlank()) {
                builder.addHeader("Authorization", "Bearer $token")
            }
            chain.proceed(builder.build())
        }

        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC
            else HttpLoggingInterceptor.Level.NONE
        }

        okHttp = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS) // long for SSE streaming
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

        val contentType = "application/json".toMediaType()
        service = Retrofit.Builder()
            .baseUrl(baseUrl())
            .client(okHttp)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
            .create(ApiService::class.java)
    }

    val api: ApiService
        get() = service ?: error("ApiClient.init() must be called first")
}
