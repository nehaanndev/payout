"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToodlTheme } from "@/hooks/useToodlTheme";
import { auth } from "@/lib/firebase";
import { getLearningPlan, deleteLearningPlan } from "@/lib/orbitSummaryService";
import { OrbitLearningPlan } from "@/types/orbit";

export function OrbitSettingsSection() {
    const { isNight } = useToodlTheme();
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [plan, setPlan] = useState<OrbitLearningPlan | null>(null);

    useEffect(() => {
        const loadPlan = async () => {
            if (!auth.currentUser) return;
            try {
                const p = await getLearningPlan(auth.currentUser.uid);
                setPlan(p);
            } catch (error) {
                console.error("Failed to load learning plan", error);
            } finally {
                setLoading(false);
            }
        };
        loadPlan();
    }, []);

    const handleDelete = async () => {
        if (!auth.currentUser || !confirm("Are you sure you want to delete your current learning track? This cannot be undone.")) return;

        setDeleting(true);
        try {
            await deleteLearningPlan(auth.currentUser.uid);
            setPlan(null);
        } catch (error) {
            console.error("Failed to delete plan", error);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return <div className="p-4"><Loader2 className="animate-spin" /></div>;
    }

    if (!plan) {
        return null; // Or show a "No active learning track" message if desired, but usually settings sections are persistent.
        // Let's show the card but say no active track.
    }

    return (
        <Card className={cn(
            "border-0 shadow-md",
            isNight ? "bg-slate-900 text-slate-100" : "bg-white"
        )}>
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    <CardTitle>Orbit Learning</CardTitle>
                </div>
                <CardDescription>
                    Manage your AI learning tracks
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                {plan ? (
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="font-medium text-lg">{plan.topic}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {plan.depth} depth • Lesson {plan.currentLesson} of {plan.totalLessons || "many"}
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="gap-2"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Delete Track
                        </Button>
                    </div>
                ) : (
                    <p className="text-slate-500 dark:text-slate-400">You don&apos;t have an active learning track.</p>
                )}
            </CardContent>
        </Card>
    );
}
