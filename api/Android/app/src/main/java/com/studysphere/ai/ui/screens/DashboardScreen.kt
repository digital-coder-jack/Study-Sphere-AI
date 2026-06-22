package com.studysphere.ai.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.studysphere.ai.data.Chat
import com.studysphere.ai.ui.DashboardViewModel
import com.studysphere.ai.ui.components.BrandLogo
import com.studysphere.ai.ui.components.ErrorBanner
import com.studysphere.ai.ui.components.GlassCard
import com.studysphere.ai.ui.components.LoadingBox
import com.studysphere.ai.ui.theme.Cyan
import com.studysphere.ai.ui.theme.Indigo
import com.studysphere.ai.ui.theme.Violet

@Composable
fun DashboardScreen(
    vm: DashboardViewModel,
    userName: String,
    onOpenChat: (Int) -> Unit,
    onNewChat: () -> Unit
) {
    val state by vm.state.collectAsState()

    if (state.loading) {
        LoadingBox()
        return
    }

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
                        "Welcome back,",
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
            item {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard("Chats", s.total_chats.toString(), Icons.Default.Chat, Indigo, Modifier.weight(1f))
                    StatCard("Messages", s.total_messages.toString(), Icons.Default.Forum, Violet, Modifier.weight(1f))
                }
            }
            item {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard("AI replies", s.ai_responses.toString(), Icons.Default.SmartToy, Cyan, Modifier.weight(1f))
                    StatCard("Notes", s.notes.toString(), Icons.Default.AutoStories, Indigo, Modifier.weight(1f))
                }
            }
            item {
                StatCard("Quizzes", s.quizzes.toString(), Icons.Default.Quiz, Violet, Modifier.fillMaxWidth())
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
                items(s.recent_chats) { chat ->
                    RecentChatRow(chat, onOpenChat)
                }
            }
        }
    }
}

@Composable
private fun StatCard(
    label: String,
    value: String,
    icon: ImageVector,
    accent: Color,
    modifier: Modifier = Modifier
) {
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
                value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun RecentChatRow(chat: Chat, onOpenChat: (Int) -> Unit) {
    GlassCard(
        Modifier
            .fillMaxWidth()
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Chat, contentDescription = null, tint = Indigo)
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
                    Text(
                        it, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            androidx.compose.material3.TextButton(onClick = { onOpenChat(chat.id) }) {
                Text("Open")
            }
        }
    }
}
