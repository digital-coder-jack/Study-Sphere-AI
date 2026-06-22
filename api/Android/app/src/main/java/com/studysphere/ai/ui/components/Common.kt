package com.studysphere.ai.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.studysphere.ai.R
import com.studysphere.ai.ui.theme.Cyan
import com.studysphere.ai.ui.theme.HairlineOutline
import com.studysphere.ai.ui.theme.Indigo
import com.studysphere.ai.ui.theme.SpaceBg
import com.studysphere.ai.ui.theme.Violet

/** A subtle space gradient background used on every screen. */
@Composable
fun SpaceBackground(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(SpaceBg, Color(0xFF0C1226), SpaceBg)
                )
            )
    ) { content() }
}

/** Glassmorphism-ish card with a hairline border for the assistant-app look. */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Card(
        modifier = modifier.border(
            width = 1.dp,
            color = HairlineOutline.copy(alpha = 0.6f),
            shape = RoundedCornerShape(20.dp)
        ),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) { content() }
}

/**
 * The official Study Sphere AI logo, shown cleanly with preserved proportions.
 * Uses the uploaded brand asset (res/drawable-nodpi/ss_logo.png) — no generated
 * or alternative branding.
 */
@Composable
fun BrandLogo(
    size: Dp,
    modifier: Modifier = Modifier
) {
    Image(
        painter = painterResource(id = R.drawable.ss_logo),
        contentDescription = "Study Sphere AI",
        contentScale = ContentScale.Fit,
        modifier = modifier.size(size)
    )
}

/**
 * Circular assistant avatar that displays the official logo — used next to AI
 * replies in chat (ChatGPT/Gemini/Perplexity-style message rows).
 */
@Composable
fun AssistantAvatar(size: Dp = 30.dp, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(Indigo, Violet)))
            .border(1.dp, HairlineOutline, CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(id = R.drawable.ss_logo),
            contentDescription = "Study Sphere AI",
            contentScale = ContentScale.Fit,
            modifier = Modifier.size(size * 0.66f)
        )
    }
}

/** Animated three-dot "thinking" indicator used while the AI streams a reply. */
@Composable
fun TypingDots(color: Color = Indigo) {
    val transition = rememberInfiniteTransition(label = "typing")
    Row(verticalAlignment = Alignment.CenterVertically) {
        repeat(3) { i ->
            val alpha by transition.animateFloat(
                initialValue = 0.25f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(600, delayMillis = i * 180, easing = LinearEasing),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "dot$i"
            )
            Box(
                Modifier
                    .padding(horizontal = 2.dp)
                    .size(7.dp)
                    .alpha(alpha)
                    .clip(CircleShape)
                    .background(color)
            )
            if (i < 2) Spacer(Modifier.size(2.dp))
        }
    }
}

@Composable
fun GradientBrush(): Brush =
    Brush.horizontalGradient(listOf(Indigo, Violet, Cyan))

@Composable
fun LoadingBox(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Indigo)
    }
}

@Composable
fun ErrorBanner(message: String?) {
    AnimatedVisibility(visible = message != null) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp)
                .background(Color(0x33FB7185), RoundedCornerShape(12.dp))
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                Icons.Default.ErrorOutline,
                contentDescription = null,
                tint = Color(0xFFFB7185),
                modifier = Modifier.size(20.dp)
            )
            Text(
                message ?: "",
                color = Color(0xFFFCA5A5),
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}
