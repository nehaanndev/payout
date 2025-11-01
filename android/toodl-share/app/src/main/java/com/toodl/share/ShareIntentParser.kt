package com.toodl.share

import android.content.Context
import android.content.Intent
import android.util.Patterns
import androidx.core.text.isDigitsOnly
import com.toodl.share.model.IncomingShare

object ShareIntentParser {
    fun parse(context: Context, intent: Intent?): IncomingShare? {
        if (intent == null) {
            return null
        }
        if (intent.action != Intent.ACTION_SEND) {
            return null
        }
        val type = intent.type ?: return null
        if (type != "text/plain") {
            return null
        }

        val rawText = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim()
        val rawSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim()

        val extractedUrl = extractUrl(rawText) ?: extractUrl(rawSubject)

        val finalUrl = extractedUrl

        if (finalUrl.isNullOrBlank()) {
            return null
        }

        val packageName = intent.`package`
        val appName = packageName?.let {
            try {
                val appInfo = context.packageManager.getApplicationInfo(it, 0)
                context.packageManager.getApplicationLabel(appInfo).toString()
            } catch (_: Exception) {
                it
            }
        }

        val title = when {
            !rawSubject.isNullOrBlank() -> rawSubject
            !rawText.isNullOrBlank() && rawText.length < 120 -> rawText
            else -> null
        }

        return IncomingShare(
            url = finalUrl.trim(),
            rawText = rawText,
            title = title,
            appPackage = intent.`package`,
            appName = appName
        )
    }

    private fun extractUrl(text: String?): String? {
        if (text.isNullOrBlank()) {
            return null
        }
        val matcher = Patterns.WEB_URL.matcher(text)
        return if (matcher.find()) {
            val candidate = matcher.group()
            if (candidate.isNullOrBlank() || candidate.isDigitsOnly()) {
                null
            } else {
                candidate
            }
        } else {
            null
        }
    }
}
