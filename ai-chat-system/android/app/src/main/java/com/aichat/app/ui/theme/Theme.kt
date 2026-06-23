package com.aichat.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Light = lightColorScheme(
    primary = Color(0xFF10A37F),
    onPrimary = Color.White,
)
private val Dark = darkColorScheme(
    primary = Color(0xFF10A37F),
    onPrimary = Color.White,
)

@Composable
fun AiChatTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) Dark else Light,
        content = content,
    )
}
