package com.studysphere.ai.ui

import androidx.compose.runtime.staticCompositionLocalOf
import com.studysphere.ai.data.NetworkMonitor
import com.studysphere.ai.data.ThemePreferences

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
