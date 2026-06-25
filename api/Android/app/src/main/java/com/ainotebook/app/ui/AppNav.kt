package com.ainotebook.app.ui

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Widgets
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ainotebook.app.data.Repository
import com.ainotebook.app.ui.components.OfflineBanner
import com.ainotebook.app.ui.components.SpaceBackground
import com.ainotebook.app.ui.components.rememberHaptics
import com.ainotebook.app.ui.screens.ChatScreen
import com.ainotebook.app.ui.screens.DashboardScreen
import com.ainotebook.app.ui.screens.LoginScreen
import com.ainotebook.app.ui.screens.ProfileScreen
import com.ainotebook.app.ui.screens.SignupScreen
import com.ainotebook.app.ui.screens.ToolsScreen
import com.ainotebook.app.ui.theme.Indigo
import com.ainotebook.app.ui.theme.MutedText

object Routes {
    const val LOGIN = "login"
    const val SIGNUP = "signup"
    const val DASHBOARD = "dashboard"
    const val CHAT = "chat"
    const val TOOLS = "tools"
    const val PROFILE = "profile"
}

private data class NavItem(val route: String, val label: String, val icon: ImageVector)

private val BOTTOM_ITEMS = listOf(
    NavItem(Routes.DASHBOARD, "Home", Icons.Default.Dashboard),
    NavItem(Routes.CHAT, "Chat", Icons.AutoMirrored.Filled.Chat),
    NavItem(Routes.TOOLS, "Tools", Icons.Default.Widgets),
    NavItem(Routes.PROFILE, "Profile", Icons.Default.Person),
)

@Composable
fun AppRoot(repo: Repository) {
    val factory = remember(repo) { VMFactory(repo) }
    val token by repo.tokenFlow.collectAsState(initial = null)
    val isAuthed = !token.isNullOrBlank()

    if (isAuthed) {
        MainShell(factory)
    } else {
        AuthFlow(factory)
    }
}

@Composable
private fun AuthFlow(factory: VMFactory) {
    val nav = rememberNavController()
    val authVm: AuthViewModel = viewModel(factory = factory)

    NavHost(
        navController = nav,
        startDestination = Routes.LOGIN,
        enterTransition = { slideInHorizontally(tween(300)) { it / 2 } + fadeIn(tween(300)) },
        exitTransition = { fadeOut(tween(200)) },
        popEnterTransition = { fadeIn(tween(300)) },
        popExitTransition = { slideOutHorizontally(tween(300)) { it / 2 } + fadeOut(tween(200)) }
    ) {
        composable(Routes.LOGIN) {
            LoginScreen(
                vm = authVm,
                onLoggedIn = { /* token flow flips AppRoot to MainShell */ },
                onGoSignup = { nav.navigate(Routes.SIGNUP) }
            )
        }
        composable(Routes.SIGNUP) {
            SignupScreen(
                vm = authVm,
                onSignedUp = { },
                onGoLogin = { nav.popBackStack() }
            )
        }
    }
}

@Composable
private fun MainShell(factory: VMFactory) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val current = backStack?.destination?.route
    val haptic = rememberHaptics()

    val dashboardVm: DashboardViewModel = viewModel(factory = factory)
    val chatVm: ChatViewModel = viewModel(factory = factory)
    val toolsVm: ToolsViewModel = viewModel(factory = factory)
    val profileVm: ProfileViewModel = viewModel(factory = factory)

    val userState by profileVm.state.collectAsState()
    val networkMonitor = LocalNetworkMonitor.current
    val isOnline by networkMonitor.isOnline.collectAsState(initial = networkMonitor.currentlyOnline())

    SpaceBackground {
        Scaffold(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            bottomBar = {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f),
                    tonalElevation = 0.dp
                ) {
                    BOTTOM_ITEMS.forEach { item ->
                        val selected = current?.startsWith(item.route) == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                if (!selected) {
                                    haptic()
                                    nav.navigate(item.route) {
                                        popUpTo(Routes.DASHBOARD) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = {
                                Text(
                                    item.label,
                                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Indigo,
                                selectedTextColor = Indigo,
                                unselectedIconColor = MutedText,
                                unselectedTextColor = MutedText,
                                indicatorColor = Indigo.copy(alpha = 0.16f)
                            )
                        )
                    }
                }
            }
        ) { padding ->
            Column(Modifier.padding(padding)) {
                OfflineBanner(isOnline = isOnline)
                NavHost(
                    navController = nav,
                    startDestination = Routes.DASHBOARD,
                    enterTransition = { fadeIn(tween(220)) + slideInHorizontally(tween(260)) { it / 6 } },
                    exitTransition = { fadeOut(tween(160)) },
                    popEnterTransition = { fadeIn(tween(220)) },
                    popExitTransition = { fadeOut(tween(160)) }
                ) {
                    composable(Routes.DASHBOARD) {
                        DashboardScreen(
                            vm = dashboardVm,
                            userName = userState.user?.name ?: "",
                            onOpenChat = { id -> nav.navigate("${Routes.CHAT}?chatId=$id") },
                            onNewChat = {
                                nav.navigate(Routes.CHAT) {
                                    popUpTo(Routes.DASHBOARD) { saveState = true }
                                    launchSingleTop = true
                                }
                            },
                            onOpenTools = {
                                nav.navigate(Routes.TOOLS) {
                                    popUpTo(Routes.DASHBOARD) { saveState = true }
                                    launchSingleTop = true
                                }
                            }
                        )
                    }
                    composable(
                        route = "${Routes.CHAT}?chatId={chatId}",
                        arguments = listOf(navArgument("chatId") {
                            type = NavType.IntType; defaultValue = -1
                        })
                    ) { entry ->
                        val chatId = entry.arguments?.getInt("chatId") ?: -1
                        ChatScreen(vm = chatVm, initialChatId = if (chatId > 0) chatId else null)
                    }
                    composable(Routes.CHAT) {
                        ChatScreen(vm = chatVm, initialChatId = null)
                    }
                    composable(Routes.TOOLS) {
                        ToolsScreen(vm = toolsVm)
                    }
                    composable(Routes.PROFILE) {
                        ProfileScreen(
                            vm = profileVm,
                            onLoggedOut = { /* token flow flips AppRoot to AuthFlow */ }
                        )
                    }
                }
            }
        }
    }
}
