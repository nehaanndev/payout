package com.toodl.share.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.toodl.share.ui.dashboard.DashboardScreen

@Composable
fun NavGraph(
    navController: NavHostController,
    onThemeToggle: () -> Unit,
    isDarkTheme: Boolean,
    startDestination: String = "dashboard",
    // Share Screen Params
    shareViewModel: com.toodl.share.ui.ShareViewModel? = null,
    user: com.google.firebase.auth.FirebaseUser? = null,
    signInState: com.toodl.share.ui.SignInUiState? = null,
    onSignIn: () -> Unit = {}
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable("dashboard") {
            DashboardScreen(
                onThemeToggle = onThemeToggle,
                isDarkTheme = isDarkTheme,
                user = user,
                onNavigateToFlow = { navController.navigate("flow") },
                onNavigateToOrbit = { navController.navigate("orbit") }
            )
        }

        composable("flow") {
            com.toodl.share.ui.flow.FlowScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable("orbit") {
            com.toodl.share.ui.orbit.OrbitScreen(
                onBack = { navController.popBackStack() }
            )
        }
        
        composable("login") {
            com.toodl.share.ui.login.LoginScreen(
                onSignInClick = onSignIn,
                isSigningIn = signInState?.isSigningIn == true,
                errorMessage = signInState?.errorMessage
            )
        }

        composable("share") {
            if (shareViewModel != null && signInState != null) {
                val incomingShare = shareViewModel.incomingShare.collectAsState().value
                val formState = shareViewModel.formState.collectAsState().value
                var tagsInput by rememberSaveable(formState?.tags) {
                    mutableStateOf(formState?.tags?.joinToString(", ") ?: "")
                }
                
                LaunchedEffect(formState?.tags) {
                    val canonical = formState?.tags?.joinToString(", ") ?: ""
                    if (canonical != tagsInput) {
                        tagsInput = canonical
                    }
                }

                com.toodl.share.ui.ShareScreen(
                    user = user,
                    incomingShare = incomingShare,
                    formState = formState,
                    signInState = signInState,
                    tagsInput = tagsInput,
                    onTagsInputChange = { value ->
                        tagsInput = value
                        shareViewModel.onTagsInput(value)
                    },
                    onTitleChange = shareViewModel::onTitleChange,
                    onNotesChange = shareViewModel::onNotesChange,
                    onContentTypeChange = shareViewModel::onContentTypeChange,
                    onSave = {
                        user?.uid?.let { shareViewModel.saveShare(it) }
                    },
                    onSignIn = onSignIn,
                    onShareConsumed = {
                        shareViewModel.resetAfterSaved()
                        // Navigate back or close?
                        // For now, just reset. MainActivity handles finish() if needed.
                    }
                )
            }
        }
    }
}
