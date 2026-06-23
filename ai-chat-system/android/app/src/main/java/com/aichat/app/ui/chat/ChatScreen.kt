package com.aichat.app.ui.chat

import android.content.Intent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ClipboardManager
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aichat.app.domain.model.ChatMessage
import com.aichat.app.ui.components.InputBar
import com.aichat.app.ui.components.MessageBubble
import com.aichat.app.ui.components.ModelSelectorSheet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    onOpenHistory: () -> Unit,
    viewModel: ChatViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    val clipboard: ClipboardManager = LocalClipboardManager.current
    val context = LocalContext.current

    var showModelSheet by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<ChatMessage?>(null) }

    // AUTO-SCROLL: whenever the last message changes (new msg or appended token),
    // scroll to the bottom so the latest content stays visible.
    val lastSignature = state.messages.lastOrNull()?.let { it.id + it.content.length }
    LaunchedEffect(lastSignature) {
        if (state.messages.isNotEmpty()) {
            listState.animateScrollToItem(state.messages.lastIndex)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.title) },
                navigationIcon = {
                    IconButton(onClick = onOpenHistory) {
                        Icon(Icons.AutoMirrored.Filled.List, "History")
                    }
                },
                actions = {
                    IconButton(onClick = { showModelSheet = true }) {
                        Icon(Icons.Default.Tune, "Model: ${state.model.label}")
                    }
                },
            )
        },
        bottomBar = {
            InputBar(
                value = state.input,
                isStreaming = state.isStreaming,
                canSend = state.canSend,
                onValueChange = viewModel::onInputChange,
                onSend = viewModel::sendMessage,
                onStop = viewModel::stopStreaming,
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            state.errorBanner?.let { msg ->
                ErrorBanner(msg, onDismiss = viewModel::dismissError)
            }
            LazyColumn(state = listState, modifier = Modifier.weight(1f)) {
                items(state.messages, key = { it.id }) { msg ->
                    MessageBubble(
                        message = msg,
                        onCopy = { clipboard.setText(AnnotatedString(msg.content)) },
                        onShare = { shareText(context, msg.content) },
                        onRegenerate = viewModel::regenerate,
                        onEdit = { editing = msg },
                    )
                }
            }
        }
    }

    if (showModelSheet) {
        ModelSelectorSheet(
            current = state.model,
            onSelect = { viewModel.selectModel(it); showModelSheet = false },
            onDismiss = { showModelSheet = false },
        )
    }

    editing?.let { msg ->
        EditDialog(
            initial = msg.content,
            onConfirm = { newText -> viewModel.editUserMessage(msg.id, newText); editing = null },
            onDismiss = { editing = null },
        )
    }
}

@Composable
private fun ErrorBanner(message: String, onDismiss: () -> Unit) {
    androidx.compose.material3.Surface(
        color = androidx.compose.material3.MaterialTheme.colorScheme.errorContainer,
        modifier = Modifier.fillMaxSize().padding(0.dp),
    ) {
        androidx.compose.foundation.layout.Row(
            Modifier.padding(12.dp),
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        ) {
            Text(message, Modifier.weight(1f))
            TextButton(onClick = onDismiss) { Text("Dismiss") }
        }
    }
}

@Composable
private fun EditDialog(initial: String, onConfirm: (String) -> Unit, onDismiss: () -> Unit) {
    var text by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit message") },
        text = { OutlinedTextField(value = text, onValueChange = { text = it }) },
        confirmButton = { TextButton(onClick = { onConfirm(text) }) { Text("Resend") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

private fun shareText(context: android.content.Context, text: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(intent, "Share message"))
}
