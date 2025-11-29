import { db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import type { UserProfile, UserTier } from "@/types/user";

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as UserProfile;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
};

export const ensureUserProfile = async (user: User): Promise<UserProfile | null> => {
    if (!user.uid) return null;

    const existingProfile = await getUserProfile(user.uid);
    if (existingProfile) {
        return existingProfile;
    }

    const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        tier: 'free', // Default tier
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    try {
        await setDoc(doc(db, "users", user.uid), {
            ...newProfile,
            createdAt: serverTimestamp(), // Use server timestamp for consistency
            updatedAt: serverTimestamp(),
        });
        return newProfile;
    } catch (error) {
        console.error("Error creating user profile:", error);
        return null;
    }
};

export const updateUserTier = async (uid: string, tier: UserTier): Promise<void> => {
    try {
        const docRef = doc(db, "users", uid);
        await setDoc(docRef, { tier, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
        console.error("Error updating user tier:", error);
        throw error;
    }
};
