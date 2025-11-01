package com.toodl.share.data

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.toodl.share.model.SharedLinkContentType
import com.toodl.share.model.SharedLinkStatus
import kotlinx.coroutines.tasks.await
import java.time.Instant

data class ShareSaveRequest(
    val url: String,
    val title: String?,
    val notes: String?,
    val tags: List<String>,
    val sourceApp: String?,
    val platform: String = "android-share",
    val contentType: SharedLinkContentType
)

class ShareRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    suspend fun saveShare(userId: String, request: ShareSaveRequest) {
        val now = Instant.now().toString()
        val payload = mapOf(
            "url" to request.url,
            "title" to request.title,
            "description" to request.notes,
            "sourceApp" to request.sourceApp,
            "platform" to request.platform,
            "contentType" to request.contentType.wireValue,
            "tags" to request.tags,
            "previewImageUrl" to null,
            "status" to SharedLinkStatus.NEW.wireValue,
            "createdAt" to now,
            "updatedAt" to now,
            "serverCreatedAt" to FieldValue.serverTimestamp(),
            "serverUpdatedAt" to FieldValue.serverTimestamp()
        )

        firestore.collection("users")
            .document(userId)
            .collection("shares")
            .add(payload)
            .await()
    }
}

