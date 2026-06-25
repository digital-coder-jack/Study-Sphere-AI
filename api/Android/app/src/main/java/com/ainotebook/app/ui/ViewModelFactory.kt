package com.ainotebook.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.ainotebook.app.data.Repository

/**
 * Single factory able to construct every view model in the app from the shared
 * [Repository]. Keeps things dependency-injection-framework-free.
 */
class VMFactory(private val repo: Repository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(AuthViewModel::class.java) -> AuthViewModel(repo) as T
            modelClass.isAssignableFrom(DashboardViewModel::class.java) -> DashboardViewModel(repo) as T
            modelClass.isAssignableFrom(ChatViewModel::class.java) -> ChatViewModel(repo) as T
            modelClass.isAssignableFrom(ToolsViewModel::class.java) -> ToolsViewModel(repo) as T
            modelClass.isAssignableFrom(ProfileViewModel::class.java) -> ProfileViewModel(repo) as T
            else -> throw IllegalArgumentException("Unknown ViewModel: ${modelClass.name}")
        }
    }
}
