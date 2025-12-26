"use client";

import { useState, useMemo } from "react";
import {
    Target,
    Check,
    Clock,
    Calendar,
    ChevronDown,
    ChevronRight,
    Trash2,
    AlertTriangle,
    BookOpen,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Quest, QuestMilestone, MilestoneStatus } from "@/types/quest";
import { FlowTaskStatus } from "@/types/flow";
import { updateQuest, deleteQuest } from "@/lib/questService";
import { saveFlowPlan, fetchFlowPlanSnapshot } from "@/lib/flowService";
import { cn } from "@/lib/utils";
import { extractSubmodules } from "./QuestCard";

type QuestDetailDialogProps = {
    quest: Quest | null;
    userId: string;
    onClose: () => void;
    onUpdate: (quest: Quest) => void;
    onDelete?: () => void;
};

export function QuestDetailDialog({
    quest,
    userId,
    onClose,
    onUpdate,
    onDelete,
}: QuestDetailDialogProps) {
    const [loading, setLoading] = useState<string | null>(null);
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteSubmoduleTarget, setDeleteSubmoduleTarget] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"submodules" | "roadmap">("submodules");

    // Extract submodules
    const submodules = useMemo(() => {
        if (!quest) return [];
        return extractSubmodules(quest.syllabus);
    }, [quest]);

    // Group milestones by date
    const milestonesByDate = useMemo(() => {
        if (!quest) return new Map<string, QuestMilestone[]>();

        const grouped = new Map<string, QuestMilestone[]>();
        for (const m of quest.syllabus) {
            const date = m.assignedDate || "unassigned";
            const existing = grouped.get(date) || [];
            existing.push(m);
            grouped.set(date, existing);
        }
        return new Map(
            [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
        );
    }, [quest]);

    // Capacity check - find overloaded days
    const overloadedDays = useMemo(() => {
        if (!quest) return [];
        const overloaded: Array<{ date: string; minutes: number }> = [];
        for (const [date, milestones] of milestonesByDate) {
            if (date === "unassigned") continue;
            const totalMinutes = milestones.reduce((sum, m) => sum + m.durationMinutes, 0);
            // Flag if any day exceeds the quest's daily commitment significantly (2x)
            if (totalMinutes > quest.dailyMinutes * 2) {
                overloaded.push({ date, minutes: totalMinutes });
            }
        }
        return overloaded;
    }, [quest, milestonesByDate]);

    const completedCount = quest?.syllabus.filter((m) => m.status === "done").length ?? 0;
    const totalCount = quest?.syllabus.length ?? 0;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    if (!quest) return null;

    const toggleDate = (date: string) => {
        setExpandedDates((prev) => {
            const next = new Set(prev);
            if (next.has(date)) {
                next.delete(date);
            } else {
                next.add(date);
            }
            return next;
        });
    };

    const handleToggleMilestone = async (milestone: QuestMilestone) => {
        if (loading) return;
        setLoading(milestone.id);

        try {
            const newStatus: MilestoneStatus = milestone.status === "done" ? "pending" : "done";

            const updatedSyllabus: QuestMilestone[] = quest.syllabus.map((m) =>
                m.id === milestone.id ? { ...m, status: newStatus } : m
            );

            const newCompletedCount = updatedSyllabus.filter(
                (m) => m.status === "done"
            ).length;

            await updateQuest(userId, quest.id, {
                syllabus: updatedSyllabus,
                completedUnits: newCompletedCount,
            });

            // Update linked Flow task
            if (milestone.flowTaskId && milestone.assignedDate) {
                const plan = await fetchFlowPlanSnapshot(userId, milestone.assignedDate);
                if (plan) {
                    const updatedTasks = plan.tasks.map((t) => {
                        if (t.id === milestone.flowTaskId) {
                            const flowStatus: FlowTaskStatus = newStatus === "done" ? "done" : "pending";
                            return {
                                ...t,
                                status: flowStatus,
                                estimateMinutes:
                                    newStatus === "done" && milestone.assignedDate! > new Date().toISOString().split("T")[0]
                                        ? 0
                                        : t.estimateMinutes,
                            };
                        }
                        return t;
                    });
                    await saveFlowPlan(userId, { ...plan, tasks: updatedTasks });
                }
            }

            onUpdate({
                ...quest,
                syllabus: updatedSyllabus,
                completedUnits: newCompletedCount,
            });
        } catch (error) {
            console.error("Failed to toggle milestone:", error);
        } finally {
            setLoading(null);
        }
    };

    const handleDeleteSubmodule = async (submoduleName: string) => {
        setLoading("deleting");
        try {
            // Find milestones belonging to this submodule
            const milestonesToRemove = quest.syllabus.filter((m) => {
                const match = m.title.match(/^(.+?)\s*-\s*Session\s+\d+$/i);
                const parentName = match ? match[1].trim() : m.title;
                return parentName === submoduleName;
            });

            // Remove from Flow first
            for (const milestone of milestonesToRemove) {
                if (milestone.flowTaskId && milestone.assignedDate) {
                    const plan = await fetchFlowPlanSnapshot(userId, milestone.assignedDate);
                    if (plan) {
                        const updatedTasks = plan.tasks.filter((t) => t.id !== milestone.flowTaskId);
                        await saveFlowPlan(userId, { ...plan, tasks: updatedTasks });
                    }
                }
            }

            // Remove from quest
            const updatedSyllabus = quest.syllabus.filter((m) => {
                const match = m.title.match(/^(.+?)\s*-\s*Session\s+\d+$/i);
                const parentName = match ? match[1].trim() : m.title;
                return parentName !== submoduleName;
            });

            const newCompletedCount = updatedSyllabus.filter((m) => m.status === "done").length;

            await updateQuest(userId, quest.id, {
                syllabus: updatedSyllabus,
                completedUnits: newCompletedCount,
            });

            onUpdate({
                ...quest,
                syllabus: updatedSyllabus,
                completedUnits: newCompletedCount,
            });
        } catch (error) {
            console.error("Failed to delete submodule:", error);
        } finally {
            setLoading(null);
            setDeleteSubmoduleTarget(null);
        }
    };

    const handleDeleteQuest = async () => {
        setLoading("deleting-quest");
        try {
            // Remove all Flow tasks first
            for (const milestone of quest.syllabus) {
                if (milestone.flowTaskId && milestone.assignedDate) {
                    const plan = await fetchFlowPlanSnapshot(userId, milestone.assignedDate);
                    if (plan) {
                        const updatedTasks = plan.tasks.filter((t) => t.id !== milestone.flowTaskId);
                        await saveFlowPlan(userId, { ...plan, tasks: updatedTasks });
                    }
                }
            }

            // Delete the quest
            await deleteQuest(userId, quest.id);
            onDelete?.();
            onClose();
        } catch (error) {
            console.error("Failed to delete quest:", error);
        } finally {
            setLoading(null);
            setDeleteConfirmOpen(false);
        }
    };

    const formatDate = (dateStr: string) => {
        if (dateStr === "unassigned") return "Unassigned";
        const date = new Date(dateStr + "T12:00:00");
        const today = new Date().toISOString().split("T")[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

        if (dateStr === today) return "Today";
        if (dateStr === tomorrow) return "Tomorrow";

        return date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    };

    const formatMinutes = (mins: number) => {
        const hours = Math.floor(mins / 60);
        const minutes = mins % 60;
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    };

    const formatShortDate = (dateStr: string) => {
        const date = new Date(dateStr + "T12:00:00");
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const today = new Date().toISOString().split("T")[0];

    return (
        <>
            <Dialog open={!!quest} onOpenChange={(v) => !v && onClose()}>
                <DialogContent className="max-w-2xl overflow-hidden rounded-3xl border-0 p-0 shadow-2xl max-h-[90vh]">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl text-white">
                                <Target className="h-6 w-6" />
                                {quest.title}
                            </DialogTitle>
                        </DialogHeader>

                        {/* Progress bar */}
                        <div className="mt-4">
                            <div className="flex items-center justify-between text-sm text-white/80">
                                <span>
                                    {completedCount}/{totalCount} sessions completed
                                </span>
                                <span>{progress}%</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
                                <div
                                    className="h-full rounded-full bg-white transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="mt-4 flex gap-4 text-sm text-white/80">
                            <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>
                                    {quest.startDate} → {quest.endDate}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{formatMinutes(quest.dailyMinutes)}/day</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <BookOpen className="h-4 w-4" />
                                <span>{submodules.length} resources</span>
                            </div>
                        </div>
                    </div>

                    {/* Capacity Warning */}
                    {overloadedDays.length > 0 && (
                        <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-800 dark:bg-rose-900/20">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-500" />
                            <div className="text-sm">
                                <p className="font-medium text-rose-700 dark:text-rose-400">
                                    ⚠️ Quest Timeline too short
                                </p>
                                <p className="text-rose-600 dark:text-rose-300">
                                    {overloadedDays.length} day(s) have {formatMinutes(overloadedDays[0].minutes)}+ scheduled
                                    (vs {formatMinutes(quest.dailyMinutes)} daily limit).
                                    Consider extending deadline or removing a resource.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Tab switcher */}
                    <div className="flex border-b border-slate-100 px-6 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setActiveTab("submodules")}
                            className={cn(
                                "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                                activeTab === "submodules"
                                    ? "border-amber-500 text-amber-600"
                                    : "border-transparent text-slate-500 hover:text-slate-700"
                            )}
                        >
                            Resources ({submodules.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("roadmap")}
                            className={cn(
                                "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                                activeTab === "roadmap"
                                    ? "border-amber-500 text-amber-600"
                                    : "border-transparent text-slate-500 hover:text-slate-700"
                            )}
                        >
                            Roadmap ({milestonesByDate.size} days)
                        </button>
                    </div>

                    {/* Content */}
                    <div className="max-h-[40vh] overflow-y-auto px-6 py-4">
                        {activeTab === "submodules" ? (
                            /* Submodules view */
                            <div className="space-y-3">
                                {submodules.map((sub) => (
                                    <div
                                        key={sub.name}
                                        className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-slate-900 dark:text-white truncate">
                                                {sub.name}
                                            </h4>
                                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                                <span>
                                                    {sub.completedCount}/{sub.totalCount} sessions
                                                </span>
                                                <span>~{formatMinutes(sub.totalMinutes)}</span>
                                                {sub.startDate && (
                                                    <span>
                                                        {formatShortDate(sub.startDate)}
                                                        {sub.endDate !== sub.startDate && ` → ${formatShortDate(sub.endDate!)}`}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Mini progress bar */}
                                            <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                                <div
                                                    className="h-full rounded-full bg-amber-500"
                                                    style={{
                                                        width: `${sub.totalCount > 0 ? (sub.completedCount / sub.totalCount) * 100 : 0}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        {/* Delete button */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeleteSubmoduleTarget(sub.name)}
                                            className="ml-2 text-slate-400 hover:text-rose-500"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* Roadmap view */
                            <div className="space-y-3">
                                {[...milestonesByDate.entries()].map(([date, milestones]) => {
                                    const isExpanded = expandedDates.has(date);
                                    const dateCompleted = milestones.filter((m) => m.status === "done").length;
                                    const isPast = date !== "unassigned" && date < today;
                                    const isToday = date === today;
                                    const dayMinutes = milestones.reduce((s, m) => s + m.durationMinutes, 0);
                                    const isOverloaded = dayMinutes > quest.dailyMinutes * 2;

                                    return (
                                        <div
                                            key={date}
                                            className={cn(
                                                "rounded-xl border overflow-hidden",
                                                isOverloaded
                                                    ? "border-rose-300 bg-rose-50/50 dark:border-rose-700 dark:bg-rose-900/20"
                                                    : isToday
                                                        ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/20"
                                                        : "border-slate-200 dark:border-slate-700"
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleDate(date)}
                                                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-slate-400" />
                                                    )}
                                                    <span
                                                        className={cn(
                                                            "font-medium",
                                                            isOverloaded
                                                                ? "text-rose-700 dark:text-rose-400"
                                                                : isToday
                                                                    ? "text-amber-700 dark:text-amber-400"
                                                                    : isPast
                                                                        ? "text-slate-400"
                                                                        : "text-slate-900 dark:text-white"
                                                        )}
                                                    >
                                                        {formatDate(date)}
                                                    </span>
                                                    {isOverloaded && (
                                                        <span className="text-xs text-rose-500">
                                                            ({formatMinutes(dayMinutes)} - overloaded!)
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-slate-500">
                                                        {dateCompleted}/{milestones.length}
                                                    </span>
                                                    {dateCompleted === milestones.length && milestones.length > 0 && (
                                                        <Check className="h-4 w-4 text-emerald-500" />
                                                    )}
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="border-t border-slate-100 dark:border-slate-700">
                                                    {milestones.map((milestone) => (
                                                        <div
                                                            key={milestone.id}
                                                            className={cn(
                                                                "flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-slate-100 dark:border-slate-800",
                                                                milestone.status === "done" && "bg-emerald-50/50 dark:bg-emerald-900/10"
                                                            )}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleMilestone(milestone)}
                                                                disabled={loading === milestone.id}
                                                                className={cn(
                                                                    "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                                                    milestone.status === "done"
                                                                        ? "border-emerald-500 bg-emerald-500 text-white"
                                                                        : "border-slate-300 hover:border-amber-400 dark:border-slate-600"
                                                                )}
                                                            >
                                                                {loading === milestone.id ? (
                                                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                                ) : milestone.status === "done" ? (
                                                                    <Check className="h-3 w-3" />
                                                                ) : null}
                                                            </button>
                                                            <div className="flex-1 min-w-0">
                                                                <p
                                                                    className={cn(
                                                                        "font-medium truncate",
                                                                        milestone.status === "done"
                                                                            ? "text-slate-500 line-through"
                                                                            : "text-slate-900 dark:text-white"
                                                                    )}
                                                                >
                                                                    {milestone.title}
                                                                </p>
                                                            </div>
                                                            <span className="flex-shrink-0 text-sm text-slate-400">
                                                                {formatMinutes(milestone.durationMinutes)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                        <Button
                            variant="ghost"
                            onClick={() => setDeleteConfirmOpen(true)}
                            className="text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Quest
                        </Button>
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Quest Confirmation */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Quest?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete &ldquo;{quest.title}&rdquo; and remove all {quest.syllabus.filter(m => m.flowTaskId).length} linked tasks from Flow.
                            This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteQuest}
                            className="bg-rose-500 hover:bg-rose-600"
                        >
                            {loading === "deleting-quest" ? "Deleting..." : "Delete Quest"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Submodule Confirmation */}
            <AlertDialog open={!!deleteSubmoduleTarget} onOpenChange={(open: boolean) => !open && setDeleteSubmoduleTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Resource?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove all sessions for &ldquo;{deleteSubmoduleTarget}&rdquo; and their linked Flow tasks.
                            This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteSubmoduleTarget && handleDeleteSubmodule(deleteSubmoduleTarget)}
                            className="bg-rose-500 hover:bg-rose-600"
                        >
                            {loading === "deleting" ? "Deleting..." : "Delete Resource"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
