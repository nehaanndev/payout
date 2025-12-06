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
        // We prefer client date to match user timezone.
        const todayStr = clientDate || new Date().toISOString().split("T")[0]; // YYYY-MM-DD

        // Check lastLessonDate
        const lastLessonDateStr = ensuredPlan.lastLessonDate;

        // logic:
        // if the plan says we already generated a lesson for "todayStr", return it.
        // This is robust against timezone shifts because "todayStr" comes from the user's local time.

        if (lastLessonDateStr === todayStr && ensuredPlan.activeLesson) {
            // Same day, return cached lesson
            return NextResponse.json({ lesson: ensuredPlan.activeLesson });
        }

        // If different day, we simply proceed to next lesson.
        // We do NOT arbitrarily "skip" unless the logic demands it.
        // The standard flow is currentLesson + 1.

        // Wait, if users miss a day?
        // If lastLessonDate was yesterday (2023-10-01) and today is 2023-10-02, we go to next.
        // If lastLessonDate was a week ago? We still go to next (we don't skip lessons just because time passed, unless that's the desired "catch up" logic? 
        // User complaint: "lesson number jumped from 1 to 3".
        // This implies logic was advancing Lesson Number based on Date Diff?
        // Our previous logic was simple increment. 
        // Let's ensure we just increment by 1 regardless of time gap (unless completed).

        // previous logic:
        // const nextLessonDay = ensuredPlan.currentLesson + 1;

        // The issue "jumped from 1 to 3" might happen if `currentLesson` was somehow updated twice?
        // Or if the client called this endpoint multiple times with different dates?
        // With `lastLessonDate`, we are safer because we key off strict date equality.

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
            lastLessonDate: todayStr,
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
