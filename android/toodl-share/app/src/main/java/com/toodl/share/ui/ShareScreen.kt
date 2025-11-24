package com.toodl.share.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseUser
import com.toodl.share.R
import com.toodl.share.model.IncomingShare
import com.toodl.share.model.ShareFormState
import com.toodl.share.model.SharedLinkContentType
import com.toodl.share.ui.SignInUiState

@Composable
fun ShareScreen(
    modifier: Modifier = Modifier,
    user: FirebaseUser?,
    incomingShare: IncomingShare?,
    formState: ShareFormState?,
    signInState: SignInUiState,
    tagsInput: String,
    onTagsInputChange: (String) -> Unit,
    onTitleChange: (String) -> Unit,
    onNotesChange: (String) -> Unit,
    onContentTypeChange: (SharedLinkContentType) -> Unit,
    onSave: () -> Unit,
    onSignIn: () -> Unit,
    onShareConsumed: () -> Unit
) {
    Surface(modifier = modifier.fillMaxSize()) {
        when {
            incomingShare == null -> MissingShareNotice()
            formState == null -> LoadingState()
            formState.didSave -> SavedState(onShareConsumed)
            else -> ShareForm(
                user = user,
                incomingShare = incomingShare,
                formState = formState,
                tagsInput = tagsInput,
                onTagsInputChange = onTagsInputChange,
                onTitleChange = onTitleChange,
                onNotesChange = onNotesChange,
                onContentTypeChange = onContentTypeChange,
                onSave = onSave,
                signInState = signInState,
                onSignIn = onSignIn
            )
        }
    }
}

@Composable
private fun MissingShareNotice() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = stringResource(id = R.string.share_missing_link))
    }
}

@Composable
private fun LoadingState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun SavedState(onShareConsumed: () -> Unit) {
    LaunchedEffect(Unit) {
        onShareConsumed()
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = stringResource(id = R.string.saved), fontWeight = FontWeight.SemiBold)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShareForm(
    user: FirebaseUser?,
    incomingShare: IncomingShare,
    formState: ShareFormState,
    tagsInput: String,
    onTagsInputChange: (String) -> Unit,
    onTitleChange: (String) -> Unit,
    onNotesChange: (String) -> Unit,
    onContentTypeChange: (SharedLinkContentType) -> Unit,
    onSave: () -> Unit,
    signInState: SignInUiState,
    onSignIn: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        TopAppBar(
            title = { Text(text = "Drop a link", fontWeight = FontWeight.SemiBold) },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
        )

        Text(
            text = "Paste a URL and add optional notes or tags. Anything you save lands in your Orbit queue.",
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp)
        )

        if (user == null) {
            SignInInline(signInState = signInState, onSignIn = onSignIn)
            Spacer(Modifier.height(16.dp))
        }

        SharedLinkDetailsCard(incomingShare)

        Spacer(Modifier.height(16.dp))

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = formState.title,
            onValueChange = onTitleChange,
            label = { Text(text = stringResource(id = R.string.share_title_hint)) },
            singleLine = true
        )

        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp),
            value = formState.notes,
            onValueChange = onNotesChange,
            label = { Text(text = stringResource(id = R.string.share_notes_hint)) }
        )

        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = tagsInput,
            onValueChange = onTagsInputChange,
            label = { Text(text = "Tags (comma separated)") },
            keyboardOptions = KeyboardOptions.Default.copy(keyboardType = KeyboardType.Text)
        )

        Spacer(Modifier.height(12.dp))

        Text(text = "Content type", fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(8.dp))
        ContentTypeChips(
            selected = formState.contentType,
            onContentTypeChange = onContentTypeChange
        )

        Spacer(Modifier.height(24.dp))

        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = onSave,
            enabled = formState.canSave && !formState.isSaving && user != null,
            contentPadding = PaddingValues(vertical = 12.dp)
        ) {
            if (formState.isSaving) {
                CircularProgressIndicator(
                    modifier = Modifier
                        .height(18.dp)
                        .fillMaxWidth(0.1f),
                    strokeWidth = 2.dp,
                    color = Color.White
                )
            } else {
                Text(text = stringResource(id = R.string.save_to_orbit))
            }
        }

        AnimatedVisibility(visible = formState.error != null) {
            Text(
                modifier = Modifier.padding(top = 12.dp),
                text = formState.error ?: "",
                color = MaterialTheme.colorScheme.error
            )
        }

        Spacer(Modifier.height(48.dp))
    }
}

@Composable
private fun SignInInline(
    signInState: SignInUiState,
    onSignIn: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Sign in to save to Orbit",
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "You need to sign in once to drop this link into your Orbit.",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(
                enabled = !signInState.isSigningIn,
                onClick = onSignIn,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (signInState.isSigningIn) {
                    CircularProgressIndicator(
                        modifier = Modifier
                            .height(18.dp)
                            .fillMaxWidth(0.15f),
                        strokeWidth = 2.dp,
                        color = Color.White
                    )
                } else {
                    Text(text = stringResource(id = R.string.sign_in))
                }
            }
            AnimatedVisibility(visible = signInState.errorMessage != null) {
                Text(
                    text = signInState.errorMessage.orEmpty(),
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun SharedLinkDetailsCard(incomingShare: IncomingShare) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = incomingShare.url, fontWeight = FontWeight.Medium)
            if (!incomingShare.rawText.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(text = incomingShare.rawText!!)
            }
        }
    }
}

@Composable
private fun ContentTypeChips(
    selected: SharedLinkContentType,
    onContentTypeChange: (SharedLinkContentType) -> Unit
) {
    val entries = listOf(
        SharedLinkContentType.LINK to "Link",
        SharedLinkContentType.VIDEO to "Video",
        SharedLinkContentType.ARTICLE to "Article",
        SharedLinkContentType.AUDIO to "Audio"
    )

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        entries.chunked(2).forEach { rowEntries ->
            RowOfChips(
                items = rowEntries,
                selected = selected,
                onContentTypeChange = onContentTypeChange
            )
        }
    }
}

@Composable
private fun RowOfChips(
    items: List<Pair<SharedLinkContentType, String>>,
    selected: SharedLinkContentType,
    onContentTypeChange: (SharedLinkContentType) -> Unit
) {
    androidx.compose.foundation.layout.Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items.forEach { (type, label) ->
            AssistChip(
                onClick = { onContentTypeChange(type) },
                label = { Text(label) },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = if (selected == type) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                    labelColor = if (selected == type) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                )
            )
        }
    }
}
