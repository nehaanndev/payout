import { OrbitLearningPlan, OrbitLearningLesson } from "@/types/orbit";
import { saveLearningPlan } from "@/lib/orbitSummaryService";

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

export const depthToLessons = (depth: OrbitLearningPlan["depth"]): number => {
    switch (depth) {
        case "light":
            return 7;
        case "standard":
            return 10;
        case "deep":
            return 30;
        case "expert":
            return 60;
        case "auto":
            return 14; // Fallback
        default:
            return 10;
    }
};

export const buildFallbackSyllabus = (plan: OrbitLearningPlan): NonNullable<OrbitLearningPlan["syllabus"]> => {
    const totalLessons = plan.totalLessons || depthToLessons(plan.depth);
    return Array.from({ length: totalLessons }).map((_, index) => ({
        day: index + 1,
        title: `${plan.topic}: Part ${index + 1}`,
        summary: `Focus on aspect ${index + 1} of ${plan.topic}.`,
        quizFocus: "Recall the main idea from today.",
    }));
};

export const generateLearningRoadmap = async (
    plan: OrbitLearningPlan
): Promise<NonNullable<OrbitLearningPlan["syllabus"]>> => {
    const apiKey = process.env.OPENAI_API_KEY;
    const totalLessons = plan.totalLessons || depthToLessons(plan.depth);

    if (!apiKey) {
        return buildFallbackSyllabus(plan);
    }

    // If depth is auto and totalLessons is 0 (or low), ask AI to decide duration.
    const durationPrompt = plan.depth === "auto" && (!plan.totalLessons || plan.totalLessons === 0)
        ? "Determine an appropriate duration for this topic (between 5 and 60 days) based on its complexity."
        : `Create a ${totalLessons}-day learning syllabus.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an expert curriculum designer. ${durationPrompt} For topic: "${plan.topic}".
Return a JSON object with a "syllabus" array. Each item must have:
- day: number (1 to N)
- title: string (short lesson title)
- summary: string (1 sentence overview)
- quizFocus: string (optional, what the quiz should test)
- code: string (optional, short code snippet if relevant)
Ensure the syllabus covers the topic comprehensively within the duration.`,
                },
            ],
            response_format: { type: "json_object" },
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

    if (!parsed?.syllabus || !Array.isArray(parsed.syllabus)) {
        console.error("Invalid syllabus format from OpenAI", parsed);
        return buildFallbackSyllabus(plan);
    }

    const rawSyllabus = parsed.syllabus;
    const syllabus = rawSyllabus
        .slice(0, totalLessons > 0 ? totalLessons : rawSyllabus.length)
        .map((item: unknown, index: number) => {
            const typedItem = item as { day?: unknown; title?: unknown; summary?: unknown; quizFocus?: unknown; code?: unknown };
            return {
                day: Number(typedItem?.day) || index + 1,
                title: String(typedItem?.title ?? `${plan.topic}: Part ${index + 1}`),
                summary: String(typedItem?.summary ?? "No summary provided."),
                quizFocus: typedItem?.quizFocus ? String(typedItem.quizFocus) : undefined,
                code: typedItem?.code ? String(typedItem.code) : undefined,
            };
        });

    return syllabus;
};

export const ensureLearningRoadmap = async (
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
        totalLessons: plan.totalLessons || syllabus.length || depthToLessons(plan.depth),
    };
    try {
        await saveLearningPlan(userId, nextPlan);
    } catch (error) {
        console.error("Failed to persist syllabus", error);
    }
    return nextPlan;
};

export const buildFallbackLesson = (plan: OrbitLearningPlan): OrbitLearningLesson => {
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

export async function generateLearningLesson(
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
        planId: plan.id,
    };
}
