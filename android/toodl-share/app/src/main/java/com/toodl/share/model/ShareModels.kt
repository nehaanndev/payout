package com.toodl.share.model

enum class SharedLinkContentType(val wireValue: String) {
    LINK("link"),
    VIDEO("video"),
    ARTICLE("article"),
    AUDIO("audio"),
    UNKNOWN("unknown");

    companion object {
        fun fromUrl(url: String?): SharedLinkContentType {
            val normalized = url?.lowercase()?.trim() ?: return UNKNOWN
            return when {
                normalized.contains("youtube.com") ||
                    normalized.contains("youtu.be") ||
                    normalized.contains("vimeo.com") -> VIDEO

                normalized.contains("spotify.com") ||
                    normalized.contains("music.apple.com") ||
                    normalized.contains("podcasts.apple.com") -> AUDIO

                normalized.contains("substack.com") ||
                    normalized.contains("medium.com") ||
                    normalized.contains("news") -> ARTICLE

                else -> LINK
            }
        }
    }
}

enum class SharedLinkStatus(val wireValue: String) {
    NEW("new"),
    SAVED("saved"),
    ARCHIVED("archived")
}

data class IncomingShare(
    val url: String,
    val rawText: String?,
    val title: String?,
    val appPackage: String?,
    val appName: String?
)

data class ShareFormState(
    val title: String,
    val notes: String,
    val tags: List<String>,
    val contentType: SharedLinkContentType,
    val canSave: Boolean,
    val error: String? = null,
    val isSaving: Boolean = false,
    val didSave: Boolean = false
)

