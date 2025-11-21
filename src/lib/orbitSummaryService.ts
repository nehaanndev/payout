import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { OrbitSummary, UserInterests, DailySummary } from "@/types/orbit";


const interestsDoc = (userId: string) =>
  doc(db, "users", userId, "preferences", "orbit-interests");

const dailySummaryDoc = (userId: string, date: string) =>
  doc(db, "users", userId, "daily-summaries", date);


export const getUserInterests = async (userId: string): Promise<UserInterests | null> => {
  if (!userId) {
    return null;
  }

  const ref = interestsDoc(userId);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    const data = snapshot.data();
    return {
      interests: data.interests ?? [],
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  }

  return null;
};

export const saveUserInterests = async (
  userId: string,
  interests: string[]
): Promise<void> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const ref = interestsDoc(userId);
  await setDoc(
    ref,
    {
      interests,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const getDailySummary = async (
  userId: string,
  date: string
): Promise<DailySummary | null> => {
  if (!userId || !date) {
    return null;
  }

  const ref = dailySummaryDoc(userId, date);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    const data = snapshot.data();
    return {
      shareId: data.shareId,
      date: data.date ?? date,
      shownAt: data.shownAt ?? new Date().toISOString(),
      createdAt: data.createdAt ?? new Date().toISOString(),
    };
  }

  return null;
};

export const saveDailySummary = async (
  userId: string,
  date: string,
  shareId: string
): Promise<void> => {
  if (!userId || !date || !shareId) {
    throw new Error("User ID, date, and share ID are required");
  }

  const ref = dailySummaryDoc(userId, date);
  await setDoc(
    ref,
    {
      shareId,
      date,
      shownAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

