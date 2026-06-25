package com.ainotebook.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ainotebook.app.data.Flashcard
import com.ainotebook.app.data.QuizQuestion
import com.ainotebook.app.data.Repository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Generic result holder for the study tools. */
data class ToolsUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val textResult: String? = null,        // notes / plan / summary / homework
    val quiz: List<QuizQuestion>? = null,
    val flashcards: List<Flashcard>? = null
)

enum class Tool { NOTES, QUIZ, FLASHCARDS, PLAN, SUMMARIZE, HOMEWORK }

class ToolsViewModel(private val repo: Repository) : ViewModel() {

    private val _state = MutableStateFlow(ToolsUiState())
    val state: StateFlow<ToolsUiState> = _state.asStateFlow()

    fun reset() {
        _state.value = ToolsUiState()
    }

    private fun begin() {
        _state.value = ToolsUiState(loading = true)
    }

    private fun fail(e: Exception) {
        _state.value = ToolsUiState(error = e.message ?: "Something went wrong.")
    }

    fun notes(topic: String) = launch { _state.value = ToolsUiState(textResult = repo.generateNotes(topic).content) }
    fun plan(goal: String, days: Int) = launch { _state.value = ToolsUiState(textResult = repo.generatePlan(goal, days).content) }
    fun summarize(text: String) = launch { _state.value = ToolsUiState(textResult = repo.summarize(text).summary) }
    fun homework(q: String) = launch { _state.value = ToolsUiState(textResult = repo.homework(q).answer) }
    fun quiz(topic: String, n: Int) = launch { _state.value = ToolsUiState(quiz = repo.generateQuiz(topic, n).questions) }
    fun flashcards(topic: String, n: Int) = launch { _state.value = ToolsUiState(flashcards = repo.generateFlashcards(topic, n).cards) }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch {
            begin()
            try {
                block()
            } catch (e: Exception) {
                fail(e)
            }
        }
    }
}
