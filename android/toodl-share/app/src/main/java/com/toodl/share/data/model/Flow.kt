package com.toodl.share.data.model

data class FlowPlan(
    val id: String = "",
    val date: String = "",
    val timezone: String = "",
    val startTime: String = "",
    val autoScheduleEnabled: Boolean = false,
    val tasks: List<FlowTask> = emptyList(),
    val reflections: List<FlowReflection> = emptyList(),
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class FlowTask(
    val id: String = "",
    val title: String = "",
    val type: String = "flex", // priority, chore, flex
    val category: String = "work", // work, family, home, wellness, play, growth
    val estimateMinutes: Int = 0,
    val sequence: Int = 0,
    val locked: Boolean = false,
    val templateId: String? = null,
    val scheduledStart: String? = null,
    val scheduledEnd: String? = null,
    val status: String = "pending", // pending, in_progress, done, skipped, failed
    val notes: String? = null,
    val actualStart: String? = null,
    val actualEnd: String? = null,
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class FlowReflection(
    val id: String = "",
    val taskId: String? = null,
    val note: String = "",
    val sentiment: String = "neutral", // positive, neutral, challenging
    val mood: String? = null,
    val moodLabel: String? = null,
    val photoUrl: String? = null,
    val createdAt: String = ""
)
