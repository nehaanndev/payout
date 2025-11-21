import { doc, getDoc, setDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "./firebase";
import {
  UserInterests,
  DailySummary,
  OrbitInsightPreferences,
  InsightVoteDirection,
} from "@/types/orbit";


const interestsDoc = (userId: string) =>
  doc(db, "users", userId, "preferences", "orbit-interests");

const dailySummaryDoc = (userId: string, date: string) =>
  doc(db, "users", userId, "daily-summaries", date);

const insightPreferencesDoc = (userId: string) =>
  doc(db, "users", userId, "preferences", "orbit-insight-preferences");


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

export const getInsightPreferences = async (
  userId: string
): Promise<OrbitInsightPreferences | null> => {
  if (!userId) {
    return null;
  }

  const ref = insightPreferencesDoc(userId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    moreTopics: data.moreTopics ?? {},
    lessTopics: data.lessTopics ?? {},
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
};

export const recordInsightPreference = async (
  userId: string,
  topic: string,
  direction: InsightVoteDirection
): Promise<void> => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  const trimmed = topic?.trim();
  if (!trimmed) {
    throw new Error("Topic is required");
  }
  const normalized = trimmed.toLowerCase();

  const ref = insightPreferencesDoc(userId);
  const field =
    direction === "more"
      ? `moreTopics.${normalized}`
      : `lessTopics.${normalized}`;
  await setDoc(
    ref,
    {
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
      [field]: increment(1),
    },
    { merge: true }
  );
};
