"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { OrbitLearningLesson } from "@/types/orbit";

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
    const quizItems = lesson.quiz ?? [];
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [quizResponses, setQuizResponses] = useState<
        Record<number, { selected: string; isCorrect: boolean }>
    >({});

    const handleAnswerSelect = (questionIndex: number, answer: string, correctAnswer: string) => {
        const isCorrect =
            answer.trim().toLowerCase() === (correctAnswer ?? "").trim().toLowerCase();
        setQuizResponses((prev) => ({
            ...prev,
            [questionIndex]: { selected: answer, isCorrect },
        }));
    };

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
                "rounded-[28px] p-6 shadow-sm",
                isNight ? "border-white/15 bg-slate-900/70 text-white" : "border-emerald-200 bg-white/95 text-slate-900"
            )}
        >
            <CardHeader className="p-0">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p
                            className={cn(
                                "text-xs font-semibold uppercase tracking-[0.35em]",
                                isNight ? "text-emerald-200" : "text-emerald-600"
                            )}
                        >
                            Learning mode
                        </p>
                        <CardTitle className={cn("text-xl", isNight ? "text-white" : "text-slate-900")}>
                            Day {lesson.day} / {lesson.totalDays}: {lesson.title}
                        </CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant={isNight ? "secondary" : "outline"}
                            className={cn(
                                "text-sm font-semibold",
                                isNight
                                    ? "bg-indigo-500/90 text-slate-900 hover:bg-indigo-400 border-transparent"
                                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            )}
                            onClick={() => setOpen(true)}
                        >
                            Open lesson
                        </Button>
                        <Button
                            size="sm"
                            variant={isNight ? "secondary" : "outline"}
                            onClick={handleSaveLesson}
                            disabled={saving}
                            className={cn(
                                "gap-2 text-sm font-semibold",
                                isNight
                                    ? "bg-emerald-500/90 text-slate-900 hover:bg-emerald-400 border-transparent disabled:opacity-50"
                                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            )}
                        >
                            {saving ? "Saving…" : "Save to Orbit lessons"}
                        </Button>
                    </div>
                </div>
                <p className={cn("mt-2 text-sm", tone)}>{lesson.overview}</p>
                {saveMessage ? <p className={cn("mt-1 text-xs", tone)}>{saveMessage}</p> : null}
            </CardHeader>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className={cn(
                        "max-w-3xl border-none p-6",
                        isNight ? "bg-slate-900/90 text-white" : "bg-white/95 text-slate-900"
                    )}
                >
                    <DialogHeader className="p-0">
                        <DialogTitle className={cn("text-xl font-semibold", isNight ? "text-white" : "text-slate-900")}>
                            {lesson.title}
                        </DialogTitle>
                    </DialogHeader>
                    <p className={cn("text-sm", tone)}>
                        Day {lesson.day} of {lesson.totalDays} · {lesson.overview}
                    </p>
                    <div className="mt-4 space-y-3 text-sm leading-relaxed">
                        {lesson.paragraphs.map((paragraph, index) => (
                            <p key={index} className={isNight ? "text-indigo-100" : "text-slate-700"}>
                                {paragraph}
                            </p>
                        ))}
                        {lesson.code && lesson.code.length ? (
                            <div className="space-y-2">
                                {lesson.code.map((block, codeIdx) => (
                                    <pre
                                        key={codeIdx}
                                        className={cn(
                                            "overflow-auto rounded-xl border px-4 py-3 text-xs font-mono",
                                            isNight
                                                ? "border-white/10 bg-slate-900/80 text-emerald-100"
                                                : "border-slate-200 bg-slate-50 text-emerald-700"
                                        )}
                                    >
                                        {block}
                                    </pre>
                                ))}
                            </div>
                        ) : null}
                    </div>
                    {quizItems.length ? (
                        <div className="mt-6 space-y-3 rounded-2xl border border-dashed border-emerald-200/60 p-4">
                            <p className={cn("text-xs font-semibold uppercase tracking-[0.35em]", tone)}>Quick quiz</p>
                            {quizItems.map((item, idx) => (
                                <div key={idx} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                                    <p className={cn("text-sm font-semibold", isNight ? "text-white" : "text-slate-900")}>
                                        {item.question}
                                    </p>
                                    <div className="space-y-2 text-sm">
                                        {item.answers.map((answer, answerIdx) => {
                                            const response = quizResponses[idx];
                                            const selected = response?.selected === answer;
                                            const isCorrect = response?.isCorrect ?? false;
                                            const correctAnswer = item.correctAnswer ?? "";
                                            const isRightAnswer =
                                                (answer ?? "").trim().toLowerCase() === correctAnswer.trim().toLowerCase();
                                            return (
                                                <button
                                                    key={answerIdx}
                                                    type="button"
                                                    onClick={() => handleAnswerSelect(idx, answer, correctAnswer)}
                                                    className={cn(
                                                        "w-full rounded-lg border px-3 py-2 text-left transition",
                                                        isNight
                                                            ? "border-white/15 text-indigo-100 hover:border-emerald-300/60"
                                                            : "border-slate-200 text-slate-700 hover:border-emerald-300/60",
                                                        selected && isCorrect && (isNight ? "border-emerald-300/80 bg-emerald-500/10" : "border-emerald-400 bg-emerald-50"),
                                                        selected && !isCorrect && (isNight ? "border-red-300/80 bg-red-500/10" : "border-red-300 bg-red-50"),
                                                        !selected && response && isRightAnswer && (isNight ? "border-emerald-200/60" : "border-emerald-300")
                                                    )}
                                                >
                                                    {answer}
                                                </button>
                                            );
                                        })}
                                        {quizResponses[idx] ? (
                                            <p
                                                className={cn(
                                                    "text-xs font-semibold",
                                                    quizResponses[idx].isCorrect
                                                        ? isNight
                                                            ? "text-emerald-200"
                                                            : "text-emerald-700"
                                                        : isNight
                                                            ? "text-red-200"
                                                            : "text-red-700"
                                                )}
                                            >
                                                {quizResponses[idx].isCorrect
                                                    ? "Correct!"
                                                    : `Not quite. Correct answer: ${item.correctAnswer}`}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
