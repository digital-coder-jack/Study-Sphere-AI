package com.aichat.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.aichat.app.domain.model.AiModel
import com.aichat.app.ui.chat.ChatScreen
import com.aichat.app.ui.chat.ChatViewModel
import com.aichat.app.ui.history.HistoryScreen
import com.aichat.app.ui.theme.AiChatTheme
import androidx.hilt.navigation.compose.hiltViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AiChatTheme { AppNav() } }
    }
}

@Composable
private fun AppNav() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = "history") {
        composable("history") {
            HistoryScreen(onOpenChat = { chatId -> nav.navigate("chat/$chatId") })
        }
        composable(
            route = "chat/{chatId}",
            arguments = listOf(navArgument("chatId") { type = NavType.StringType }),
        ) { entry ->
            val chatId = entry.arguments?.getString("chatId") ?: return@composable
            val vm: ChatViewModel = hiltViewModel()
            // Open the chat once; ViewModel wires up message observation.
            androidx.compose.runtime.LaunchedEffect(chatId) {
                vm.openChat(chatId, AiModel.AUTO)
            }
            ChatScreen(onOpenHistory = { nav.popBackStack() }, viewModel = vm)
        }
    }
}
