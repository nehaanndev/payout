import { NextRequest, NextResponse } from "next/server";
import { listSharedLinks } from "@/lib/shareService";
import {
  getUserInterests,
  getDailySummary,
  saveDailySummary,
  getInsightPreferences,
  getLearningPlan,
  saveLearningPlan,
  recordLearningLesson,
} from "@/lib/orbitSummaryService";
import { fetchFlowPlanSnapshot } from "@/lib/flowService";
import { getFlowDateKey } from "@/lib/flowService";
import { listBudgetsForMember, fetchBudgetMonthSnapshot } from "@/lib/budgetService";
import { getMonthKey as getBudgetMonthKey } from "@/lib/budgetService";
import type { FlowPlan } from "@/types/flow";
import type { SharedLink } from "@/types/share";
import type {
  DailySummaryPayload,
  OrbitInsightPreferences,
  OrbitInsightCard,
  WorkTaskHighlight,
  OrbitInsightType,
  OrbitLearningPlan,
  OrbitLearningLesson,
} from "@/types/orbit";

function getTodayDateKey(): string {
  const today = new Date();
  return getFlowDateKey(today);
}

function getYesterdayDateKey(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getFlowDateKey(yesterday);
}

function isMorning(): boolean {
  const hour = new Date().getHours();
  return hour < 17; // Before noon
}

const sortPreferenceTopics = (topics?: Record<string, number>) => {
  if (!topics) {
    return [];
  }
  return Object.entries(topics)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([topic]) => topic)
    .slice(0, 5);
};

type AiSummaryResponse = {
  overview?: unknown;
  recommendations?: unknown;
  insights?: unknown;
};

type AiInsightResponse = {
  id?: unknown;
  topic?: unknown;
  title?: unknown;
  summary?: unknown;
  paragraphs?: unknown;
  type?: unknown;
  referenceUrl?: unknown;
};

type AiLearningResponse = {
  lesson?: {
    title?: unknown;
    overview?: unknown;
    paragraphs?: unknown;
    quiz?: unknown;
    code?: unknown;
  };
  syllabus?: Array<{
    day?: unknown;
    title?: unknown;
    summary?: unknown;
    quizFocus?: unknown;
    code?: unknown;
  }>;
};

const depthToLessons = (depth: OrbitLearningPlan["depth"]) =>
  depth === "deep" ? 30 : depth === "standard" ? 10 : 7;

const buildFallbackSyllabus = (plan: OrbitLearningPlan): NonNullable<OrbitLearningPlan["syllabus"]> => {
  const totalLessons = plan.totalLessons || depthToLessons(plan.depth);
  return Array.from({ length: totalLessons }).map((_, index) => ({
    day: index + 1,
    title: `${plan.topic}: Part ${index + 1}`,
    summary: `Focus on aspect ${index + 1} of ${plan.topic}.`,
    quizFocus: "Recall the main idea from today.",
  }));
};

const generateLearningRoadmap = async (
  plan: OrbitLearningPlan
): Promise<NonNullable<OrbitLearningPlan["syllabus"]>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const totalLessons = plan.totalLessons || depthToLessons(plan.depth);

  if (!apiKey) {
    return buildFallbackSyllabus(plan);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You design concise micro-learning syllabi. Return JSON with a `syllabus` array where each item has day, title, summary, and quizFocus. Make every day distinct and non-repetitive.",
        },
        {
          role: "user",
          content: `Create a ${totalLessons}-day learning roadmap for "${plan.topic}" at a ${plan.depth
            } depth. Keep days additive, avoid repeating angles, and ensure difficulty progresses.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    console.error("OpenAI syllabus API error", response.status, await response.text());
    return buildFallbackSyllabus(plan);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) {
    return buildFallbackSyllabus(plan);
  }

  let parsed: AiLearningResponse | null = null;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse syllabus JSON", error, content);
  }

  const raw = Array.isArray(parsed?.syllabus) ? parsed?.syllabus : [];
  const syllabus = raw
    .slice(0, totalLessons)
    .map((item, index) => ({
      day: Number(item?.day) || index + 1,
      title: String(item?.title ?? `${plan.topic}: Part ${index + 1}`),
      summary: String(item?.summary ?? `Focus on aspect ${index + 1} of ${plan.topic}.`),
      quizFocus: item?.quizFocus ? String(item.quizFocus) : undefined,
    }))
    .filter((item) => item.title);

  if (!syllabus.length) {
    return buildFallbackSyllabus(plan);
  }

  return syllabus;
};

const ensureLearningRoadmap = async (
  userId: string,
  plan: OrbitLearningPlan
): Promise<OrbitLearningPlan> => {
  if (plan.syllabus && plan.syllabus.length >= (plan.totalLessons || depthToLessons(plan.depth))) {
    return plan;
  }
  const syllabus = await generateLearningRoadmap(plan);
  const nextPlan = {
    ...plan,
    syllabus: syllabus ?? plan.syllabus,
    totalLessons: plan.totalLessons || depthToLessons(plan.depth),
  };
  try {
    await saveLearningPlan(userId, nextPlan);
  } catch (error) {
    console.error("Failed to persist syllabus", error);
  }
  return nextPlan;
};

const buildFallbackLesson = (plan: OrbitLearningPlan): OrbitLearningLesson => {
  const totalLessons = plan.totalLessons || depthToLessons(plan.depth);
  const nextDay = Math.min((plan.currentLesson ?? 0) + 1, totalLessons);
  const focus = plan.syllabus?.find((item) => item.day === nextDay);
  return {
    title: focus?.title ?? `Learning: ${plan.topic}`,
    overview: focus?.summary ?? `Keep going on "${plan.topic}". Here is a quick refresher for today.`,
    paragraphs: [
      `You chose "${plan.topic}" as your learning track. Today is Day ${nextDay} of ${totalLessons}.`,
      focus?.summary ??
      "Take a moment to reflect on what stood out yesterday and jot one new takeaway.",
      "When you're ready, tap Save to keep this lesson in Orbit.",
    ],
    code: undefined,
    quiz: [
      {
        question: focus?.quizFocus ?? "What is one idea you learned about this topic?",
        answers: [focus?.quizFocus ?? "Write your own takeaway"],
        correctAnswer: focus?.quizFocus ?? "Write your own takeaway",
      },
    ],
    day: nextDay,
    totalDays: totalLessons,
  };
};

async function generateLearningLesson(
  plan: OrbitLearningPlan
): Promise<OrbitLearningLesson | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not configured");
    return null;
  }

  const totalLessons = plan.totalLessons || depthToLessons(plan.depth);
  const nextDay = Math.min(plan.currentLesson + 1, totalLessons);
  const pastContext = plan.completedLessons
    .sort((a, b) => a.day - b.day)
    .slice(-5)
    .map((lesson) => `Day ${lesson.day}: ${lesson.title} — ${lesson.overview}`);
  const syllabusFocus = plan.syllabus?.find((item) => item.day === nextDay);
  const upcomingFocus = plan.syllabus
    ?.filter((item) => item.day >= nextDay && item.day < nextDay + 3)
    .map((item) => `Day ${item.day}: ${item.title} — ${item.summary}`);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write concise, approachable daily lessons for a micro-learning track. Avoid repeating prior days. Use the provided syllabus focus for today. Always return JSON with one lesson and 2-3 quick quiz questions with short answers.",
        },
        {
          role: "user",
          content: `Create Day ${nextDay} of a ${plan.totalLessons}-day learning track on "${plan.topic}". Past lessons (avoid repeating them): ${pastContext.join(
            " | "
          ) || "none yet"}. Today's syllabus focus: ${syllabusFocus?.title ?? "continue the track"} — ${syllabusFocus?.summary ?? "build on the topic with a new concept"
            }. Upcoming focuses: ${upcomingFocus?.join(" | ") ?? "n/a"}.\nReturn JSON:\n{\n  "lesson": {\n    "title": "<headline for today tailored to today's focus>",\n    "overview": "<2-sentence overview>",\n    "paragraphs": ["<3-4 short paragraphs, 3 sentences max each; each paragraph should progress the idea>"],\n    "code": ["<optional preformatted snippet; include only if the topic benefits from code/config/command examples>"],\n    "quiz": [\n      {\n        "question": "<crisp question to reinforce recall>",\n        "answers": ["<brief correct answer>", "<optional distractor>", "<optional second distractor>"],\n        "correctAnswer": "<exact text of correct answer from answers>"\n      }\n    ]\n  }\n}\nTone: friendly, practical, avoid jargon. Keep within 250-300 words total. Quiz answers should be short phrases, not essays. Do not repeat prior quiz questions. Include code only when it clearly helps practice or implementation.`,
        },
      ],
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI learning API error", response.status, errorText);
    return null;
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  let parsed: AiLearningResponse | null = null;
  if (content) {
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse learning JSON", error, content);
    }
  }

  const lesson = parsed?.lesson;
  if (!lesson) {
    return null;
  }

  const paragraphs = Array.isArray(lesson.paragraphs)
    ? (lesson.paragraphs as unknown[]).map((p) => String(p)).slice(0, 4)
    : [];
  const codeBlocks = Array.isArray((lesson as Record<string, unknown>).code)
    ? ((lesson as Record<string, unknown>).code as unknown[])
      .map((block) => String(block ?? ""))
      .filter(Boolean)
      .slice(0, 3)
    : [];
  const quizRaw: Array<{
    question?: unknown;
    answers?: unknown;
    correctAnswer?: unknown;
  }> = Array.isArray(lesson.quiz) ? (lesson.quiz as Array<{
    question?: unknown;
    answers?: unknown;
    correctAnswer?: unknown;
  }>) : [];
  const quiz = quizRaw
    .slice(0, 3)
    .map((item) => ({
      question: String(item.question ?? "").trim(),
      answers: Array.isArray(item.answers)
        ? (item.answers as unknown[]).map((a) => String(a)).filter(Boolean).slice(0, 3)
        : [],
      correctAnswer: String(item.correctAnswer ?? "").trim(),
    }))
    .filter((q) => q.question && q.answers.length);

  return {
    title: String(lesson.title ?? `Lesson ${nextDay}`),
    overview: String(lesson.overview ?? ""),
    paragraphs: paragraphs.length ? paragraphs : [String(lesson.overview ?? "")],
    code: codeBlocks.length ? codeBlocks : undefined,
    quiz: quiz.length ? quiz : [],
    day: nextDay,
    totalDays: totalLessons,
  };
}

async function generatePersonalizedSummary(
  yesterdayFlow: FlowPlan | null,
  yesterdayOrbit: SharedLink[],
  yesterdayBudget: { totalSpent: number; entryCount: number } | null,
  interests: string[],
  preferences: OrbitInsightPreferences | null,
  options?: { skipInsights?: boolean }
): Promise<DailySummaryPayload> {
  const allTasks = Array.isArray(yesterdayFlow?.tasks) ? yesterdayFlow?.tasks : [];
  const workTasks = allTasks.filter((task) => task.category === "work");

  const completedWork: WorkTaskHighlight[] = workTasks
    .filter((task) => task.status === "done")
    .map((task) => ({
      title: task.title,
      status: task.status,
      note: task.notes ?? null,
    }));

  const pendingWork: WorkTaskHighlight[] = workTasks
    .filter((task) => task.status !== "done")
    .map((task) => ({
      title: task.title,
      status: task.status,
      note: task.notes ?? null,
    }));

  const fallbackOverview = completedWork.length
    ? [
      `You wrapped ${completedWork.length} work task${completedWork.length === 1 ? "" : "s"} yesterday: ${completedWork
        .map((task) => task.title)
        .slice(0, 3)
        .join(", ")}.`,
    ]
    : ["No tracked work tasks finished yesterday, so today is a clean slate to set the tone."];

  const fallbackRecommendations = pendingWork.length
    ? pendingWork.slice(0, 2).map((task) => `Kick off with “${task.title}” so it doesn’t linger another day.`)
    : ["Block one focused 45-minute sprint on your top initiative before noon."];

  const preferenceHints = {
    wantsMoreOf: sortPreferenceTopics(preferences?.moreTopics),
    wantsLessOf: sortPreferenceTopics(preferences?.lessTopics),
  };

  const orbitHighlights = yesterdayOrbit.slice(0, 5).map((share) => ({
    title: share.title,
    description: share.description,
    tags: share.tags,
    url: share.url,
  }));

  const flowSummary = yesterdayFlow
    ? {
      totalTasks: yesterdayFlow.tasks?.length ?? 0,
      completedTasks: (yesterdayFlow.tasks ?? []).filter((task) => task.status === "done").length,
      reflections: yesterdayFlow.reflections?.length ?? 0,
    }
    : null;

  const requestContext = {
    interests,
    preferenceHints,
    flowSummary,
    workTasks: {
      completed: completedWork,
      pending: pendingWork,
    },
    orbitHighlights,
    budget: yesterdayBudget,
  };

  const defaultPayload: DailySummaryPayload = {
    overview: fallbackOverview,
    recommendations: fallbackRecommendations,
    completedWork,
    pendingWork,
    insights: [
      {
        id: "focus-block",
        topic: "Deep work",
        title: "Protect a focus block",
        summary: "Reinforce the habit of defending one tight block for uninterrupted work.",
        paragraphs: [
          "Even one protected block keeps your week from dissolving into reactive work. A 45-minute sprint without notifications gives the brain the context time it craves.",
          "Try penciling that block in before lunch, when energy is still high. If you owe a teammate a deliverable, treat that window like a meeting—no slipping.",
          "Capture any loose ends that arise afterward inside Flow or Orbit so the next block starts clean.",
        ],
        type: "concept",
        referenceUrl: null,
      },
    ],
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not configured");
    return defaultPayload;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a thoughtful personal assistant that must return helpful JSON describing a daily summary, actionable recommendations, and 3–4 paragraph learning cards.",
        },
        {
          role: "user",
          content: `You are given context about a member's actual work tasks (completed + lingering), their Orbit saves, budgets, interests, and stated preferences. Using ONLY the provided work tasks, craft:\n\n{\n  "overview": [<3 paragraphs written in 2nd person summarizing yesterday's work wins and misses, referencing the provided task titles verbatim>],\n  "recommendations": [<2-3 concrete next steps for today referencing the same tasks or their projects>],\n  "insights": ${options?.skipInsights ? "[]" : "[<up to 2 insight cards as described below>]"}\n}\n\nInsight card shape (only include if insights array is allowed):\n{\n  "id": "<slug>",\n  "topic": "<short topic>",\n  "title": "<card headline>",\n  "summary": "<one sentence hook>",\n  "paragraphs": [<exactly 3 or 4 richly written paragraphs about either a new development or a fundamental concept tied to the user's interests>],\n  "type": "<\"news\" or \"concept\">",\n  "referenceUrl": "<optional source>"\n}\n\n- Mention chores or wellness only if explicitly present in the work task list (they will likely not be).\n- Keep the tone grounded, analytical, and encouraging.\n- Pull inspiration for the insights from the interest list, Orbit saves, or relevant industry progress. Respect preferences: emphasize wantsMoreOf topics and avoid repeating wantsLessOf subjects.\n- The overview must cite the provided work task titles (completed and pending) and differentiate wins vs carry-overs.\n- Recommendations must translate pending items into concrete next actions.\n- When insights are requested, return at most 2 cards. Each needs 3-4 paragraphs of 2-3 sentences each.\n\nContext JSON:\n${JSON.stringify(requestContext, null, 2)}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 900,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error", response.status, errorText);
    return defaultPayload;
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;

  let parsed: AiSummaryResponse | null = null;
  if (content) {
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse AI summary JSON", error, content);
    }
  }

  const overviewSource = Array.isArray(parsed?.overview)
    ? (parsed.overview as unknown[])
    : null;
  const overview = overviewSource
    ? overviewSource.map((paragraph) => String(paragraph))
    : parsed?.overview
      ? [String(parsed.overview)]
      : fallbackOverview;

  const recommendationsSource = Array.isArray(parsed?.recommendations)
    ? (parsed.recommendations as unknown[])
    : null;
  const recommendations = recommendationsSource
    ? recommendationsSource.map((item) => String(item))
    : fallbackRecommendations;

  const rawInsights: AiInsightResponse[] = Array.isArray(parsed?.insights)
    ? (parsed?.insights as AiInsightResponse[])
    : [];

  let insights: OrbitInsightCard[] = rawInsights
    .slice(0, 2)
    .map((raw, index) => {
      const summaryText =
        typeof raw.summary === "string" && raw.summary.length ? raw.summary : "";
      const rawParagraphs = Array.isArray(raw.paragraphs)
        ? (raw.paragraphs as unknown[])
        : null;
      const paragraphs =
        rawParagraphs && rawParagraphs.length
          ? rawParagraphs.map((paragraph) => String(paragraph))
          : summaryText
            ? [summaryText]
            : [];
      return {
        id:
          typeof raw.id === "string" && raw.id.length
            ? raw.id
            : `insight-${index}`,
        topic:
          typeof raw.topic === "string" && raw.topic.length
            ? raw.topic
            : `Insight ${index + 1}`,
        title:
          typeof raw.title === "string" && raw.title.length
            ? raw.title
            : `New development ${index + 1}`,
        summary: summaryText,
        paragraphs,
        type: (raw.type === "concept" ? "concept" : "news") as OrbitInsightType,
        referenceUrl:
          typeof raw.referenceUrl === "string" && raw.referenceUrl.length
            ? raw.referenceUrl
            : null,
      };
    })
    .filter((insight) => insight.paragraphs.length >= 3);

  if (options?.skipInsights) {
    insights = [];
  } else if (!insights.length) {
    insights = defaultPayload.insights;
  }

  return {
    overview,
    recommendations,
    completedWork,
    pendingWork,
    insights,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const dateKey = getTodayDateKey();

    const rawLearningPlan = await getLearningPlan(userId);
    const learningPlan = rawLearningPlan ? await ensureLearningRoadmap(userId, rawLearningPlan) : null;
    const learningActive =
      learningPlan &&
      learningPlan.currentLesson < (learningPlan.totalLessons || depthToLessons(learningPlan.depth));
    const existingDaily = await getDailySummary(userId, dateKey);
    if (existingDaily?.payload) {
      // If a learning plan is active but the cached payload lacks a lesson, generate one and override sparks
      // Also regenerate if the plan has been updated since the summary was created (e.g. user started a new topic)
      const planUpdatedSinceSummary =
        learningPlan &&
        existingDaily.createdAt &&
        new Date(learningPlan.updatedAt).getTime() > new Date(existingDaily.createdAt).getTime();

      if (learningActive && (!existingDaily.payload.learningLesson || planUpdatedSinceSummary)) {
        const lesson =
          (await generateLearningLesson(learningPlan)) ?? buildFallbackLesson(learningPlan);
        if (lesson) {
          const patchedSummary: DailySummaryPayload = {
            ...existingDaily.payload,
            learningLesson: lesson,
            insights: [],
          };
          await recordLearningLesson(userId, lesson);
          const summaryId = lesson.title ?? existingDaily.shareId ?? "ai-summary";
          await saveDailySummary(userId, dateKey, patchedSummary, summaryId);
          return NextResponse.json(patchedSummary);
        }
      }
      return NextResponse.json(existingDaily.payload);
    }

    // Only show daily summary in the morning
    if (!isMorning()) {
      return NextResponse.json({ message: "Daily summaries are only available in the morning" }, { status: 200 });
    }

    // Get user interests
    const interests = await getUserInterests(userId);
    const interestList = interests?.interests || [];

    // Get yesterday's data
    const yesterdayKey = getYesterdayDateKey();
    const [yesterdayFlow, allShares, budgets] = await Promise.all([
      fetchFlowPlanSnapshot(userId, yesterdayKey),
      listSharedLinks(userId, { limit: 100 }),
      listBudgetsForMember(userId),
    ]);

    // Get yesterday's Orbit links (saved yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayOrbit = allShares.filter((share) => {
      const shareDate = new Date(share.createdAt);
      return shareDate >= yesterdayStart && shareDate <= yesterdayEnd;
    });

    // Get yesterday's budget expenses
    let yesterdayBudget = null;
    if (budgets.length > 0) {
      const primary = budgets[0];
      const monthKey = getBudgetMonthKey();
      const month = await fetchBudgetMonthSnapshot(primary.id, monthKey);

      if (month?.entries) {
        const yesterdayExpenses = month.entries.filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate >= yesterdayStart && entryDate <= yesterdayEnd;
        });

        if (yesterdayExpenses.length > 0) {
          const totalSpent = yesterdayExpenses.reduce(
            (sum, entry) => sum + (Number(entry.amount) || 0),
            0
          );
          yesterdayBudget = {
            totalSpent,
            entryCount: yesterdayExpenses.length,
          };
        }
      }
    }

    const insightPreferences = await getInsightPreferences(userId);

    const learningLesson = learningActive
      ? (await generateLearningLesson(learningPlan)) ?? buildFallbackLesson(learningPlan)
      : null;

    // Generate personalized summary
    const summary = await generatePersonalizedSummary(
      yesterdayFlow,
      yesterdayOrbit,
      yesterdayBudget,
      interestList,
      insightPreferences,
      { skipInsights: Boolean(learningLesson) }
    );
    summary.learningLesson = learningLesson;
    if (learningLesson) {
      summary.insights = [];
      await recordLearningLesson(userId, learningLesson);
    }

    // Persist that we generated something today so we can avoid duplicates later
    const summaryId = summary.insights[0]?.id ?? summary.learningLesson?.title ?? "ai-summary";
    await saveDailySummary(userId, dateKey, summary, summaryId);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error getting daily summary", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
