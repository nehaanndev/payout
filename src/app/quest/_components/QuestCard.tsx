"use client";

import { useMemo, useState } from "react";
import { Quest, QuestMilestone } from "@/types/quest";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dateUtils";

type QuestCardProps = {
    quest: Quest;
    onClick?: () => void;
};

// Extract submodules from milestones
type Submodule = {
    name: string;
    sessions: QuestMilestone[];
    completedCount: number;
    totalCount: number;
    startDate: string | null;
    endDate: string | null;
    totalMinutes: number;
};

function extractSubmodules(syllabus: QuestMilestone[]): Submodule[] {
    const submoduleMap = new Map<string, Submodule>();

    for (const milestone of syllabus) {
        // Parse title to get parent resource name
        // Format: "Book Name - Session X" or just "Title" for single items
        let parentName = milestone.title;
        const sessionMatch = milestone.title.match(/^(.+?)\s*-\s*Session\s+\d+$/i);
        if (sessionMatch) {
            parentName = sessionMatch[1].trim();
        }

        const existing = submoduleMap.get(parentName);
        if (existing) {
            existing.sessions.push(milestone);
            existing.totalCount++;
            existing.totalMinutes += milestone.durationMinutes;
            if (milestone.status === "done") existing.completedCount++;
            if (milestone.assignedDate) {
                if (!existing.startDate || milestone.assignedDate < existing.startDate) {
                    existing.startDate = milestone.assignedDate;
                }
                if (!existing.endDate || milestone.assignedDate > existing.endDate) {
                    existing.endDate = milestone.assignedDate;
                }
            }
        } else {
            submoduleMap.set(parentName, {
                name: parentName,
                sessions: [milestone],
                completedCount: milestone.status === "done" ? 1 : 0,
                totalCount: 1,
                startDate: milestone.assignedDate ?? null,
                endDate: milestone.assignedDate ?? null,
                totalMinutes: milestone.durationMinutes,
            });
        }
    }

    return Array.from(submoduleMap.values());
}

export function QuestCard({ quest, onClick }: QuestCardProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Track progress by sessions (milestones), not just units
    const completedSessions = quest.syllabus.filter((m) => m.status === "done").length;
    const totalSessions = quest.syllabus.length;
    const progress = totalSessions > 0
        ? Math.round((completedSessions / totalSessions) * 100)
        : 0;

    // Extract submodules
    const submodules = useMemo(() => extractSubmodules(quest.syllabus), [quest.syllabus]);
    const hasMultipleSubmodules = submodules.length > 1 ||
        (submodules.length === 1 && submodules[0].sessions.length > 1);

    const remainingMinutes = quest.syllabus
        .filter((m) => m.status !== "done")
        .reduce((sum, m) => sum + m.durationMinutes, 0);

    const formatTime = (mins: number) => {
        const hours = Math.floor(mins / 60);
        const minutes = mins % 60;
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    };

    const formatDate = (dateStr: string) => {
        // Use parseLocalDate to avoid UTC interpretation offset
        const date = parseLocalDate(dateStr);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const daysRemaining = Math.ceil(
        (parseLocalDate(quest.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "relative cursor-pointer rounded-2xl border p-5 transition-all hover:shadow-lg",
                quest.status === "completed"
                    ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20"
                    : "border-slate-200 bg-white hover:border-amber-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-600"
            )}
        >
            {/* Header */}
            <div className="mb-3 flex items-start justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                    {quest.title}
                </h3>
                <span
                    className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        quest.status === "completed"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                            : quest.status === "active"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    )}
                >
                    {quest.status}
                </span>
            </div>

            {/* Submodules summary (show on hover when multiple) */}
            {hasMultipleSubmodules && isHovered && (
                <div className="mb-3 space-y-1.5">
                    {submodules.slice(0, 4).map((sub) => (
                        <div
                            key={sub.name}
                            className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-xs dark:bg-slate-800"
                        >
                            <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                                {sub.name}
                            </span>
                            <div className="flex items-center gap-2 text-slate-500">
                                <span>
                                    {sub.completedCount}/{sub.totalCount}
                                </span>
                                {sub.startDate && (
                                    <span>
                                        {formatDate(sub.startDate)}
                                        {sub.endDate !== sub.startDate && ` → ${formatDate(sub.endDate!)}`}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                    {submodules.length > 4 && (
                        <p className="text-center text-xs text-slate-400">
                            +{submodules.length - 4} more
                        </p>
                    )}
                </div>
            )}

            {/* Submodules count when not hovered */}
            {hasMultipleSubmodules && !isHovered && (
                <p className="mb-2 text-xs text-slate-500">
                    {submodules.length} {submodules.length === 1 ? "resource" : "resources"} · {totalSessions} sessions
                </p>
            )}

            {/* Progress bar */}
            <div className="mb-3">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all",
                            quest.status === "completed"
                                ? "bg-emerald-500"
                                : "bg-gradient-to-r from-amber-500 to-orange-500"
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                    {completedSessions}/{totalSessions} sessions ({progress}%)
                </p>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>~{formatTime(remainingMinutes)} remaining</span>
                {quest.status !== "completed" && (
                    <span>
                        {daysRemaining > 0
                            ? `${daysRemaining} days left`
                            : daysRemaining === 0
                                ? "Due today"
                                : "Overdue"}
                    </span>
                )}
            </div>
        </div>
    );
}

// Export for use in other components
export { extractSubmodules };
export type { Submodule };
