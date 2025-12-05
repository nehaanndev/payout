import { NextRequest, NextResponse } from "next/server";
import {
    getLearningPlans,
    saveLearningPlan,
} from "@/lib/orbitSummaryService";
import {
    ensureLearningRoadmap,
    generateLearningLesson,
    depthToLessons,
} from "@/lib/learningService";


export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const planId = searchParams.get("planId");
        // We can also accept a timezone or date, but let's default to server time for now or client can pass it.
        // For simplicity, we'll use server time but ideally we should respect user timezone.
        // Let's assume the client might pass 'date' (YYYY-MM-DD).
        const clientDate = searchParams.get("date");

        if (!userId || !planId) {
            return NextResponse.json({ error: "userId and planId are required" }, { status: 400 });
        }

        const plans = await getLearningPlans(userId);
        const plan = plans.find((p) => p.id === planId);

        if (!plan) {
            return NextResponse.json({ error: "Plan not found" }, { status: 404 });
        }

        // Ensure roadmap exists
        const ensuredPlan = await ensureLearningRoadmap(userId, plan);

        // Determine "today"
        // If client provided date, use it. Else use server date.
        const today = clientDate ? new Date(clientDate) : new Date();
        const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

        // Check lastLessonGeneratedAt
        const lastGeneratedStr = ensuredPlan.lastLessonGeneratedAt
            ? new Date(ensuredPlan.lastLessonGeneratedAt).toISOString().split("T")[0]
            : null;

        // Logic:
        // 1. If lastGeneratedAt is TODAY, we should return the lesson for the current day.
        //    But we don't store the *content* of the generated lesson in the plan, only in daily-summary or completedLessons.
        //    Wait, if we don't store the content, we have to regenerate it? That's wasteful.
        //    The user said: "Every time you open a dashboard... check the day... if day equals day of last card... show that card."
        //    This implies we MUST store the generated card somewhere persistent if we want to show the SAME card.
        //    Or we store it in `daily-summary` as before?
        //    The user also said: "Make sure that for every learning track, we keep a copy of the syllabus that tells which topic on which day." (We have this).

        //    If we want to be stateless regarding daily-summary, we need to store the "current active lesson" in the plan itself?
        //    Or we just regenerate it deterministically?
        //    Regenerating is expensive.

        //    Let's look at `OrbitLearningPlan`. It has `currentLesson` (number).
        //    It doesn't have `currentLessonContent`.
        //    Maybe we should add `currentLessonContent` to the plan?
        //    That would solve the caching issue perfectly.

        //    Let's assume we can add `activeLesson` to `OrbitLearningPlan`?
        //    The user didn't explicitly ask for that, but "show that card" implies persistence.
        //    I'll add `activeLesson` to the plan type as well in the next step if needed, or just use it here and let Firestore handle the extra field (it's flexible).
        //    Actually, I'll add it to the type for safety.

        //    Let's proceed assuming `activeLesson` exists on the plan.

        if (lastGeneratedStr === todayStr && ensuredPlan.activeLesson) {
            // Same day, return cached lesson
            return NextResponse.json({ lesson: ensuredPlan.activeLesson });
        }

        // If different day (or no active lesson), we generate the NEXT one.
        // But only if the user is "opening the app" (which they are, by calling this API).
        // So we increment the day.

        // Wait, if lastGenerated was yesterday, and currentLesson is 5.
        // Today we should show lesson 6?
        // Yes.
        // What if lastGenerated was today? We show lesson 5 (cached).

        // So if lastGenerated !== todayStr:
        //   nextLessonDay = currentLesson + 1
        //   Generate lesson for nextLessonDay
        //   Update plan: currentLesson = nextLessonDay, lastLessonGeneratedAt = now, activeLesson = newLesson

        // Check if we reached the end
        const totalLessons = ensuredPlan.totalLessons || depthToLessons(ensuredPlan.depth);
        let nextLessonDay = ensuredPlan.currentLesson + 1;

        // If we are just starting (currentLesson 0), next is 1.
        // If we finished (currentLesson = total), we might want to show the last one or a "completed" state?
        // Let's clamp to total.
        if (nextLessonDay > totalLessons) {
            nextLessonDay = totalLessons;
            // If we already have an active lesson for the last day, return it.
            if (ensuredPlan.activeLesson) {
                return NextResponse.json({ lesson: ensuredPlan.activeLesson });
            }
        }

        // Generate
        // We need to temporarily update the plan object to pass to generate (so it knows the correct "next" day context)
        const tempPlan = { ...ensuredPlan, currentLesson: nextLessonDay - 1 };
        // generateLearningLesson uses `plan.currentLesson + 1` to determine the day.
        // So if we want day X, we pass currentLesson = X-1.

        const newLesson = await generateLearningLesson(tempPlan);

        if (!newLesson) {
            return NextResponse.json({ error: "Failed to generate lesson" }, { status: 500 });
        }

        // Update Plan
        const now = new Date().toISOString();
        const updatedPlan = {
            ...ensuredPlan,
            currentLesson: nextLessonDay,
            lastLessonGeneratedAt: now,
            activeLesson: newLesson,
            updatedAt: now
        };

        await saveLearningPlan(userId, updatedPlan);

        return NextResponse.json({ lesson: newLesson });

    } catch (error) {
        console.error("Failed to fetch plan lesson", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
