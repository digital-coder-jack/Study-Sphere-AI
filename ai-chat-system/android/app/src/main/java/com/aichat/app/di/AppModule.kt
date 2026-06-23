package com.aichat.app.di

import android.content.Context
import androidx.room.Room
import com.aichat.app.BuildConfig
import com.aichat.app.data.local.AppDatabase
import com.aichat.app.data.local.MessageDao
import com.aichat.app.data.local.SessionDao
import com.aichat.app.data.remote.ApiService
import com.aichat.app.data.repository.ChatRepositoryImpl
import com.aichat.app.domain.repository.ChatRepository
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides @Singleton
    fun moshi(): Moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()

    @Provides @Singleton
    fun okHttp(): OkHttpClient = OkHttpClient.Builder()
        // No read timeout: SSE connections are long-lived.
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .connectTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC
            else HttpLoggingInterceptor.Level.NONE
        })
        .build()

    @Provides @Singleton
    fun retrofit(client: OkHttpClient, moshi: Moshi): Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.GATEWAY_BASE_URL)
        .client(client)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()

    @Provides @Singleton
    fun apiService(retrofit: Retrofit): ApiService = retrofit.create(ApiService::class.java)

    @Provides @Singleton
    fun db(@ApplicationContext ctx: Context): AppDatabase =
        Room.databaseBuilder(ctx, AppDatabase::class.java, "aichat.db").build()

    @Provides fun sessionDao(db: AppDatabase): SessionDao = db.sessionDao()
    @Provides fun messageDao(db: AppDatabase): MessageDao = db.messageDao()
}

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds @Singleton
    abstract fun bindChatRepository(impl: ChatRepositoryImpl): ChatRepository
}
