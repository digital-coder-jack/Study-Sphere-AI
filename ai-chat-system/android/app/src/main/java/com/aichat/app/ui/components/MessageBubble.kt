package com.aichat.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.aichat.app.domain.model.ChatMessage
import com.aichat.app.domain.model.Role

@Composable
fun MessageBubble(
    message: ChatMessage,
    onCopy: () -> Unit,
    onShare: () -> Unit,
    onRegenerate: () -> Unit,
    onEdit: () -> Unit,
) {
    val isUser = message.role == Role.USER
    val bubbleColor =
        if (isUser) MaterialTheme.colorScheme.primary
        else MaterialTheme.colorScheme.surfaceVariant
    val textColor =
        if (isUser) MaterialTheme.colorScheme.onPrimary
        else MaterialTheme.colorScheme.onSurfaceVariant

    Column(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalAlignment = if (isUser) Alignment.End else Alignment.Start,
    ) {
        Column(
            Modifier
                .widthIn(max = 320.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(bubbleColor)
                .padding(12.dp)
        ) {
            if (message.content.isEmpty() && message.streaming) {
                TypingIndicator(color = textColor)
            } else {
                Text(text = message.content, color = textColor)
            }
        }

        // Action row (only when not actively streaming this bubble).
        if (!message.streaming) {
            Row(horizontalArrangement = Arrangement.spacedBy(0.dp)) {
                IconButton(onClick = onCopy) {
                    Icon(Icons.Default.ContentCopy, "Copy", Modifier.padding(2.dp))
                }
                IconButton(onClick = onShare) {
                    Icon(Icons.Default.Share, "Share")
                }
                if (isUser) {
                    IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, "Edit") }
                } else {
                    IconButton(onClick = onRegenerate) { Icon(Icons.Default.Refresh, "Regenerate") }
                }
            }
        }
    }
}
