package com.toodl.share

import android.app.Application
import com.google.firebase.FirebaseApp

class ToodlShareApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
    }
}

