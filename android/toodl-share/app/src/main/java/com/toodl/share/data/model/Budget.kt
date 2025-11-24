package com.toodl.share.data.model

data class BudgetDocument(
    val id: String = "",
    val title: String = "",
    val ownerIds: List<String> = emptyList(),
    val memberIds: List<String> = emptyList(),
    val members: List<BudgetMember> = emptyList(),
    val shareCode: String = "",
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class BudgetMember(
    val id: String = "",
    val email: String? = null,
    val name: String? = null
)

data class BudgetMonth(
    val id: String = "",
    val month: String = "",
    val incomes: List<BudgetIncome> = emptyList(),
    val fixeds: List<BudgetFixedExpense> = emptyList(),
    val entries: List<BudgetLedgerEntry> = emptyList(),
    val savingsTarget: Double? = null,
    val createdAt: String = "",
    val updatedAt: String = "",
    val initializedFrom: String? = null
)

data class BudgetIncome(
    val id: String = "",
    val source: String = "",
    val amount: Double = 0.0
)

data class BudgetFixedExpense(
    val id: String = "",
    val name: String = "",
    val amount: Double = 0.0,
    val enabled: Boolean = true,
    val dueDay: Int? = null
)

data class BudgetLedgerEntry(
    val id: String = "",
    val amount: Double = 0.0,
    val category: String = "",
    val merchant: String? = null,
    val date: String = "",
    val isOneTime: Boolean = false,
    val tags: List<String> = emptyList()
)
