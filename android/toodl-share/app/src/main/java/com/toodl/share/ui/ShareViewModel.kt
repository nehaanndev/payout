package com.toodl.share.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.toodl.share.data.ShareRepository
import com.toodl.share.data.ShareSaveRequest
import com.toodl.share.model.IncomingShare
import com.toodl.share.model.ShareFormState
import com.toodl.share.model.SharedLinkContentType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class ShareViewModel(
    private val repository: ShareRepository = ShareRepository()
) : ViewModel() {

    private val _formState = MutableStateFlow<ShareFormState?>(null)
    val formState = _formState.asStateFlow()

    private val _incomingShare = MutableStateFlow<IncomingShare?>(null)
    val incomingShare = _incomingShare.asStateFlow()

    private var currentShare: IncomingShare? = null

    fun setIncomingShare(share: IncomingShare?) {
        if (share == null) {
            currentShare = null
            _formState.value = null
            _incomingShare.value = null
            return
        }
        currentShare = share
        _incomingShare.value = share
        _formState.value = ShareFormState(
            title = share.title ?: "",
            notes = "",
            tags = emptyList(),
            contentType = SharedLinkContentType.fromUrl(share.url),
            canSave = share.url.isNotBlank()
        )
    }

    fun onTitleChange(value: String) {
        updateForm { it.copy(title = value) }
    }

    fun onNotesChange(value: String) {
        updateForm { it.copy(notes = value) }
    }

    fun onTagsInput(value: String) {
        val tags = value.split(",")
            .map { tag -> tag.trim() }
            .filter { it.isNotEmpty() }
        updateForm { it.copy(tags = tags) }
    }

    fun onContentTypeChange(value: SharedLinkContentType) {
        updateForm { it.copy(contentType = value) }
    }

    fun saveShare(userId: String) {
        val share = currentShare ?: return
        val state = _formState.value ?: return
        if (state.isSaving || !state.canSave) {
            return
        }

        viewModelScope.launch {
            _formState.update { it?.copy(isSaving = true, error = null) }
            try {
                repository.saveShare(
                    userId = userId,
                    request = ShareSaveRequest(
                        url = share.url,
                        title = state.title.ifBlank { share.title },
                        notes = state.notes.ifBlank { null },
                        tags = state.tags,
                        sourceApp = share.appPackage ?: share.appName,
                        contentType = state.contentType
                    )
                )
                _formState.update { it?.copy(isSaving = false, didSave = true) }
            } catch (error: Exception) {
                _formState.update {
                    it?.copy(
                        isSaving = false,
                        error = error.message ?: "Something went wrong"
                    )
                }
            }
        }
    }

    fun resetAfterSaved() {
        currentShare = null
        _formState.value = null
        _incomingShare.value = null
    }

    private fun updateForm(transform: (ShareFormState) -> ShareFormState) {
        val current = _formState.value ?: return
        val updated = transform(current)
        val normalized = updated.copy(
            canSave = (currentShare?.url?.isNotBlank() == true)
        )
        _formState.value = normalized
    }
}
