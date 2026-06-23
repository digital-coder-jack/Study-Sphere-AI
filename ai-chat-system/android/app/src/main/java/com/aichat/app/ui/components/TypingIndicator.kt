package com.aichat.app.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Three animated dots shown while the assistant is streaming with no text yet. */
@Composable
fun TypingIndicator(color: Color) {
    val transition = rememberInfiniteTransition(label = "typing")
    Row {
        repeat(3) { i ->
            val alpha by transition.animateFloatAsState(
                initialValue = 0.25f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(600, delayMillis = i * 200),
                    repeatMode = RepeatMode.Reverse,
                ),
                label = "dot$i",
            )
            Spacer(Modifier.width(if (i == 0) 0.dp else 4.dp))
            androidx.compose.foundation.layout.Box(
                Modifier.size(7.dp).alpha(alpha).clip(CircleShape).background(color)
            )
        }
    }
}
