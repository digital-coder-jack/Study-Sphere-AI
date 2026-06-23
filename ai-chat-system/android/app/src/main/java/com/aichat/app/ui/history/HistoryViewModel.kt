package com.aichat.app.ui.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aichat.app.domain.model.AiModel
import com.aichat.app.domain.model.ChatSession
import com.aichat.app.domain.repository.ChatRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HistoryViewModel @Inject constructor(
    private val repo: ChatRepository,
) : ViewModel() {

    val sessions: StateFlow<List<ChatSession>> =
        repo.observeSessions().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun newChat(onCreated: (String) -> Unit) {
        viewModelScope.launch {
            val session = repo.createSession(AiModel.AUTO)
            onCreated(session.id)
        }
    }

    fun delete(chatId: String) = viewModelScope.launch { repo.deleteSession(chatId) }
}
