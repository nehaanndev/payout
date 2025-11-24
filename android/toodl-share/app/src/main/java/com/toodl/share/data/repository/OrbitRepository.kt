package com.toodl.share.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.toodl.share.data.model.SharedLink
import kotlinx.coroutines.tasks.await

class OrbitRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {

    suspend fun getSharedLinks(userId: String): List<SharedLink> {
        val snapshot = db.collection("users").document(userId)
            .collection("sharedLinks")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .get()
            .await()
        
        return snapshot.documents.mapNotNull { doc ->
            doc.toObject(SharedLink::class.java)?.copy(id = doc.id)
        }
    }
}
