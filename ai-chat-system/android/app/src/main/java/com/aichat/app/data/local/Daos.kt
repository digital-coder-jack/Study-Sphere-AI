package com.aichat.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface SessionDao {
    @Query("SELECT * FROM sessions ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<SessionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(session: SessionEntity)

    @Query("UPDATE sessions SET title = :title, updatedAt = :ts WHERE id = :id")
    suspend fun rename(id: String, title: String, ts: Long)

    @Query("UPDATE sessions SET model = :model, updatedAt = :ts WHERE id = :id")
    suspend fun setModel(id: String, model: String, ts: Long)

    @Query("UPDATE sessions SET updatedAt = :ts WHERE id = :id")
    suspend fun touch(id: String, ts: Long)

    @Query("DELETE FROM sessions WHERE id = :id")
    suspend fun delete(id: String)
}

@Dao
interface MessageDao {
    @Query("SELECT * FROM messages WHERE chatId = :chatId ORDER BY createdAt ASC")
    fun observeForChat(chatId: String): Flow<List<MessageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(message: MessageEntity)

    @Query("DELETE FROM messages WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM messages WHERE chatId = :chatId")
    suspend fun deleteForChat(chatId: String)
}
