package com.toodl.share.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.toodl.share.data.model.FlowPlan
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FlowRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {

    suspend fun getFlowPlan(userId: String, dateKey: String): FlowPlan? {
        val docRef = db.collection("users").document(userId)
            .collection("flowPlans").document(dateKey)
        
        val snapshot = docRef.get().await()
        return if (snapshot.exists()) {
            snapshot.toObject(FlowPlan::class.java)?.copy(id = snapshot.id)
        } else {
            null
        }
    }

    fun getFlowDateKey(date: Date = Date()): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return formatter.format(date)
    }
}
