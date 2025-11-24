package com.toodl.share.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.toodl.share.data.model.Expense
import com.toodl.share.data.model.Group
import kotlinx.coroutines.tasks.await

class SplitRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {

    suspend fun getUserGroups(userId: String): List<Group> {
        // Try fetching by memberIds first
        val snapshotByIds = db.collection("groups")
            .whereArrayContains("memberIds", userId)
            .get()
            .await()
        
        if (!snapshotByIds.isEmpty) {
            return snapshotByIds.documents.mapNotNull { doc ->
                doc.toObject(Group::class.java)?.copy(id = doc.id)
            }
        }

        // Fallback: Try fetching by memberEmails (if we had the email, but userId is safer)
        // For now, assume memberIds is populated as per web app logic
        return emptyList()
    }

    suspend fun getExpenses(groupId: String): List<Expense> {
        val snapshot = db.collection("groups").document(groupId)
            .collection("expenses")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .get()
            .await()
        
        return snapshot.documents.mapNotNull { doc ->
            doc.toObject(Expense::class.java)?.copy(id = doc.id)
        }
    }
}
