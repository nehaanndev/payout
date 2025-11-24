package com.toodl.share.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.toodl.share.data.model.BudgetDocument
import com.toodl.share.data.model.BudgetMonth
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class BudgetRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {

    suspend fun listBudgetsForMember(userId: String): List<BudgetDocument> {
        val snapshot = db.collection("budgets")
            .whereArrayContains("memberIds", userId)
            .get()
            .await()
        
        return snapshot.documents.mapNotNull { doc ->
            doc.toObject(BudgetDocument::class.java)?.copy(id = doc.id)
        }
    }

    suspend fun getBudgetMonth(budgetId: String, monthKey: String): BudgetMonth? {
        val docRef = db.collection("budgets").document(budgetId)
            .collection("months").document(monthKey)
        
        val snapshot = docRef.get().await()
        return if (snapshot.exists()) {
            snapshot.toObject(BudgetMonth::class.java)?.copy(id = snapshot.id)
        } else {
            null
        }
    }

    fun getBudgetMonthKey(date: Date = Date()): String {
        val formatter = SimpleDateFormat("yyyy-MM", Locale.US)
        return formatter.format(date)
    }
}
