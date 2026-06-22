package com.studysphere.ai.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Brand palette (mirrors the web app's indigo / violet / cyan gradient look).
val Indigo = Color(0xFF6D7BFF)
val Violet = Color(0xFFA855F7)
val Cyan = Color(0xFF22D3EE)

// Deep, calm space backgrounds — tuned for a premium ChatGPT/Gemini/Perplexity
// assistant feel: near-black canvas with subtly elevated surfaces.
val SpaceBg = Color(0xFF080B16)
val SpaceSurface = Color(0xFF11162A)
val SpaceCard = Color(0xFF161C33)

// Additional assistant-UI tokens (used by chat bubbles, dividers, hints).
val AssistantBubble = Color(0xFF181E36)
val HairlineOutline = Color(0xFF263052)
val MutedText = Color(0xFF9AA3C7)

private val DarkColors = darkColorScheme(
    primary = Indigo,
    onPrimary = Color.White,
    secondary = Violet,
    onSecondary = Color.White,
    tertiary = Cyan,
    onTertiary = Color(0xFF062A30),
    background = SpaceBg,
    onBackground = Color(0xFFEDEFFA),
    surface = SpaceSurface,
    onSurface = Color(0xFFEDEFFA),
    surfaceVariant = SpaceCard,
    onSurfaceVariant = MutedText,
    outline = HairlineOutline,
    outlineVariant = Color(0xFF1C2440)
)

private val LightColors = lightColorScheme(
    primary = Indigo,
    secondary = Violet,
    tertiary = Cyan,
    background = Color(0xFFF5F6FB),
    surface = Color.White,
    surfaceVariant = Color(0xFFEDEFF7),
    onSurfaceVariant = Color(0xFF4B5575),
    outline = Color(0xFFD7DBEC)
)

// Slightly tighter, more confident type scale (assistant-app feel).
private val AppTypography = Typography().run {
    copy(
        headlineMedium = headlineMedium.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
        headlineSmall = headlineSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.3).sp),
        titleLarge = titleLarge.copy(fontWeight = FontWeight.SemiBold),
        titleMedium = titleMedium.copy(fontWeight = FontWeight.SemiBold),
        bodyMedium = bodyMedium.copy(lineHeight = 22.sp)
    )
}

@Composable
fun StudySphereTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(
        colorScheme = colors,
        typography = AppTypography,
        content = content
    )
}
