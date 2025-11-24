package com.toodl.share.data.model

data class Group(
    val id: String = "",
    val name: String = "",
    val createdBy: String = "",
    val members: List<Member> = emptyList(),
    val expenses: List<Expense> = emptyList(),
    val createdAt: String = "",
    val lastUpdated: String = "",
    val currency: String = "USD",
    val tags: List<String> = emptyList()
)

data class Member(
    val id: String = "",
    val email: String? = null,
    val firstName: String = "",
    val authProvider: String? = null,
    val paypalMeLink: String? = null
)

data class Expense(
    val id: String = "",
    val description: String = "",
    val amount: Double = 0.0,
    val paidBy: String = "",
    val createdAt: String = "", // Date in TS, but usually string in JSON/Firebase
    val splits: Map<String, Double> = emptyMap(),
    val amountMinor: Int = 0,
    val splitsMinor: Map<String, Int> = emptyMap(),
    val tags: List<String> = emptyList()
)
