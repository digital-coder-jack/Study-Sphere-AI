package com.ainotebook.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ainotebook.app.data.Repository
import com.ainotebook.app.data.Stats
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DashboardUiState(
    val loading: Boolean = true,
    val stats: Stats? = null,
    val error: String? = null
)

class DashboardViewModel(private val repo: Repository) : ViewModel() {

    private val _state = MutableStateFlow(DashboardUiState())
    val state: StateFlow<DashboardUiState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val s = repo.stats()
                _state.value = DashboardUiState(loading = false, stats = s)
            } catch (e: Exception) {
                _state.value = DashboardUiState(
                    loading = false,
                    error = e.message ?: "Could not load your dashboard."
                )
            }
        }
    }
}
