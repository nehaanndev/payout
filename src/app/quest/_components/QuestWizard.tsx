"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Target,
    ArrowRight,
    ArrowLeft,
    Sparkles,
    Calendar,
    Clock,
    AlertTriangle,
    Loader2,
    BookOpen,
    RefreshCw,
    Check,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Quest, QuestMilestone } from "@/types/quest";
import {
    createQuest,
    calculateDailyLoad,
    getAverageDailyCommitment,
} from "@/lib/questService";
import { distributeMilestones } from "@/lib/questLLMService";
import { scheduleQuestToFlow } from "@/lib/questFlowBridge";
import { cn } from "@/lib/utils";
import { generateId } from "@/lib/id";
import { getLocalDateKey, parseLocalDate } from "@/lib/dateUtils";

type QuestWizardProps = {
    open: boolean;
    onClose: () => void;
    onComplete: (quest: Quest) => void;
    existingQuests: Quest[];
};

// Steps differ based on quest type
const KNOWN_STEPS = ["Basics", "Details", "Review"] as const;
const UNKNOWN_STEPS = ["Basics", "Schedule", "Suggestions", "Review"] as const;

const DAY_OPTIONS = [
    { id: "monday", label: "Mon" },
    { id: "tuesday", label: "Tue" },
    { id: "wednesday", label: "Wed" },
    { id: "thursday", label: "Thu" },
    { id: "friday", label: "Fri" },
    { id: "saturday", label: "Sat" },
    { id: "sunday", label: "Sun" },
];

const TIME_OPTIONS = [
    { value: 30, label: "30 min" },
    { value: 60, label: "1 hour" },
    { value: 120, label: "2 hours" },
    { value: 180, label: "3 hours" },
];

// LLM-generated suggestion type
type GeneratedSuggestion = {
    id: string;
    title: string;
    description: string;
    estimatedPages?: number;
    estimatedMinutes: number;
    resourceType: "book" | "video" | "article" | "course" | "practice";
    selected: boolean;
};

export function QuestWizard({
    open,
    onClose,
    onComplete,
    existingQuests,
}: QuestWizardProps) {
    const { user } = useAuth();
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(false);

    // Form state
    const [title, setTitle] = useState("");
    const [questType, setQuestType] = useState<"known" | "unknown">("known");
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return getLocalDateKey(d);
    });

    // Known syllabus details
    const [totalUnits, setTotalUnits] = useState<number>(10);
    const [unitLabel, setUnitLabel] = useState("items");
    const [unitDuration, setUnitDuration] = useState(30);

    // Schedule settings (shared)
    const [dailyMinutes, setDailyMinutes] = useState(60);
    const [availableDays, setAvailableDays] = useState<string[]>([
        "saturday",
        "sunday",
    ]);

    // LLM suggestions for unknown type
    const [suggestions, setSuggestions] = useState<GeneratedSuggestion[]>([]);
    const [llmFeedback, setLlmFeedback] = useState("");

    // Generated syllabus
    const [milestones, setMilestones] = useState<QuestMilestone[]>([]);

    const steps = questType === "known" ? KNOWN_STEPS : UNKNOWN_STEPS;
    const currentStep = steps[stepIndex];

    // Reset on close
    useEffect(() => {
        if (!open) {
            setStepIndex(0);
            setTitle("");
            setQuestType("known");
            setTotalUnits(10);
            setUnitLabel("items");
            setUnitDuration(30);
            setDailyMinutes(60);
            setAvailableDays(["saturday", "sunday"]);
            setMilestones([]);
            setSuggestions([]);
            setLlmFeedback("");
        }
    }, [open]);

    // Calculate dates and capacity
    const today = getLocalDateKey();
    const currentDailyLoads = useMemo(
        () => calculateDailyLoad(existingQuests, today, endDate),
        [existingQuests, today, endDate]
    );
    const currentAverage = getAverageDailyCommitment(currentDailyLoads);

    // Calculate how many days are available
    const availableDatesCount = useMemo(() => {
        const dayNames = [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
        ];
        let count = 0;
        // Use parseLocalDate to avoid UTC interpretation
        const start = parseLocalDate(today);
        const end = parseLocalDate(endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (availableDays.includes(dayNames[d.getDay()])) {
                count++;
            }
        }
        return count;
    }, [today, endDate, availableDays]);

    // Calculate suggested time commitment for unknown type
    const suggestedTimePerDay = useMemo(() => {
        const selectedSuggestions = suggestions.filter((s) => s.selected);
        if (selectedSuggestions.length === 0 || availableDatesCount === 0) return 0;
        const totalMinutes = selectedSuggestions.reduce(
            (sum, s) => sum + s.estimatedMinutes,
            0
        );
        return Math.ceil(totalMinutes / availableDatesCount);
    }, [suggestions, availableDatesCount]);

    const toggleDay = (dayId: string) => {
        setAvailableDays((prev) =>
            prev.includes(dayId)
                ? prev.filter((d) => d !== dayId)
                : [...prev, dayId]
        );
    };

    const toggleSuggestion = (id: string) => {
        setSuggestions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
        );
    };

    // Generate LLM suggestions
    const generateSuggestions = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/quest/syllabus", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    type: "unknown",
                    endDate,
                    availableDays,
                    dailyMinutes: 60, // Initial estimate
                    generateSuggestions: true,
                    feedback: llmFeedback,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const generatedSuggestions: GeneratedSuggestion[] = (
                    data.syllabus || []
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ).map((item: any) => ({
                    id: item.id || generateId(),
                    title: item.title,
                    description: item.description || "",
                    estimatedMinutes: item.durationMinutes || 120,
                    estimatedPages: item.resourceType === "book" ? 250 : undefined,
                    resourceType: item.resourceType || "book",
                    selected: true,
                }));
                setSuggestions(generatedSuggestions);
            } else {
                // Fallback suggestions for demo
                setSuggestions([
                    {
                        id: generateId(),
                        title: "Atomic Habits by James Clear",
                        description:
                            "Build good habits and break bad ones with this #1 bestseller",
                        estimatedPages: 320,
                        estimatedMinutes: 480,
                        resourceType: "book",
                        selected: true,
                    },
                    {
                        id: generateId(),
                        title: "The 7 Habits of Highly Effective People",
                        description: "Classic principles for personal effectiveness",
                        estimatedPages: 380,
                        estimatedMinutes: 560,
                        resourceType: "book",
                        selected: true,
                    },
                    {
                        id: generateId(),
                        title: "Deep Work by Cal Newport",
                        description: "Rules for focused success in a distracted world",
                        estimatedPages: 296,
                        estimatedMinutes: 440,
                        resourceType: "book",
                        selected: true,
                    },
                    {
                        id: generateId(),
                        title: "Mindset by Carol Dweck",
                        description: "The psychology of success through growth mindset",
                        estimatedPages: 276,
                        estimatedMinutes: 420,
                        resourceType: "book",
                        selected: true,
                    },
                    {
                        id: generateId(),
                        title: "The Power of Now by Eckhart Tolle",
                        description: "A guide to spiritual enlightenment and presence",
                        estimatedPages: 236,
                        estimatedMinutes: 360,
                        resourceType: "book",
                        selected: true,
                    },
                ]);
            }
        } catch (error) {
            console.error("Failed to generate suggestions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = async () => {
        if (currentStep === "Basics") {
            // Reset step to 0 when changing paths
            setStepIndex(1);
        } else if (currentStep === "Schedule") {
            // For unknown type: after selecting days, generate suggestions
            await generateSuggestions();
            setStepIndex(2);
        } else if (currentStep === "Suggestions") {
            // Generate milestones from selected suggestions
            setLoading(true);
            try {
                const selectedSuggestions = suggestions.filter((s) => s.selected);
                const generatedMilestones: QuestMilestone[] = [];

                for (const suggestion of selectedSuggestions) {
                    // Split each book/resource into multiple reading sessions
                    const sessionsNeeded = Math.ceil(
                        suggestion.estimatedMinutes / dailyMinutes
                    );
                    for (let i = 0; i < sessionsNeeded; i++) {
                        generatedMilestones.push({
                            id: generateId(),
                            day: generatedMilestones.length + 1,
                            title: `${suggestion.title} - Session ${i + 1}`,
                            description: suggestion.description,
                            durationMinutes: Math.min(
                                dailyMinutes,
                                suggestion.estimatedMinutes - i * dailyMinutes
                            ),
                            resourceType:
                                suggestion.resourceType === "book" ? "article" : "video",
                            status: "pending",
                        });
                    }
                }

                const distributed = distributeMilestones(
                    generatedMilestones,
                    today,
                    endDate,
                    availableDays,
                    dailyMinutes
                );
                setMilestones(distributed);
                setTotalUnits(selectedSuggestions.length);
                setUnitLabel("books");
                setStepIndex(3);
            } finally {
                setLoading(false);
            }
        } else if (currentStep === "Details") {
            // For known type: generate milestones
            setLoading(true);
            try {
                const preview: QuestMilestone[] = [];
                for (let i = 0; i < totalUnits; i++) {
                    preview.push({
                        id: generateId(),
                        day: i + 1,
                        title: `${title}: ${unitLabel} ${i + 1}`,
                        durationMinutes: unitDuration,
                        status: "pending",
                    });
                }
                const distributed = distributeMilestones(
                    preview,
                    today,
                    endDate,
                    availableDays,
                    dailyMinutes
                );
                setMilestones(distributed);
                setStepIndex(2);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleBack = () => {
        if (stepIndex > 0) {
            setStepIndex(stepIndex - 1);
        } else {
            onClose();
        }
    };

    const handleCreate = async () => {
        if (!user?.uid) return;

        setLoading(true);
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const quest = await createQuest(user.uid, {
                title,
                type: questType,
                status: "active",
                startDate: today,
                endDate,
                dailyMinutes,
                availableDays,
                totalUnits,
                unitLabel,
                unitDurationMinutes: unitDuration,
                syllabus: milestones,
                completedUnits: 0,
            });

            // Schedule to Flow - this returns milestones with flowTaskId set
            const scheduledMilestones = await scheduleQuestToFlow(
                user.uid,
                quest,
                timezone
            );

            // IMPORTANT: Save the updated milestones (with flowTaskIds) back to Firebase
            const { updateQuest } = await import("@/lib/questService");
            await updateQuest(user.uid, quest.id, {
                syllabus: scheduledMilestones,
            });

            quest.syllabus = scheduledMilestones;
            onComplete(quest);
        } catch (error) {
            console.error("Failed to create quest:", error);
        } finally {
            setLoading(false);
        }
    };

    const canProceed =
        currentStep === "Basics"
            ? title.trim().length > 0
            : currentStep === "Schedule"
                ? availableDays.length > 0
                : currentStep === "Suggestions"
                    ? suggestions.some((s) => s.selected)
                    : currentStep === "Details"
                        ? totalUnits > 0 && availableDays.length > 0
                        : true;

    const formatMinutes = (mins: number) => {
        const hours = Math.floor(mins / 60);
        const minutes = mins % 60;
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg overflow-hidden rounded-3xl border-0 p-0 shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl text-white">
                            <Target className="h-6 w-6" />
                            New Quest
                        </DialogTitle>
                    </DialogHeader>

                    {/* Steps */}
                    <div className="mt-4 flex items-center gap-2">
                        {steps.map((s, i) => (
                            <div
                                key={s}
                                className={cn(
                                    "flex items-center gap-2 text-sm font-medium",
                                    i === stepIndex ? "text-white" : "text-white/60"
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                                        i === stepIndex
                                            ? "bg-white text-amber-600"
                                            : i < stepIndex
                                                ? "bg-white/30 text-white"
                                                : "bg-white/20 text-white/60"
                                    )}
                                >
                                    {i + 1}
                                </span>
                                {s}
                                {i < steps.length - 1 && (
                                    <ArrowRight className="h-4 w-4 text-white/40" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
                    {currentStep === "Basics" && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="title">What do you want to accomplish?</Label>
                                <Input
                                    id="title"
                                    placeholder="e.g., Read 5 books on personal improvement"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="h-12 text-lg"
                                />
                            </div>

                            <div className="space-y-3">
                                <Label>Quest type</Label>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => setQuestType("known")}
                                        className={cn(
                                            "rounded-xl border-2 p-4 text-left transition-all",
                                            questType === "known"
                                                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                                                : "border-slate-200 hover:border-amber-300 dark:border-slate-700"
                                        )}
                                    >
                                        <p className="font-semibold">📚 Known syllabus</p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            I know what to read/watch (specific playlist, book)
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQuestType("unknown")}
                                        className={cn(
                                            "rounded-xl border-2 p-4 text-left transition-all",
                                            questType === "unknown"
                                                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                                                : "border-slate-200 hover:border-amber-300 dark:border-slate-700"
                                        )}
                                    >
                                        <p className="font-semibold">✨ Need guidance</p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Suggest books/resources for me
                                        </p>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="endDate">Target completion</Label>
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        min={today}
                                        className="w-auto"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* UNKNOWN TYPE: Schedule step - Pick days first */}
                    {currentStep === "Schedule" && (
                        <div className="space-y-6">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    <strong className="text-slate-900 dark:text-white">
                                        {title}
                                    </strong>
                                    <br />
                                    Let me suggest some resources based on your goal.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Which days can you commit to this quest?</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DAY_OPTIONS.map((day) => (
                                        <button
                                            key={day.id}
                                            type="button"
                                            onClick={() => toggleDay(day.id)}
                                            className={cn(
                                                "h-12 w-12 rounded-full text-sm font-medium transition-all",
                                                availableDays.includes(day.id)
                                                    ? "bg-amber-500 text-white"
                                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800"
                                            )}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-sm text-slate-500">
                                    {availableDatesCount} days available until {endDate}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>How much time per session?</Label>
                                <div className="flex flex-wrap gap-2">
                                    {TIME_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setDailyMinutes(opt.value)}
                                            className={cn(
                                                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                                                dailyMinutes === opt.value
                                                    ? "bg-amber-500 text-white"
                                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* UNKNOWN TYPE: Suggestions step - LLM-generated resources */}
                    {currentStep === "Suggestions" && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                                    <BookOpen className="h-5 w-5 text-amber-500" />
                                    Suggested Resources
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={generateSuggestions}
                                    disabled={loading}
                                    className="gap-1 text-amber-600"
                                >
                                    <RefreshCw
                                        className={cn("h-4 w-4", loading && "animate-spin")}
                                    />
                                    Regenerate
                                </Button>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                                    <span className="ml-3 text-slate-500">
                                        Generating suggestions...
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {suggestions.map((suggestion) => (
                                        <button
                                            key={suggestion.id}
                                            type="button"
                                            onClick={() => toggleSuggestion(suggestion.id)}
                                            className={cn(
                                                "w-full rounded-xl border-2 p-4 text-left transition-all",
                                                suggestion.selected
                                                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                                                    : "border-slate-200 opacity-60 hover:opacity-100 dark:border-slate-700"
                                            )}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-900 dark:text-white">
                                                        {suggestion.title}
                                                    </p>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        {suggestion.description}
                                                    </p>
                                                    <p className="mt-2 text-xs text-slate-400">
                                                        {suggestion.estimatedPages &&
                                                            `${suggestion.estimatedPages} pages · `}
                                                        ~{formatMinutes(suggestion.estimatedMinutes)}
                                                    </p>
                                                </div>
                                                <div
                                                    className={cn(
                                                        "flex h-6 w-6 items-center justify-center rounded-full",
                                                        suggestion.selected
                                                            ? "bg-amber-500 text-white"
                                                            : "border border-slate-300"
                                                    )}
                                                >
                                                    {suggestion.selected && (
                                                        <Check className="h-4 w-4" />
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Summary box */}
                            {suggestions.some((s) => s.selected) && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                                    <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                                        <Clock className="h-4 w-4" />
                                        <span>
                                            <strong>
                                                {suggestions.filter((s) => s.selected).length}
                                            </strong>{" "}
                                            resources selected ·{" "}
                                            <strong>~{formatMinutes(suggestedTimePerDay)}/day</strong>{" "}
                                            needed to finish by {endDate}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Feedback for regeneration */}
                            <div className="space-y-2">
                                <Label htmlFor="feedback">
                                    Want different suggestions? (optional)
                                </Label>
                                <Input
                                    id="feedback"
                                    placeholder="e.g., More focus on productivity, less on spirituality"
                                    value={llmFeedback}
                                    onChange={(e) => setLlmFeedback(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* KNOWN TYPE: Details step */}
                    {currentStep === "Details" && (
                        <div className="space-y-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="units">How many items total?</Label>
                                    <Input
                                        id="units"
                                        type="number"
                                        min={1}
                                        value={totalUnits}
                                        onChange={(e) => setTotalUnits(Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="unitLabel">What are you counting?</Label>
                                    <select
                                        id="unitLabel"
                                        value={unitLabel}
                                        onChange={(e) => setUnitLabel(e.target.value)}
                                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                    >
                                        <option value="videos">videos</option>
                                        <option value="pages">pages</option>
                                        <option value="chapters">chapters</option>
                                        <option value="lessons">lessons</option>
                                        <option value="items">items</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Average time per item (minutes)</Label>
                                <Input
                                    type="number"
                                    min={5}
                                    value={unitDuration}
                                    onChange={(e) => setUnitDuration(Number(e.target.value))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Daily time commitment</Label>
                                <div className="flex flex-wrap gap-2">
                                    {TIME_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setDailyMinutes(opt.value)}
                                            className={cn(
                                                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                                                dailyMinutes === opt.value
                                                    ? "bg-amber-500 text-white"
                                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Which days work for you?</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DAY_OPTIONS.map((day) => (
                                        <button
                                            key={day.id}
                                            type="button"
                                            onClick={() => toggleDay(day.id)}
                                            className={cn(
                                                "h-10 w-10 rounded-full text-sm font-medium transition-all",
                                                availableDays.includes(day.id)
                                                    ? "bg-amber-500 text-white"
                                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800"
                                            )}
                                        >
                                            {day.label[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Capacity Warning */}
                            {existingQuests.length > 0 && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                                        <div className="text-sm">
                                            <p className="font-medium text-amber-800 dark:text-amber-300">
                                                Capacity Check
                                            </p>
                                            <p className="mt-1 text-amber-700 dark:text-amber-400">
                                                You currently have{" "}
                                                <strong>{formatMinutes(currentAverage)}/day</strong>{" "}
                                                committed to other quests.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Review step */}
                    {currentStep === "Review" && (
                        <div className="space-y-6">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                <h3 className="font-semibold text-slate-900 dark:text-white">
                                    {title}
                                </h3>
                                <div className="mt-2 grid gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <p>
                                        📊 {totalUnits} {unitLabel}
                                    </p>
                                    <p>⏱️ {formatMinutes(dailyMinutes)}/day commitment</p>
                                    <p>📅 Complete by {endDate}</p>
                                    <p>
                                        🗓️ {availableDays.length} days/week (
                                        {availableDays.map((d) => d[0].toUpperCase()).join("")})
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h4 className="mb-3 flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                                    <Sparkles className="h-4 w-4 text-amber-500" />
                                    Scheduled Sessions
                                </h4>
                                <div className="max-h-48 space-y-2 overflow-y-auto">
                                    {milestones.slice(0, 10).map((m) => (
                                        <div
                                            key={m.id}
                                            className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                                        >
                                            <span className="text-slate-700 dark:text-slate-300">
                                                {m.title}
                                            </span>
                                            <span className="text-slate-500">{m.assignedDate}</span>
                                        </div>
                                    ))}
                                    {milestones.length > 10 && (
                                        <p className="text-center text-sm text-slate-500">
                                            +{milestones.length - 10} more sessions
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                    ✅ Tasks will be auto-scheduled into Flow with optimal start
                                    times.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                    <Button
                        variant="ghost"
                        onClick={stepIndex === 0 ? onClose : handleBack}
                        disabled={loading}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {stepIndex === 0 ? "Cancel" : "Back"}
                    </Button>

                    {currentStep === "Review" ? (
                        <Button
                            onClick={handleCreate}
                            disabled={loading}
                            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Target className="h-4 w-4" />
                                    Start Quest
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleNext}
                            disabled={!canProceed || loading}
                            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {currentStep === "Schedule"
                                        ? "Generating..."
                                        : "Processing..."}
                                </>
                            ) : (
                                <>
                                    {currentStep === "Schedule"
                                        ? "Get Suggestions"
                                        : "Continue"}
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
