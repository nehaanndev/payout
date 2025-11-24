package com.toodl.share.data.model

data class SharedLink(
    val id: String = "",
    val url: String? = null,
    val title: String? = null,
    val description: String? = null,
    val sourceApp: String? = null,
    val platform: String = "android-share",
    val contentType: String = "unknown", // link, video, article, etc.
    val tags: List<String> = emptyList(),
    val previewImageUrl: String? = null,
    val storagePath: String? = null,
    val status: String = "new", // new, saved, archived
    val summarizable: Boolean = false,
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class DailySummary(
    val shareId: String = "",
    val date: String = "",
    val shownAt: String = "",
    val createdAt: String = "",
    val payload: DailySummaryPayload? = null
)

data class DailySummaryPayload(
    val overview: List<String> = emptyList(),
    val recommendations: List<String> = emptyList(),
    val completedWork: List<WorkTaskHighlight> = emptyList(),
    val pendingWork: List<WorkTaskHighlight> = emptyList(),
    val insights: List<OrbitInsightCard> = emptyList()
)

data class WorkTaskHighlight(
    val title: String = "",
    val status: String = "",
    val note: String? = null
)

data class OrbitInsightCard(
    val id: String = "",
    val topic: String = "",
    val title: String = "",
    val summary: String = "",
    val paragraphs: List<String> = emptyList(),
    val type: String = "concept",
    val referenceUrl: String? = null
)
