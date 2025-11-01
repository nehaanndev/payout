# Toodl Share Android Companion

This module is a standalone Android app that acts as the share target for the Toodl platform. It accepts links from the Android Sharesheet and stores them in the signed-in user's `users/{uid}/shares` subcollection in Firestore.

## Key features
- Share target that accepts `text/plain` Intents with URLs from any app.
- Firebase Authentication (Google provider) so links are stored per user.
- Firestore persistence that matches the web `shareService` schema.
- Minimal Compose UI to review the link, edit metadata, and save.

## Getting started
1. Open the `android/toodl-share` directory in Android Studio (Hedgehog or newer).
2. Use *File → Sync Project with Gradle Files*; Android Studio will install the Android Gradle Plugin if needed.
3. Add your Firebase `google-services.json` for the same Firebase project used by the web app:
   - In the Firebase console create an Android app with package id `com.toodl.share`.
   - Download `google-services.json`.
   - Place it under `android/toodl-share/app/google-services.json` (do **not** commit secrets).
4. Ensure the `SHA` fingerprints required by Google Sign-In are registered in Firebase.
5. Run the app on a device/emulator. Share a link from Chrome/YouTube to "Toodl Share".

## Notes
- The project uses Compose Material 3, Kotlin Coroutines, and the Firebase BOM.
- For production hardenings (offline queueing, richer metadata scraping, Crashlytics) extend the repository layer in `ShareRepository.kt`.
- Update Firestore security rules to allow authenticated users to write/read their own `shares` subcollection.
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/shares/{shareId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```
