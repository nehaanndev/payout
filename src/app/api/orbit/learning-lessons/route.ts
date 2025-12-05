
import { NextRequest, NextResponse } from "next/server";
import {
    getLearningPlans,
} from "@/lib/orbitSummaryService";
import {
    ensureLearningRoadmap,
    depthToLessons,
} from "@/lib/learningService";
import { OrbitLearningPlan } from "@/types/orbit";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const mode = searchParams.get("mode");

        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        const plans = await getLearningPlans(userId);
        const activePlans: OrbitLearningPlan[] = [];

        // Filter active plans and ensure they have a roadmap
        for (const plan of plans) {
            const ensured = await ensureLearningRoadmap(userId, plan);
            if (ensured.currentLesson < (ensured.totalLessons || depthToLessons(ensured.depth))) {
                activePlans.push(ensured);
            }
        }

        if (mode === "plans") {
            return NextResponse.json({ plans: activePlans });
        }

        // Legacy behavior (or if we want to fetch all lessons at once)
        // For now, let's just return plans if mode is not specified to be safe, 
        // or keep the old logic? 
        // The dashboard now sends mode=plans.
        // If we want to support the old behavior for backward compatibility (if any other consumer exists? likely not),
        // we can keep the old logic below.
        // But since we are refactoring, let's just return plans by default or error?
        // Let's return plans by default to be cleaner.

        return NextResponse.json({ plans: activePlans });

    } catch (error) {
        console.error("Failed to fetch learning plans", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
