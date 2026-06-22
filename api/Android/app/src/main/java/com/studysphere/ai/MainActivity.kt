package com.studysphere.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.studysphere.ai.data.ThemeMode
import com.studysphere.ai.ui.AppRoot
import com.studysphere.ai.ui.LocalAppPrefs
import com.studysphere.ai.ui.LocalNetworkMonitor
import com.studysphere.ai.ui.theme.StudySphereTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Install the AndroidX splash screen before super.onCreate() so the
        // branded launch screen shows the official logo while the app warms up.
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as StudySphereApp
        val repo = app.repository
        val prefs = app.themePrefs
        val network = app.networkMonitor

        // Keep the splash on-screen for a brief, deliberate beat (premium feel).
        var keepSplash = true
        splash.setKeepOnScreenCondition { keepSplash }
        window.decorView.postDelayed({ keepSplash = false }, 350)

        setContent {
            val mode by prefs.themeMode.collectAsStateWithLifecycle(initialValue = ThemeMode.DARK)
            val dynamic by prefs.dynamicColor.collectAsStateWithLifecycle(initialValue = false)

            val dark = when (mode) {
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
                ThemeMode.SYSTEM -> androidx.compose.foundation.isSystemInDarkTheme()
            }

            StudySphereTheme(darkTheme = dark, dynamicColor = dynamic) {
                androidx.compose.runtime.CompositionLocalProvider(
                    LocalAppPrefs provides prefs,
                    LocalNetworkMonitor provides network
                ) {
                    AppRoot(repo)
                }
            }
        }
    }
}
