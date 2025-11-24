import { doc, getDoc, setDoc, serverTimestamp, increment, collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  UserInterests,
  DailySummary,
  OrbitInsightPreferences,
  InsightVoteDirection,
  DailySummaryPayload,
  OrbitLearningPlan,
  OrbitLearningLesson,
  OrbitLesson,
} from "@/types/orbit";


const interestsDoc = (userId: string) =>
  doc(db, "users", userId, "preferences", "orbit-interests");

const dailySummaryDoc = (userId: string, date: string) =>
  doc(db, "users", userId, "daily-summaries", date);

const insightPreferencesDoc = (userId: string) =>
  doc(db, "users", userId, "preferences", "orbit-insight-preferences");

const learningPlanDoc = (userId: string) =>
  doc(db, "users", userId, "preferences", "orbit-learning-plan");


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
      payload: data.payload ?? null,
    };
  }

  return null;
};

export const saveDailySummary = async (
  userId: string,
  date: string,
  payload: DailySummaryPayload,
  shareId?: string
): Promise<void> => {
  if (!userId || !date) {
    throw new Error("User ID and date are required");
  }

  const resolvedShareId = shareId ?? payload?.insights?.[0]?.id ?? "ai-summary";
  const ref = dailySummaryDoc(userId, date);
  await setDoc(
    ref,
    {
      shareId: resolvedShareId,
      payload,
      date,
      shownAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const getLearningPlan = async (userId: string): Promise<OrbitLearningPlan | null> => {
  if (!userId) {
    return null;
  }
  const ref = learningPlanDoc(userId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return null;
  }
  return snapshot.data() as OrbitLearningPlan;
};

export const saveLearningPlan = async (userId: string, plan: OrbitLearningPlan): Promise<void> => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  const ref = learningPlanDoc(userId);
  const now = new Date().toISOString();
  await setDoc(
    ref,
    {
      ...plan,
      startedAt: plan.startedAt ?? now,
      updatedAt: now,
    },
    { merge: true }
  );
};

export const recordLearningLesson = async (
  userId: string,
  lesson: OrbitLearningLesson
): Promise<void> => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  const ref = learningPlanDoc(userId);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? (snapshot.data() as OrbitLearningPlan) : null;
  const now = new Date().toISOString();
  const completed = existing?.completedLessons ?? [];
  const hasLesson = completed.some((item) => item.day === lesson.day);
  const nextCompleted = hasLesson
    ? completed
    : [
        ...completed,
        {
          day: lesson.day,
          title: lesson.title,
          overview: lesson.overview,
        },
      ];
  const totalLessons = existing?.totalLessons ?? lesson.totalDays ?? 7;
  const currentLesson = Math.min(totalLessons, Math.max(existing?.currentLesson ?? 0, lesson.day));
  const basePlan =
    existing ?? {
      topic: lesson.title,
      depth: "standard" as const,
      totalLessons: lesson.totalDays || 7,
      currentLesson: 0,
      startedAt: now,
      completedLessons: [],
      updatedAt: now,
    };
  await setDoc(
    ref,
    {
      ...basePlan,
      currentLesson,
      completedLessons: nextCompleted,
      updatedAt: now,
    },
    { merge: true }
  );
};

export const saveOrbitLesson = async (
  userId: string,
  lesson: OrbitLearningLesson,
  topic: string
): Promise<OrbitLesson> => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  if (!topic?.trim()) {
    throw new Error("Lesson topic is required");
  }
  const sanitizedQuiz =
    Array.isArray(lesson.quiz) && lesson.quiz.length
      ? lesson.quiz.map((item) => ({
          question: String(item.question ?? "").trim(),
          answers: Array.isArray(item.answers)
            ? item.answers.map((answer) => String(answer ?? "").trim()).filter(Boolean)
            : [],
          correctAnswer: String(item.correctAnswer ?? "").trim(),
        }))
      : [];
  const sanitizedLesson: OrbitLearningLesson = {
    title: String(lesson.title ?? topic).trim(),
    day: Number(lesson.day) || 1,
    totalDays: Number(lesson.totalDays) || Number(lesson.day) || 1,
    overview: String(lesson.overview ?? "").trim(),
    paragraphs: Array.isArray(lesson.paragraphs)
      ? lesson.paragraphs.map((p) => String(p ?? "")).filter(Boolean)
      : [],
    code: Array.isArray((lesson as OrbitLearningLesson).code)
      ? (lesson as OrbitLearningLesson).code
          .map((block) => String(block ?? ""))
          .filter((block) => Boolean(block?.trim()))
      : undefined,
    quiz: sanitizedQuiz.filter((item) => item.question && item.answers.length),
  };
  const now = new Date().toISOString();
  const payload: Omit<OrbitLesson, "id"> = {
    topic: topic.trim(),
    createdAt: now,
    ...sanitizedLesson,
  };
  const ref = await addDoc(collection(db, "users", userId, "shares"), {
    url: null,
    title: payload.title,
    description: payload.overview,
    sourceApp: "orbit-lesson",
    platform: "web",
    contentType: "note",
    tags: [payload.topic, "lesson"].filter(Boolean),
    previewImageUrl: null,
    storagePath: null,
    status: "new",
    summarizable: false,
    createdAt: now,
    updatedAt: now,
    lessonPayload: payload,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...payload };
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
