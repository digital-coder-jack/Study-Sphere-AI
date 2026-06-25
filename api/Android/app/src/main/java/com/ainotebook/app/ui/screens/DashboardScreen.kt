package com.ainotebook.app.ui.screens

import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Widgets
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ainotebook.app.data.Chat
import com.ainotebook.app.data.Stats
import com.ainotebook.app.ui.DashboardViewModel
import com.ainotebook.app.ui.components.BrandLogo
import com.ainotebook.app.ui.components.DashboardSkeleton
import com.ainotebook.app.ui.components.ErrorBanner
import com.ainotebook.app.ui.components.GlassCard
import com.ainotebook.app.ui.components.rememberHaptics
import com.ainotebook.app.ui.theme.Cyan
import com.ainotebook.app.ui.theme.Indigo
import com.ainotebook.app.ui.theme.MutedText
import com.ainotebook.app.ui.theme.Violet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    vm: DashboardViewModel,
    userName: String,
    onOpenChat: (Int) -> Unit,
    onNewChat: () -> Unit,
    onOpenTools: () -> Unit
) {
    val state by vm.state.collectAsState()
    val haptic = rememberHaptics()

    if (state.loading && state.stats == null) {
        DashboardSkeleton(Modifier.fillMaxSize())
        return
    }

    val pullState = rememberPullToRefreshState()
    if (pullState.isRefreshing) {
        LaunchedEffect(true) {
            haptic()
            vm.load()
        }
    }
    // End the indicator animation once the load completes.
    LaunchedEffect(state.loading) {
        if (!state.loading) pullState.endRefresh()
    }

    Box(Modifier.fillMaxSize().nestedScroll(pullState.nestedScrollConnection)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BrandLogo(size = 44.dp)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            greeting(),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            userName.ifBlank { "Explorer" },
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                ErrorBanner(state.error)
            }

            val s = state.stats
            if (s != null) {
                item { InsightBanner(s, onNewChat) }

                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard("Chats", s.total_chats, Icons.AutoMirrored.Filled.Chat, Indigo, Modifier.weight(1f))
                        StatCard("Messages", s.total_messages, Icons.Default.Forum, Violet, Modifier.weight(1f))
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard("AI replies", s.ai_responses, Icons.Default.SmartToy, Cyan, Modifier.weight(1f))
                        StatCard("Notes", s.notes, Icons.Default.AutoStories, Indigo, Modifier.weight(1f))
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard("Quizzes", s.quizzes, Icons.Default.Quiz, Violet, Modifier.weight(1f))
                        QuickActionCard(onOpenTools, Modifier.weight(1f))
                    }
                }

                if (s.daily_activity.isNotEmpty()) {
                    item {
                        Text(
                            "Activity this week",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                    }
                    item { ActivityChart(s.daily_activity.map { it.day to it.count }) }
                }

                item {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Recent chats",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                }

                if (s.recent_chats.isEmpty()) {
                    item {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(20.dp)) {
                                Text(
                                    "No chats yet. Start your first conversation!",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                } else {
                    items(s.recent_chats) { chat -> RecentChatRow(chat, onOpenChat) }
                }
            }
        }

        PullToRefreshContainer(
            state = pullState,
            modifier = Modifier.align(Alignment.TopCenter)
        )
    }
}

private fun greeting(): String {
    val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    return when (hour) {
        in 5..11 -> "Good morning,"
        in 12..17 -> "Good afternoon,"
        else -> "Good evening,"
    }
}

@Composable
private fun InsightBanner(s: Stats, onNewChat: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(listOf(Indigo, Violet)))
            .clickable(onClick = onNewChat)
            .padding(18.dp)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Bolt, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    "Keep your streak going",
                    color = Color.White,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(
                insightText(s),
                color = Color.White.copy(alpha = 0.9f),
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(10.dp))
            Box(
                Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White.copy(alpha = 0.2f))
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text("Start a new chat →", color = Color.White, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

private fun insightText(s: Stats): String = when {
    s.total_chats == 0 -> "Ask your first question and I'll help you learn anything."
    s.ai_responses >= 50 -> "You've had ${s.ai_responses} AI replies — you're on a roll!"
    s.quizzes > 0 -> "Great work — you've completed ${s.quizzes} quizzes so far."
    else -> "You've started ${s.total_chats} chats. Ready to explore more?"
}

@Composable
private fun StatCard(
    label: String,
    value: Int,
    icon: ImageVector,
    accent: Color,
    modifier: Modifier = Modifier
) {
    // Count-up animation for a lively, premium feel.
    val animated by animateIntAsState(targetValue = value, animationSpec = tween(900), label = "stat-$label")
    GlassCard(modifier) {
        Column(Modifier.padding(16.dp)) {
            Box(
                Modifier
                    .size(40.dp)
                    .background(accent.copy(alpha = 0.18f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.height(10.dp))
            Text(
                animated.toString(),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun QuickActionCard(onOpenTools: () -> Unit, modifier: Modifier = Modifier) {
    GlassCard(modifier.clickable(onClick = onOpenTools)) {
        Column(Modifier.padding(16.dp)) {
            Box(
                Modifier
                    .size(40.dp)
                    .background(Cyan.copy(alpha = 0.18f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Widgets, contentDescription = null, tint = Cyan, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.height(10.dp))
            Text("Study Tools", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            Text("Notes, quizzes & more", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Minimal native bar chart for weekly activity (no external chart deps). */
@Composable
private fun ActivityChart(data: List<Pair<String, Int>>) {
    val max = (data.maxOfOrNull { it.second } ?: 0).coerceAtLeast(1)
    GlassCard(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .height(140.dp)
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            data.takeLast(7).forEach { (day, count) ->
                val fraction = count.toFloat() / max
                Column(
                    Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Bottom
                ) {
                    val animated by animateIntAsState(count, tween(800), label = "bar-$day")
                    Text(animated.toString(), style = MaterialTheme.typography.labelSmall, color = MutedText)
                    Spacer(Modifier.height(4.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height((90 * fraction).dp.coerceAtLeast(4.dp))
                            .clip(RoundedCornerShape(6.dp))
                            .background(Brush.verticalGradient(listOf(Indigo, Violet)))
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(day.take(3), style = MaterialTheme.typography.labelSmall, color = MutedText)
                }
            }
        }
    }
}

@Composable
private fun RecentChatRow(chat: Chat, onOpenChat: (Int) -> Unit) {
    GlassCard(Modifier.fillMaxWidth().clickable { onOpenChat(chat.id) }) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Indigo.copy(alpha = 0.16f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, tint = Indigo, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    chat.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1
                )
                chat.updated_at?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                }
            }
        }
    }
}
