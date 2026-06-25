package com.ainotebook.app.ui

import androidx.compose.runtime.staticCompositionLocalOf
import com.ainotebook.app.data.NetworkMonitor
import com.ainotebook.app.data.ThemePreferences

/**
 * App-wide composition locals so deep screens (settings, chat) can reach the
 * appearance preferences and connectivity monitor without prop-drilling.
 */
val LocalAppPrefs = staticCompositionLocalOf<ThemePreferences> {
    error("ThemePreferences not provided")
}

val LocalNetworkMonitor = staticCompositionLocalOf<NetworkMonitor> {
    error("NetworkMonitor not provided")
}
