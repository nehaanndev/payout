import "server-only";
import * as admin from "firebase-admin";

function formatPrivateKey(key: string) {
    return key.replace(/\\n/g, "\n");
}

export function getAdminApp() {
    if (!admin.apps.length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKey) {
            // If env vars are missing (e.g. during build), we can either throw or return null.
            // Returning null might break callers, but throwing breaks the build if called at top level.
            // Since this is now a function, it should only be called at runtime.
            // However, if we want to be safe during build if something calls it:
            console.warn("Firebase Admin env vars missing. Skipping initialization.");
            return null;
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: formatPrivateKey(privateKey),
            }),
        });
    }
    return admin.app();
}

export function getAdminDb() {
    const app = getAdminApp();
    if (!app) {
        // Return a mock or throw? Throwing is better for runtime, but for build...
        // If we are in a build context where this is called but not used, we might want a mock.
        // But usually runtime calls mean we need it.
        throw new Error("Firebase Admin not initialized. Check environment variables.");
    }
    return admin.firestore();
}

export function getAdminAuth() {
    const app = getAdminApp();
    if (!app) {
        throw new Error("Firebase Admin not initialized. Check environment variables.");
    }
    return admin.auth();
}
