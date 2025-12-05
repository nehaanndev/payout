import { db } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { sendInviteEmail } from "./emailService";
import { getAdminDb } from "./firebaseAdmin";

export const generateInvite = async (email: string) => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const inviteRef = doc(db, "invites", code);

    const inviteData = {
        code,
        email,
        createdAt: serverTimestamp(),
        redeemedAt: null,
        redeemedBy: null,
        durationDays: 365,
    };

    await setDoc(inviteRef, inviteData);
    await sendInviteEmail(email, code);
    return code;
};

export const redeemInvite = async (code: string, userId: string) => {
    // Use Admin SDK for redemption to ensure security and bypass rules if needed, 
    // but client SDK is fine if rules allow. Let's use Admin SDK for consistency with other sensitive ops if possible,
    // but here we are in 'lib' which might be used by client or server. 
    // Actually, this service is likely to be called from a server action or API route.
    // Let's assume server-side usage for safety.

    const adminDb = getAdminDb();
    const inviteRef = adminDb.collection("invites").doc(code);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
        throw new Error("Invalid code");
    }

    const invite = inviteSnap.data();
    if (invite?.redeemedAt) {
        throw new Error("Code already redeemed");
    }

    // Update invite status
    await inviteRef.update({
        redeemedAt: new Date().toISOString(), // Use ISO string for Admin SDK consistency or admin.firestore.FieldValue.serverTimestamp()
        redeemedBy: userId,
    });

    // Update user
    const userRef = adminDb.collection("users").doc(userId);
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    await userRef.set({
        tier: 'plus',
        stripeSubscriptionStatus: 'manual_invite',
        stripeCurrentPeriodEnd: oneYearLater.toISOString(),
        updatedAt: now.toISOString(),
    }, { merge: true });

    return true;
};
