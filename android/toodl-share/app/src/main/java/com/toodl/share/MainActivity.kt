package com.toodl.share

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.toodl.share.ui.ShareViewModel
import com.toodl.share.ui.SignInUiState
import com.toodl.share.ui.navigation.NavGraph
import com.toodl.share.ui.theme.ToodlShareTheme
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class MainActivity : ComponentActivity() {

    private val shareViewModel: ShareViewModel by viewModels()
    private val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }
    private lateinit var googleSignInClient: GoogleSignInClient
    private var signInUiState by mutableStateOf(SignInUiState())
    private var authStateListener: FirebaseAuth.AuthStateListener? = null

    private val signInLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            handleGoogleSignIn(data)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        googleSignInClient = GoogleSignIn.getClient(this, googleSignInOptions())
        
        authStateListener = FirebaseAuth.AuthStateListener { firebaseAuth ->
            signInUiState = signInUiState.copy(
                isSigningIn = false,
                errorMessage = null
            )
        }.also { auth.addAuthStateListener(it) }

        lifecycleScope.launch { restorePreviousSignInIfPossible() }
        processIncoming(intent)

        setContent {
            val systemDark = isSystemInDarkTheme()
            var isDarkTheme by remember { mutableStateOf(systemDark) }
            val user = rememberFirebaseUser(auth)
            val incomingShare by shareViewModel.incomingShare.collectAsState()
            
            // Determine start destination
            val startDestination = if (incomingShare != null) "share" else "dashboard"

            ToodlShareTheme(darkTheme = isDarkTheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    
                    // Navigate to share if incoming share arrives while app is open
                    LaunchedEffect(incomingShare) {
                        if (incomingShare != null) {
                            navController.navigate("share")
                        }
                    }

                    NavGraph(
                        navController = navController,
                        onThemeToggle = { isDarkTheme = !isDarkTheme },
                        isDarkTheme = isDarkTheme,
                        startDestination = startDestination,
                        shareViewModel = shareViewModel,
                        user = user,
                        signInState = signInUiState,
                        onSignIn = {
                            signInUiState = SignInUiState(isSigningIn = true, errorMessage = null)
                            startGoogleSignIn()
                        }
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) {
            setIntent(intent)
        }
        processIncoming(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        authStateListener?.let { auth.removeAuthStateListener(it) }
    }

    private fun processIncoming(intent: Intent?) {
        val share = ShareIntentParser.parse(this, intent)
        shareViewModel.setIncomingShare(share)
    }

    private fun startGoogleSignIn() {
        val intent = googleSignInClient.signInIntent
        signInLauncher.launch(intent)
    }

    private fun handleGoogleSignIn(data: Intent?) {
        try {
            signInUiState = signInUiState.copy(isSigningIn = true, errorMessage = null)
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.getResult(ApiException::class.java)
            lifecycleScope.launch {
                try {
                    signInWithGoogleAccount(account)
                    signInUiState = SignInUiState()
                } catch (error: Exception) {
                    signInUiState = SignInUiState(
                        isSigningIn = false,
                        errorMessage = error.localizedMessage ?: "Could not sign in."
                    )
                }
            }
        } catch (error: Exception) {
            signInUiState = SignInUiState(
                isSigningIn = false,
                errorMessage = "Google sign-in failed. Please try again."
            )
        }
    }

    private fun googleSignInOptions(): GoogleSignInOptions =
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build()

    private suspend fun restorePreviousSignInIfPossible() {
        if (auth.currentUser != null) return
        signInUiState = signInUiState.copy(isSigningIn = true, errorMessage = null)
        try {
            val account = GoogleSignIn.getLastSignedInAccount(this)
                ?: googleSignInClient.silentSignIn().await()

            if (account != null && !account.idToken.isNullOrBlank()) {
                signInWithGoogleAccount(account)
            }
            signInUiState = SignInUiState()
        } catch (error: Exception) {
            signInUiState = SignInUiState(isSigningIn = false, errorMessage = null)
        }
    }

    private suspend fun signInWithGoogleAccount(account: GoogleSignInAccount) {
        val idToken = account.idToken
            ?: throw IllegalStateException("Missing ID token from Google.")
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential).await()
    }
}

@Composable
private fun rememberFirebaseUser(auth: FirebaseAuth): FirebaseUser? {
    val state = remember { mutableStateOf(auth.currentUser) }
    DisposableEffect(auth) {
        val listener = FirebaseAuth.AuthStateListener { firebaseAuth ->
            state.value = firebaseAuth.currentUser
        }
        auth.addAuthStateListener(listener)
        onDispose {
            auth.removeAuthStateListener(listener)
        }
    }
    return state.value
}
