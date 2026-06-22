package com.studysphere.ai.data

import kotlinx.coroutines.flow.Flow

/**
 * Thin repository wrapping [ApiClient] + [SessionStore]. Holds the session
 * lifecycle so view models stay free of networking details.
 */
class Repository(private val session: SessionStore) {

    val tokenFlow get() = session.tokenFlow
    val userFlow get() = session.userFlow

    suspend fun currentToken() = session.token()

    /* ---------- Auth ---------- */
    suspend fun login(identifier: String, password: String): User {
        val res = ApiClient.api.login(LoginRequest(identifier, password))
        session.save(res.token, res.user)
        return res.user
    }

    suspend fun signup(
        name: String, username: String, email: String,
        password: String, confirm: String
    ): User {
        val res = ApiClient.api.signup(
            SignupRequest(name, username, email, password, confirm)
        )
        session.save(res.token, res.user)
        return res.user
    }

    suspend fun guest(): User {
        val res = ApiClient.api.guest()
        session.save(res.token, res.user.copy(is_guest = true))
        return res.user
    }

    suspend fun me(): User {
        val res = ApiClient.api.me()
        session.saveUser(res.user)
        return res.user
    }

    suspend fun updateProfile(name: String): User {
        val res = ApiClient.api.updateProfile(ProfileRequest(name))
        session.saveUser(res.user)
        return res.user
    }

    suspend fun changePassword(current: String, new: String): String =
        ApiClient.api.changePassword(ChangePasswordRequest(current, new)).message

    suspend fun deleteAccount(): String {
        val msg = ApiClient.api.deleteAccount().message
        session.clear()
        return msg
    }

    suspend fun logout() = session.clear()

    /* ---------- Chats ---------- */
    suspend fun listChats() = ApiClient.api.listChats().chats
    suspend fun newChat(title: String? = null) = ApiClient.api.newChat(NewChatRequest(title)).chat
    suspend fun getChat(id: Int) = ApiClient.api.getChat(id)
    suspend fun renameChat(id: Int, title: String) =
        ApiClient.api.renameChat(id, RenameChatRequest(title)).chat
    suspend fun deleteChat(id: Int) = ApiClient.api.deleteChat(id)

    fun streamMessage(
        chatId: Int,
        content: String,
        token: String?,
        model: String? = null
    ): Flow<StreamEvent> =
        StreamClient.streamMessage(chatId, content, token, model)

    /* ---------- AI model selection ---------- */
    suspend fun aiModels() = ApiClient.api.aiModels()
    suspend fun setAiModel(model: String) =
        ApiClient.api.setAiModel(SetModelRequest(model)).selected

    /* ---------- Dashboard ---------- */
    suspend fun stats() = ApiClient.api.stats()

    /* ---------- Study tools ---------- */
    suspend fun generateNotes(topic: String) = ApiClient.api.generateNotes(TopicRequest(topic))
    suspend fun generateQuiz(topic: String, n: Int) =
        ApiClient.api.generateQuiz(QuizRequest(topic, n))
    suspend fun generateFlashcards(topic: String, n: Int) =
        ApiClient.api.generateFlashcards(FlashRequest(topic, n))
    suspend fun generatePlan(goal: String, days: Int) =
        ApiClient.api.generatePlan(PlanRequest(goal, days))
    suspend fun summarize(text: String) = ApiClient.api.summarize(TextRequest(text))
    suspend fun homework(question: String) = ApiClient.api.homework(QuestionRequest(question))
}
