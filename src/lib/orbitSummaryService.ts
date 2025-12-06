import { doc, getDoc, setDoc, serverTimestamp, increment, collection, addDoc, deleteDoc } from "firebase/firestore";
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
import { generateId } from "@/lib/id";


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

  // Sanitize quiz
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

  // Sanitize lesson fields
  const sanitizedLesson: OrbitLearningLesson = {
    title: String(lesson.title ?? topic).trim(),
    day: Number(lesson.day) || 1,
    totalDays: Number(lesson.totalDays) || Number(lesson.day) || 1,
    overview: String(lesson.overview ?? "").trim(),
    paragraphs: Array.isArray(lesson.paragraphs)
      ? lesson.paragraphs.map((p) => String(p ?? "")).filter(Boolean)
      : [],
    code: (() => {
      const lessonCode = lesson.code;
      if (!Array.isArray(lessonCode)) {
        return undefined;
      }
      return lessonCode
        .map((block) => String(block ?? ""))
        .filter((block) => Boolean(block?.trim()));
    })(),
    quiz: sanitizedQuiz.filter((item) => item.question && item.answers.length),
  };

  const now = new Date().toISOString();

  // Construct payload
  const payload: Omit<OrbitLesson, "id"> = {
    topic: topic.trim(),
    createdAt: now,
    ...sanitizedLesson,
  };

  // Sanitize entire payload before saving to remove any remaining undefineds
  const finalPayload = removeUndefined(payload);

  const ref = await addDoc(collection(db, "users", userId, "shares"), {
    url: null,
    title: finalPayload.title,
    description: finalPayload.overview,
    sourceApp: "orbit-lesson",
    platform: "web",
    contentType: "note",
    tags: [finalPayload.topic, "lesson"].filter(Boolean),
    previewImageUrl: null,
    storagePath: null,
    status: "new",
    summarizable: false,
    createdAt: now,
    updatedAt: now,
    lessonPayload: finalPayload,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });

  return { id: ref.id, ...payload } as OrbitLesson;
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

  // Sanitize payload to remove undefined values
  const sanitizedPayload = removeUndefined(payload);

  await setDoc(
    ref,
    {
      shareId: resolvedShareId,
      payload: sanitizedPayload,
      date,
      shownAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

// Helper to remove undefined values for Firestore
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  if (typeof obj === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = {};
    for (const key in obj) {
      const val = obj[key];
      if (val !== undefined) {
        result[key] = removeUndefined(val);
      }
    }
    return result;
  }
  return obj;
}

export const getLearningPlans = async (userId: string): Promise<OrbitLearningPlan[]> => {
  if (!userId) {
    return [];
  }
  const ref = learningPlanDoc(userId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return [];
  }
  const data = snapshot.data();
  // New format
  if (data.plans && Array.isArray(data.plans)) {
    return data.plans as OrbitLearningPlan[];
  }
  // Old format migration
  if (data.topic) {
    const oldPlan = data as OrbitLearningPlan;
    // Ensure it has an ID
    if (!oldPlan.id) {
      oldPlan.id = generateId();
    }
    return [oldPlan];
  }
  return [];
};

export const getLearningPlan = async (userId: string): Promise<OrbitLearningPlan | null> => {
  const plans = await getLearningPlans(userId);
  // Return the most recently updated plan, or the first one
  if (plans.length === 0) return null;
  return plans.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
};

export const saveLearningPlan = async (userId: string, plan: OrbitLearningPlan): Promise<void> => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  const ref = learningPlanDoc(userId);
  const now = new Date().toISOString();

  // Ensure plan has ID
  if (!plan.id) {
    plan.id = generateId();
  }

  const existingPlans = await getLearningPlans(userId);
  const otherPlans = existingPlans.filter(p => p.id !== plan.id && p.topic !== plan.topic);

  // Update or add the plan
  const updatedPlan = {
    ...plan,
    startedAt: plan.startedAt ?? now,
    updatedAt: now,
  };

  const newPlans = [...otherPlans, updatedPlan];

  // Sanitize plans to remove undefined values
  const sanitizedPlans = removeUndefined(newPlans);

  await setDoc(
    ref,
    {
      plans: sanitizedPlans,
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

  // We need to find which plan this lesson belongs to.
  // Since OrbitLearningLesson now has optional planId, we check that first.
  const plans = await getLearningPlans(userId);
  let planIndex = -1;

  if (lesson.planId) {
    planIndex = plans.findIndex(p => p.id === lesson.planId);
  }

  if (planIndex === -1) {
    // Fallback to heuristic match by topic
    planIndex = plans.findIndex(p => p.topic === lesson.title || p.topic === lesson.title.split(":")[0].trim());
  }

  // If still no match, we DO NOT default to index 0 anymore as that causes contamination.
  if (planIndex === -1) {
    console.warn("Could not find matching plan for lesson", lesson.title, lesson.planId);
    return;
  }

  const targetPlanIndex = planIndex;

  if (plans.length === 0) return; // No plan to record to

  const existing = plans[targetPlanIndex];
  const now = new Date().toISOString();
  const completed = existing.completedLessons ?? [];
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

  const totalLessons = existing.totalLessons ?? lesson.totalDays ?? 7;
  const currentLesson = Math.min(totalLessons, Math.max(existing.currentLesson ?? 0, lesson.day));

  const updatedPlan = {
    ...existing,
    currentLesson,
    completedLessons: nextCompleted,
    updatedAt: now,
  };

  plans[targetPlanIndex] = updatedPlan;

  const ref = learningPlanDoc(userId);
  await setDoc(
    ref,
    {
      plans,
      updatedAt: now,
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

export const deleteLearningPlan = async (userId: string, planId?: string): Promise<void> => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  const ref = learningPlanDoc(userId);

  if (!planId) {
    // Legacy behavior: delete everything
    await deleteDoc(ref);
    return;
  }

  const plans = await getLearningPlans(userId);
  const newPlans = plans.filter(p => p.id !== planId);

  if (newPlans.length === 0) {
    await deleteDoc(ref);
  } else {
    await setDoc(
      ref,
      {
        plans: newPlans,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
};
