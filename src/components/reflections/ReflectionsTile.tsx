"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { Smile, ArrowRight, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { getFlowPlansInRange, getFlowDateKey } from "@/lib/flowService";
import { useToodlTheme } from "@/hooks/useToodlTheme";
import { cn } from "@/lib/utils";
import type { FlowPlan } from "@/types/flow";
import type { User } from "firebase/auth";

type ReflectionsTileProps = {
    user: User | null;
    onOpenExperience: () => void;
};

export function ReflectionsTile({ user, onOpenExperience }: ReflectionsTileProps) {
    const { isNight } = useToodlTheme();
    const [loading, setLoading] = useState(true);
    const [recentPlans, setRecentPlans] = useState<FlowPlan[]>([]);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchRecent = async () => {
            try {
                const endDate = getFlowDateKey(new Date());
                const startDate = getFlowDateKey(subDays(new Date(), 6)); // Past 7 days
                const fetchedPlans = await getFlowPlansInRange(user.uid, startDate, endDate);
                // Sort by date descending
                fetchedPlans.sort((a, b) => b.date.localeCompare(a.date));
                setRecentPlans(fetchedPlans);
            } catch (error) {
                console.error("Error fetching recent reflections:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecent();
    }, [user]);

    const latestReflection = recentPlans.flatMap(p => p.reflections)[0];
    const reflectionCount = recentPlans.reduce((acc, p) => acc + p.reflections.length, 0);

    if (!user) return null;

    return (
        <Card className={cn("h-full flex flex-col overflow-hidden transition-all hover:shadow-md", isNight ? "bg-slate-900 border-slate-800" : "bg-white")}>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg font-medium">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-indigo-500" />
                        Reflections
                    </div>
                    {reflectionCount > 0 && (
                        <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                            {reflectionCount} this week
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between pt-2">
                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                ) : latestReflection ? (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-lg">
                                {latestReflection.mood || <Smile className="h-4 w-4 text-indigo-400" />}
                            </div>
                            <div className="space-y-1">
                                <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-500")}>
                                    &quot;{latestReflection.note}&quot;
                                </p>
                                <p className="text-xs text-slate-400">
                                    {format(new Date(latestReflection.createdAt), "MMM d, h:mm a")}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-4 text-slate-500">
                        <p className="text-sm mb-2">No reflections yet this week.</p>
                        <p className="text-xs">Take a moment to reflect on your day.</p>
                    </div>
                )}

                <Button
                    variant="ghost"
                    className="w-full mt-4 justify-between group text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                    onClick={onOpenExperience}
                >
                    View History
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
            </CardContent>
        </Card>
    );
}
