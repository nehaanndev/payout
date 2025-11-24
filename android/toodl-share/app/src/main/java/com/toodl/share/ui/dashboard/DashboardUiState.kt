package com.toodl.share.ui.dashboard

import com.toodl.share.data.model.FlowPlan
import com.toodl.share.data.model.SharedLink

data class DashboardUiState(
    val isLoading: Boolean = false,
    val flowPlan: FlowPlan? = null,
    val budgetPulse: BudgetPulseSummary? = null,
    val splitSummary: SplitSummary? = null,
    val orbitLinks: List<SharedLink> = emptyList(),
    val error: String? = null
)

data class BudgetPulseSummary(
    val remaining: Double = 0.0,
    val currency: String = "USD",
    val spent: Double = 0.0,
    val allowance: Double = 0.0
)

data class SplitSummary(
    val youOwe: Double = 0.0,
    val youAreOwed: Double = 0.0,
    val currency: String = "USD"
)
