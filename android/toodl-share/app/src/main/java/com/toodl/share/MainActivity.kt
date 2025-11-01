package com.toodl.share

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.toodl.share.ui.ShareScreen
import com.toodl.share.ui.ShareViewModel
import com.toodl.share.ui.theme.ToodlShareTheme
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class MainActivity : ComponentActivity() {

    private val shareViewModel: ShareViewModel by viewModels()
    private val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }
    private lateinit var googleSignInClient: GoogleSignInClient

    private val signInLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            handleGoogleSignIn(data)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        googleSignInClient = GoogleSignIn.getClient(this, googleSignInOptions())
        processIncoming(intent)
        setContent {
            val user = rememberFirebaseUser(auth)
            val incomingShare by shareViewModel.incomingShare.collectAsState()
            val formState by shareViewModel.formState.collectAsState()

            var tagsInput by rememberSaveable(formState?.tags) {
                mutableStateOf(formState?.tags?.joinToString(", ") ?: "")
            }

            LaunchedEffect(formState?.tags) {
                val canonical = formState?.tags?.joinToString(", ") ?: ""
                if (canonical != tagsInput) {
                    tagsInput = canonical
                }
            }

            ToodlShareTheme {
                ShareScreen(
                    user = user,
                    incomingShare = incomingShare,
                    formState = formState,
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
                    onSignIn = ::startGoogleSignIn,
                    onShareConsumed = {
                        shareViewModel.resetAfterSaved()
                        setResult(RESULT_OK)
                        finish()
                    }
                )
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
            val account = GoogleSignIn.getSignedInAccountFromIntent(data).getResult(ApiException::class.java)
            val credential = GoogleAuthProvider.getCredential(account.idToken, null)
            lifecycleScope.launch {
                auth.signInWithCredential(credential).await()
            }
        } catch (error: Exception) {
            // For now we rely on UI state to prompt retry.
        }
    }

    private fun googleSignInOptions(): GoogleSignInOptions =
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build()
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
