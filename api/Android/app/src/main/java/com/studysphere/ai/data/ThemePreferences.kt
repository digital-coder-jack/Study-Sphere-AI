package com.studysphere.ai.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.themeStore by preferencesDataStore(name = "study_sphere_prefs")

/** User-selectable theme mode for the app (mirrors ChatGPT/Gemini appearance settings). */
enum class ThemeMode { SYSTEM, LIGHT, DARK }

/**
 * Persists user appearance + assistant preferences using Jetpack DataStore.
 * Purely additive — does not touch the existing session/auth flow.
 */
class ThemePreferences(private val context: Context) {

    companion object {
        private val THEME_KEY = stringPreferencesKey("pref_theme_mode")
        private val DYNAMIC_KEY = booleanPreferencesKey("pref_dynamic_color")
        private val HAPTICS_KEY = booleanPreferencesKey("pref_haptics")
        private val MODEL_KEY = stringPreferencesKey("pref_ai_model")
    }

    val themeMode: Flow<ThemeMode> = context.themeStore.data.map { prefs ->
        when (prefs[THEME_KEY]) {
            "LIGHT" -> ThemeMode.LIGHT
            "DARK" -> ThemeMode.DARK
            else -> ThemeMode.DARK // premium dark-first default, like Perplexity/Claude
        }
    }

    val dynamicColor: Flow<Boolean> =
        context.themeStore.data.map { it[DYNAMIC_KEY] ?: false }

    val hapticsEnabled: Flow<Boolean> =
        context.themeStore.data.map { it[HAPTICS_KEY] ?: true }

    val aiModel: Flow<String> =
        context.themeStore.data.map { it[MODEL_KEY] ?: "auto" }

    suspend fun setThemeMode(mode: ThemeMode) {
        context.themeStore.edit { it[THEME_KEY] = mode.name }
    }

    suspend fun setDynamicColor(enabled: Boolean) {
        context.themeStore.edit { it[DYNAMIC_KEY] = enabled }
    }

    suspend fun setHaptics(enabled: Boolean) {
        context.themeStore.edit { it[HAPTICS_KEY] = enabled }
    }

    suspend fun setAiModel(model: String) {
        context.themeStore.edit { it[MODEL_KEY] = model }
    }
}
