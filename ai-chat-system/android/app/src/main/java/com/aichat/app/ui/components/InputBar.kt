package com.aichat.app.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun InputBar(
    value: String,
    isStreaming: Boolean,
    canSend: Boolean,
    onValueChange: (String) -> Unit,
    onSend: () -> Unit,
    onStop: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text("Message AI Chat…") },
            maxLines = 5,
            enabled = !isStreaming,
        )
        if (isStreaming) {
            IconButton(onClick = onStop) { Icon(Icons.Default.Stop, "Stop") }
        } else {
            IconButton(onClick = onSend, enabled = canSend) {
                Icon(Icons.AutoMirrored.Filled.Send, "Send")
            }
        }
    }
}
