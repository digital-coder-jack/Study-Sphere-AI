package com.aichat.app.ui.history

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(
    onOpenChat: (String) -> Unit,
    viewModel: HistoryViewModel = hiltViewModel(),
) {
    val sessions by viewModel.sessions.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Chats") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.newChat(onOpenChat) }) {
                Icon(Icons.Default.Add, "New chat")
            }
        },
    ) { padding ->
        if (sessions.isEmpty()) {
            Column(Modifier.fillMaxSize().padding(padding).padding(32.dp)) {
                Text("No chats yet. Tap + to start a new conversation.")
            }
        } else {
            LazyColumn(Modifier.padding(padding)) {
                items(sessions, key = { it.id }) { session ->
                    ListItem(
                        headlineContent = { Text(session.title) },
                        supportingContent = { Text(session.model.label) },
                        trailingContent = {
                            IconButton(onClick = { viewModel.delete(session.id) }) {
                                Icon(Icons.Default.Delete, "Delete")
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpenChat(session.id) },
                    )
                }
            }
        }
    }
}
