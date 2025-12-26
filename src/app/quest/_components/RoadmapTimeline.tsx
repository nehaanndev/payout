"use client";

import { useMemo } from "react";
import { Quest, DailyLoad } from "@/types/quest";
import { cn } from "@/lib/utils";

type RoadmapTimelineProps = {
    quests: Quest[];
    dailyLoads: DailyLoad[];
    startDate: string;
    endDate: string;
};

// Emoji icons for different quests
const QUEST_ICONS = ["🎬", "📖", "🎹", "📝", "🎯", "💡", "🚀", "🌟"];

export function RoadmapTimeline({
    quests,
    dailyLoads,
    startDate,
    endDate,
}: RoadmapTimelineProps) {
    const today = new Date().toISOString().split("T")[0];

    // Create quest-to-icon mapping
    const questIcons = useMemo(() => {
        const map = new Map<string, string>();
        quests.forEach((q, i) => {
            map.set(q.id, QUEST_ICONS[i % QUEST_ICONS.length]);
        });
        return map;
    }, [quests]);

    // Generate dates array (using UTC to avoid timezone/DST issues)
    const dates = useMemo(() => {
        const result: string[] = [];
        // Parse as UTC to avoid timezone issues
        const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
        const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
        const start = Date.UTC(startYear, startMonth - 1, startDay);
        const end = Date.UTC(endYear, endMonth - 1, endDay);
        const oneDay = 24 * 60 * 60 * 1000;

        for (let ts = start; ts <= end; ts += oneDay) {
            const d = new Date(ts);
            const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
            result.push(dateStr);
        }
        return result;
    }, [startDate, endDate]);

    // Get milestones for a specific date
    const getMilestonesForDate = (date: string) => {
        const milestones: Array<{
            questId: string;
            questTitle: string;
            icon: string;
            count: number;
        }> = [];

        for (const quest of quests) {
            const dayMilestones = quest.syllabus.filter(
                (m) => m.assignedDate === date
            );
            if (dayMilestones.length > 0) {
                milestones.push({
                    questId: quest.id,
                    questTitle: quest.title,
                    icon: questIcons.get(quest.id) || "📚",
                    count: dayMilestones.length,
                });
            }
        }

        return milestones;
    };

    return (
        <div className="overflow-x-auto px-6 py-4">
            <div className="flex gap-1 min-w-max">
                {dates.map((date) => {
                    const isToday = date === today;
                    const isPast = date < today;
                    const load = dailyLoads.find((l) => l.date === date);
                    const milestones = getMilestonesForDate(date);
                    const dateObj = new Date(date);

                    return (
                        <div
                            key={date}
                            className={cn(
                                "flex w-16 flex-col items-center rounded-xl border p-2 text-center transition-all",
                                isToday
                                    ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20"
                                    : isPast
                                        ? "border-slate-100 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-800/50"
                                        : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
                            )}
                        >
                            {/* Date header */}
                            <span
                                className={cn(
                                    "text-xs font-medium",
                                    isToday
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-slate-500"
                                )}
                            >
                                {dateObj.toLocaleDateString("en-US", { weekday: "short" })}
                            </span>
                            <span
                                className={cn(
                                    "text-lg font-bold",
                                    isToday
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-slate-900 dark:text-white"
                                )}
                            >
                                {dateObj.getDate()}
                            </span>

                            {/* Today indicator */}
                            {isToday && (
                                <span className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
                                    Today
                                </span>
                            )}

                            {/* Milestones */}
                            <div className="mt-1 flex flex-col items-center gap-0.5">
                                {milestones.slice(0, 3).map((m) => (
                                    <div
                                        key={m.questId}
                                        className="flex items-center gap-0.5 text-xs"
                                        title={m.questTitle}
                                    >
                                        <span>{m.icon}</span>
                                        {m.count > 1 && (
                                            <span className="text-slate-500">{m.count}</span>
                                        )}
                                    </div>
                                ))}
                                {milestones.length > 3 && (
                                    <span className="text-[10px] text-slate-400">
                                        +{milestones.length - 3}
                                    </span>
                                )}
                            </div>

                            {/* Load indicator */}
                            {load && load.totalMinutes > 0 && (
                                <div
                                    className={cn(
                                        "mt-1 rounded px-1 text-[10px] font-medium",
                                        load.totalMinutes > 180
                                            ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                                            : load.totalMinutes > 120
                                                ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                                                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    )}
                                >
                                    {Math.round(load.totalMinutes / 60)}h
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                {quests.map((quest) => (
                    <div key={quest.id} className="flex items-center gap-1">
                        <span>{questIcons.get(quest.id)}</span>
                        <span>{quest.title}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
