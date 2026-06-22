package com.studysphere.ai.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.compose.material3.MaterialTheme
import android.view.HapticFeedbackConstants

/**
 * Shimmer brush used for skeleton loaders (ChatGPT/Gemini-style perceived-speed
 * loading). Applies an animated diagonal gradient sweep.
 */
fun Modifier.shimmer(): Modifier = composed {
    val base = MaterialTheme.colorScheme.surfaceContainerHigh
    val highlight = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.06f)
    val transition = rememberInfiniteTransition(label = "shimmer")
    val x by transition.animateFloat(
        initialValue = -600f,
        targetValue = 600f,
        animationSpec = infiniteRepeatable(
            animation = tween(1300),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer-x"
    )
    background(
        Brush.linearGradient(
            colors = listOf(base, highlight, base),
            start = Offset(x, 0f),
            end = Offset(x + 300f, 300f)
        )
    )
}

@Composable
fun SkeletonBox(
    modifier: Modifier = Modifier,
    cornerRadius: Int = 12
) {
    Spacer(
        modifier
            .clip(RoundedCornerShape(cornerRadius.dp))
            .shimmer()
    )
}

/** Skeleton placeholder mirroring the dashboard layout while stats load. */
@Composable
fun DashboardSkeleton(modifier: Modifier = Modifier) {
    Column(modifier.padding(16.dp)) {
        Row {
            SkeletonBox(Modifier.size(44.dp), cornerRadius = 22)
            Spacer(Modifier.size(12.dp))
            Column {
                SkeletonBox(Modifier.size(width = 120.dp, height = 14.dp))
                Spacer(Modifier.height(8.dp))
                SkeletonBox(Modifier.size(width = 180.dp, height = 22.dp))
            }
        }
        Spacer(Modifier.height(20.dp))
        repeat(3) {
            Row(Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
                SkeletonBox(Modifier.weight(1f).height(96.dp))
                Spacer(Modifier.size(12.dp))
                SkeletonBox(Modifier.weight(1f).height(96.dp))
            }
        }
        Spacer(Modifier.height(8.dp))
        SkeletonBox(Modifier.size(width = 140.dp, height = 18.dp))
        Spacer(Modifier.height(12.dp))
        repeat(3) {
            SkeletonBox(Modifier.fillMaxWidth().height(64.dp))
            Spacer(Modifier.height(10.dp))
        }
    }
}

/** Lightweight result-loading skeleton used by study tools. */
@Composable
fun TextResultSkeleton(modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) {
        SkeletonBox(Modifier.fillMaxWidth().height(16.dp))
        Spacer(Modifier.height(10.dp))
        SkeletonBox(Modifier.fillMaxWidth().height(16.dp))
        Spacer(Modifier.height(10.dp))
        SkeletonBox(Modifier.fillMaxWidth(0.7f).height(16.dp))
    }
}

/** Performs a light haptic tick — used on key taps for a tactile, native feel. */
@Composable
fun rememberHaptics(): () -> Unit {
    val view = LocalView.current
    return {
        view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
    }
}
