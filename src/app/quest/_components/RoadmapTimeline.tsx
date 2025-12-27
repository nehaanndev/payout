"use client";

import { useMemo } from "react";
import { Quest, DailyLoad } from "@/types/quest";
import { cn } from "@/lib/utils";
import { getLocalDateKey, parseLocalDate } from "@/lib/dateUtils";

type RoadmapTimelineProps = {
    quests: Quest[];
    dailyLoads: DailyLoad[];
    startDate: string;
    endDate: string;
};

// Color palette for quest pills (20 harmonious colors)
const QUEST_COLORS = [
    { bg: "bg-rose-500", text: "text-white" },
    { bg: "bg-sky-500", text: "text-white" },
    { bg: "bg-amber-500", text: "text-white" },
    { bg: "bg-emerald-500", text: "text-white" },
    { bg: "bg-violet-500", text: "text-white" },
    { bg: "bg-orange-500", text: "text-white" },
    { bg: "bg-teal-500", text: "text-white" },
    { bg: "bg-pink-500", text: "text-white" },
    { bg: "bg-indigo-500", text: "text-white" },
    { bg: "bg-lime-500", text: "text-white" },
    { bg: "bg-cyan-500", text: "text-white" },
    { bg: "bg-fuchsia-500", text: "text-white" },
    { bg: "bg-red-500", text: "text-white" },
    { bg: "bg-blue-500", text: "text-white" },
    { bg: "bg-yellow-500", text: "text-slate-900" },
    { bg: "bg-green-500", text: "text-white" },
    { bg: "bg-purple-500", text: "text-white" },
    { bg: "bg-stone-500", text: "text-white" },
    { bg: "bg-slate-600", text: "text-white" },
    { bg: "bg-zinc-500", text: "text-white" },
];

// Extract 1-2 letter abbreviation from quest title
function getQuestAbbreviation(title: string): string {
    const words = title.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
    }
    // Take first letter of first two words
    return (words[0][0] + words[1][0]).toUpperCase();
}

export function RoadmapTimeline({
    quests,
    dailyLoads,
    startDate,
    endDate,
}: RoadmapTimelineProps) {
    // Use getLocalDateKey to get today's date in local timezone
    const today = getLocalDateKey();

    // Create quest-to-color mapping
    const questStyles = useMemo(() => {
        const map = new Map<string, { colorIndex: number; abbr: string }>();
        quests.forEach((q, i) => {
            map.set(q.id, {
                colorIndex: i % QUEST_COLORS.length,
                abbr: getQuestAbbreviation(q.title),
            });
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
            colorIndex: number;
            abbr: string;
            count: number;
        }> = [];

        for (const quest of quests) {
            const dayMilestones = quest.syllabus.filter(
                (m) => m.assignedDate === date
            );
            if (dayMilestones.length > 0) {
                const style = questStyles.get(quest.id);
                milestones.push({
                    questId: quest.id,
                    questTitle: quest.title,
                    colorIndex: style?.colorIndex ?? 0,
                    abbr: style?.abbr ?? "?",
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
                    // Use parseLocalDate to avoid UTC interpretation of YYYY-MM-DD strings
                    const dateObj = parseLocalDate(date);

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
                                {milestones.slice(0, 3).map((m) => {
                                    const color = QUEST_COLORS[m.colorIndex];
                                    return (
                                        <div
                                            key={m.questId}
                                            className="flex items-center gap-0.5"
                                            title={m.questTitle}
                                        >
                                            <span
                                                className={cn(
                                                    "flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold",
                                                    color.bg,
                                                    color.text
                                                )}
                                            >
                                                {m.abbr}
                                            </span>
                                            {m.count > 1 && (
                                                <span className="text-[10px] text-slate-500">{m.count}</span>
                                            )}
                                        </div>
                                    );
                                })}
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
                {quests.map((quest) => {
                    const style = questStyles.get(quest.id);
                    const color = QUEST_COLORS[style?.colorIndex ?? 0];
                    return (
                        <div key={quest.id} className="flex items-center gap-1.5">
                            <span
                                className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold",
                                    color.bg,
                                    color.text
                                )}
                            >
                                {style?.abbr ?? "?"}
                            </span>
                            <span>{quest.title}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
