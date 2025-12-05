import { useState, useEffect } from "react";
import { OrbitLearningLesson, OrbitLearningPlan } from "@/types/orbit";
import { LearningLessonCard } from "./LearningLessonCard";
import { Skeleton } from "@/components/ui/skeleton";

interface LearningCardLoaderProps {
    plan: OrbitLearningPlan;
    isNight: boolean;
    userId?: string;
    isVisible: boolean;
}

export function LearningCardLoader({ plan, isNight, userId, isVisible }: LearningCardLoaderProps) {
    const [lesson, setLesson] = useState<OrbitLearningLesson | null>(plan.activeLesson ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);

    useEffect(() => {
        // If we already have a lesson (passed from plan), we might not need to fetch unless we want to ensure freshness?
        // But the plan passed in might be stale if we don't re-fetch.
        // However, the plan object itself comes from the dashboard fetch.
        // If the plan has an activeLesson, use it initially.

        if (!isVisible || hasFetched) return;

        // If we have an active lesson and it looks "fresh" (checked by parent logic? no, parent just passes plan),
        // maybe we can skip fetch?
        // But the requirement is: "Every time you open a dashboard... check the day... if day equals day of last card... show that card. Else... generate next."
        // The API handles this logic. So we MUST hit the API to ensure the "day check" happens.
        // UNLESS the plan object *already* has the correct lesson for today because the dashboard fetched it?
        // The dashboard only fetches the *list of plans*. It likely fetches the plan document from Firestore.
        // If the plan document has `activeLesson` and `lastLessonGeneratedAt` was today, then we technically have the data.
        // BUT, if it's a new day, the plan doc won't know until we hit the API to trigger the update.

        // So:
        // 1. Check client-side if plan.lastLessonGeneratedAt is today.
        // 2. If yes, and plan.activeLesson exists, just use it! No API call needed (saves tokens/latency).
        // 3. If no (or different day), call API.

        const checkAndFetch = async () => {
            const todayStr = new Date().toISOString().split("T")[0];
            const lastGenStr = plan.lastLessonGeneratedAt ? new Date(plan.lastLessonGeneratedAt).toISOString().split("T")[0] : null;

            if (lastGenStr === todayStr && plan.activeLesson) {
                setLesson(plan.activeLesson);
                setHasFetched(true);
                return;
            }

            setLoading(true);
            try {
                const res = await fetch(`/api/orbit/plan-lesson?userId=${userId}&planId=${plan.id}&date=${todayStr}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.lesson) {
                        setLesson(data.lesson);
                    }
                } else {
                    setError("Failed to load lesson");
                }
            } catch {
                setError("Error loading lesson");
            } finally {
                setLoading(false);
                setHasFetched(true);
            }
        };

        checkAndFetch();

    }, [isVisible, hasFetched, plan, userId]);

    if (loading) {
        return (
            <div className="h-[400px] w-full rounded-[32px] bg-white/5 p-6 animate-pulse">
                <Skeleton className="h-8 w-3/4 mb-4 bg-white/10" />
                <Skeleton className="h-4 w-full mb-2 bg-white/10" />
                <Skeleton className="h-4 w-5/6 mb-6 bg-white/10" />
                <Skeleton className="h-32 w-full rounded-xl bg-white/10" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-[400px] w-full items-center justify-center rounded-[32px] bg-red-50/10 text-red-400">
                <p>Unable to load lesson.</p>
            </div>
        );
    }

    if (!lesson) {
        return null; // Should not happen if API works
    }

    return (
        <LearningLessonCard
            lesson={lesson}
            isNight={isNight}
            planId={plan.id}
            userId={userId}
        />
    );
}
