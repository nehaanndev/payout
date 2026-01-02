"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OrbitLearningLesson } from "@/types/orbit";
import { LessonDialog } from "./LessonDialog";

export function LearningLessonCard({
    lesson,
    isNight,
    userId,
    planId,
}: {
    lesson: OrbitLearningLesson;
    isNight: boolean;
    userId: string | null | undefined;
    planId?: string;
}) {
    const tone = isNight ? "text-indigo-200" : "text-slate-600";
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const handleSaveLesson = async () => {
        if (!userId) {
            setSaveMessage("Sign in to save lessons to Orbit.");
            return;
        }
        setSaving(true);
        setSaveMessage(null);
        try {
            const response = await fetch("/api/orbit/lesson-save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    planId,
                    topic: lesson.title,
                    lesson,
                }),
            });
            const payload = await response.json();
            if (!response.ok || payload?.error) {
                throw new Error(payload?.error ?? "Failed to save lesson");
            }
            setSaveMessage("Saved to Orbit lessons.");
        } catch (error) {
            console.error("Failed to save lesson to Orbit", error);
            setSaveMessage(
                error instanceof Error ? error.message : "Couldn't save this lesson. Try again."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card
            className={cn(
                "relative overflow-hidden border-0 shadow-lg transition-all",
                "min-h-[280px] flex flex-col justify-between",
                isNight
                    ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-indigo-900/20"
                    : "bg-gradient-to-br from-white to-slate-50 text-slate-900 shadow-slate-200/50"
            )}
        >
            {/* Background decoration */}
            <div className={cn("absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full blur-3xl opacity-20 pointer-events-none",
                isNight ? "bg-indigo-500" : "bg-emerald-400"
            )} />

            <CardHeader className="relative z-10 p-6 space-y-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                            isNight ? "bg-indigo-400/10 text-indigo-300 ring-indigo-400/20" : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                        )}>
                            Day {lesson.day}
                        </span>
                        <span className={cn("text-xs font-medium uppercase tracking-wider opacity-60", tone)}>
                            {lesson.totalDays} Days Total
                        </span>
                    </div>
                    <CardTitle className={cn("text-2xl font-bold tracking-tight leading-tight", isNight ? "text-white" : "text-slate-900")}>
                        {lesson.title}
                    </CardTitle>
                </div>

                <p className={cn("text-sm leading-relaxed line-clamp-3", isNight ? "text-slate-300" : "text-slate-600")}>
                    {lesson.overview}
                </p>
                {saveMessage ? <p className={cn("mt-1 text-xs font-medium", isNight ? "text-emerald-400" : "text-emerald-600")}>{saveMessage}</p> : null}
            </CardHeader>

            <div className="relative z-10 p-6 pt-0 flex items-center gap-3 mt-auto">
                <Button
                    className={cn("flex-1 font-semibold shadow-md transition-transform active:scale-95",
                        isNight
                            ? "bg-indigo-500 hover:bg-indigo-400 text-white border-0"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                    )}
                    onClick={() => setOpen(true)}
                >
                    Start Lesson
                </Button>
                <Button
                    variant="outline"
                    className={cn("flex-1 font-semibold border-2",
                        isNight
                            ? "border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
                            : "border-slate-200 bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                    onClick={handleSaveLesson}
                    disabled={saving}
                >
                    {saving ? "Saving..." : "Save for Later"}
                </Button>
            </div>

            <LessonDialog
                lesson={lesson}
                open={open}
                onOpenChange={setOpen}
                isNight={isNight}
            />
        </Card>
    );
}
