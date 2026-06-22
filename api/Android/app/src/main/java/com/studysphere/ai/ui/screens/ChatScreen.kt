package com.studysphere.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.studysphere.ai.data.ChatMessage
import com.studysphere.ai.ui.ChatViewModel
import com.studysphere.ai.ui.components.AssistantAvatar
import com.studysphere.ai.ui.components.BrandLogo
import com.studysphere.ai.ui.components.TypingDots
import com.studysphere.ai.ui.theme.HairlineOutline
import com.studysphere.ai.ui.theme.Indigo
import com.studysphere.ai.ui.theme.MutedText
import com.studysphere.ai.ui.theme.Violet

private val SUGGESTIONS = listOf(
    "Explain photosynthesis simply",
    "Quiz me on world history",
    "Summarize the French Revolution",
    "Help with my calculus homework"
)

@Composable
fun ChatScreen(
    vm: ChatViewModel,
    initialChatId: Int?
) {
    val state by vm.state.collectAsState()
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(initialChatId) {
        vm.loadChats()
        if (initialChatId != null && initialChatId > 0) vm.openChat(initialChatId)
        else vm.startNewChat()
    }

    // Auto-scroll to the latest message as tokens stream in.
    LaunchedEffect(state.messages.size, state.messages.lastOrNull()?.content) {
        if (state.messages.isNotEmpty()) {
            listState.animateScrollToItem(state.messages.size - 1)
        }
    }

    Column(Modifier.fillMaxSize()) {
        // Header — branded with the official logo.
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AssistantAvatar(size = 34.dp)
            Spacer(Modifier.size(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    "Study Sphere AI",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onBackground,
                    maxLines = 1
                )
                Text(
                    if (state.streaming) "Thinking…" else state.currentTitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MutedText,
                    maxLines = 1
                )
            }
            IconButton(onClick = { vm.startNewChat() }) {
                Icon(Icons.Default.Add, contentDescription = "New chat", tint = Indigo)
            }
        }

        // Messages
        if (state.messages.isEmpty()) {
            EmptyChat(
                onSuggestion = { suggestion ->
                    vm.send(suggestion)
                }
            )
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(state.messages) { msg -> MessageRow(msg, state.streaming) }
            }
        }

        // Input bar
        Row(
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("Message Study Sphere AI…") },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(26.dp),
                maxLines = 4,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Indigo,
                    unfocusedBorderColor = HairlineOutline,
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface
                )
            )
            Spacer(Modifier.size(8.dp))
            // Filled circular send button (modern assistant feel).
            Box(
                Modifier
                    .size(50.dp)
                    .clip(CircleShape)
                    .background(if (state.streaming) Indigo.copy(alpha = 0.4f) else Indigo)
                    .clickable(enabled = !state.streaming) {
                        val text = input.trim()
                        if (text.isNotEmpty()) {
                            vm.send(text)
                            input = ""
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                if (state.streaming) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        color = Color.White, strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        Icons.AutoMirrored.Filled.Send,
                        contentDescription = "Send",
                        tint = Color.White
                    )
                }
            }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.ColumnScope.EmptyChat(onSuggestion: (String) -> Unit) {
    Box(
        Modifier
            .weight(1f)
            .fillMaxWidth()
            .padding(horizontal = 24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BrandLogo(size = 84.dp)
            Spacer(Modifier.size(14.dp))
            Text(
                "How can I help you learn today?",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(Modifier.size(6.dp))
            Text(
                "Ask anything, or try one of these:",
                style = MaterialTheme.typography.bodyMedium,
                color = MutedText
            )
            Spacer(Modifier.size(18.dp))
            // Suggestion chips
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SUGGESTIONS.forEach { suggestion ->
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f))
                            .border(1.dp, HairlineOutline.copy(alpha = 0.6f), RoundedCornerShape(14.dp))
                            .clickable { onSuggestion(suggestion) }
                            .padding(horizontal = 16.dp, vertical = 14.dp)
                    ) {
                        Text(
                            suggestion,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageRow(msg: ChatMessage, streaming: Boolean) {
    val isUser = msg.role == "user"
    if (isUser) {
        UserMessage(msg)
    } else {
        AssistantMessage(msg, streaming)
    }
}

@Composable
private fun UserMessage(msg: ChatMessage) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.End,
        verticalAlignment = Alignment.Top
    ) {
        Box(
            Modifier
                .widthIn(max = 300.dp)
                .background(
                    Indigo,
                    RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 4.dp)
                )
                .padding(14.dp)
        ) {
            Text(msg.content, color = Color.White, style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.size(8.dp))
        Box(
            Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(Violet.copy(alpha = 0.25f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Person, contentDescription = null, tint = Violet, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun AssistantMessage(msg: ChatMessage, streaming: Boolean) {
    val clipboard = LocalClipboardManager.current
    val isEmptyStreaming = msg.content.isBlank() && streaming

    Column(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AssistantAvatar(size = 30.dp)
            Spacer(Modifier.size(8.dp))
            Text(
                "Study Sphere AI",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onBackground
            )
        }
        Spacer(Modifier.size(6.dp))
        Box(
            Modifier
                .fillMaxWidth()
                .background(
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                    RoundedCornerShape(topStart = 4.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 18.dp)
                )
                .border(
                    1.dp,
                    HairlineOutline.copy(alpha = 0.5f),
                    RoundedCornerShape(topStart = 4.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 18.dp)
                )
                .padding(14.dp)
        ) {
            if (isEmptyStreaming) {
                TypingDots()
            } else {
                Text(
                    msg.content,
                    color = MaterialTheme.colorScheme.onSurface,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
        // Copy action for completed assistant replies.
        if (!isEmptyStreaming && msg.content.isNotBlank()) {
            Row(
                Modifier.padding(top = 4.dp, start = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { clipboard.setText(AnnotatedString(msg.content)) },
                    modifier = Modifier.size(30.dp)
                ) {
                    Icon(
                        Icons.Default.ContentCopy,
                        contentDescription = "Copy",
                        tint = MutedText,
                        modifier = Modifier.size(16.dp)
                    )
                }
                Text("Copy", style = MaterialTheme.typography.labelSmall, color = MutedText)
            }
        }
    }
}
