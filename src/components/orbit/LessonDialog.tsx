"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { OrbitLearningLesson } from "@/types/orbit";

type LessonDialogProps = {
    lesson: OrbitLearningLesson | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isNight?: boolean;
};

export function LessonDialog({ lesson, open, onOpenChange, isNight = false }: LessonDialogProps) {
    const tone = isNight ? "text-indigo-200" : "text-slate-600";
    const quizItems = lesson?.quiz ?? [];
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

    // Reset quiz responses when dialog closes or lesson changes
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setQuizResponses({});
        }
        onOpenChange(newOpen);
    };

    if (!lesson) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className={cn(
                    "max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border",
                    isNight
                        ? "border-white/10 bg-slate-900/90 text-white"
                        : "border-emerald-100 bg-white/95 text-slate-900"
                )}
            >
                <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className={cn("text-lg sm:text-xl font-semibold", isNight ? "text-white" : "text-slate-900")}>
                        {lesson.title}
                    </DialogTitle>
                    <DialogDescription className={cn("text-xs sm:text-sm", isNight ? "text-indigo-200/80" : "text-emerald-700")}>
                        Day {lesson.day} of {lesson.totalDays} · {lesson.overview}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-3 space-y-3 text-sm leading-relaxed">
                    {lesson.paragraphs?.map((paragraph, index) => (
                        <p key={index} className={isNight ? "text-indigo-100" : "text-slate-700"}>
                            {paragraph}
                        </p>
                    ))}
                    {lesson.code && lesson.code.length > 0 && (
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
                    )}
                </div>

                {quizItems.length > 0 && (
                    <div className={cn(
                        "mt-6 space-y-3 rounded-2xl border border-dashed p-4",
                        isNight ? "border-emerald-400/40" : "border-emerald-200/60"
                    )}>
                        <p className={cn("text-xs font-semibold uppercase tracking-[0.35em]", tone)}>
                            Quick quiz
                        </p>
                        {quizItems.map((item, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "space-y-2 rounded-xl border p-3",
                                    isNight ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
                                )}
                            >
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
                                                    "w-full rounded-lg border px-3 py-2.5 text-left transition",
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
                                    {quizResponses[idx] && (
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
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
