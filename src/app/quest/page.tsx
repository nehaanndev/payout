"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Target, Calendar, Clock, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Quest } from "@/types/quest";
import {
    getUserQuests,
    calculateDailyLoad,
    getAverageDailyCommitment,
} from "@/lib/questService";
import { syncProgressFromFlow } from "@/lib/questFlowBridge";
import { RoadmapTimeline } from "./_components/RoadmapTimeline";
import { QuestCard } from "./_components/QuestCard";
import { QuestWizard } from "./_components/QuestWizard";
import { QuestDetailDialog } from "./_components/QuestDetailDialog";
import { cn } from "@/lib/utils";
import { getLocalDateKey, parseLocalDate } from "@/lib/dateUtils";

export default function QuestPage() {
    const { user } = useAuth();
    const [quests, setQuests] = useState<Quest[]>([]);
    const [loading, setLoading] = useState(true);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

    // Calculate date range for roadmap
    const dateRange = useMemo(() => {
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 14); // Show 2 weeks by default

        // Extend if any quest ends later
        for (const quest of quests) {
            // Use parseLocalDate to avoid UTC interpretation
            const questEnd = parseLocalDate(quest.endDate);
            if (questEnd > endDate) {
                endDate.setTime(questEnd.getTime());
            }
        }

        return {
            start: getLocalDateKey(today),
            end: getLocalDateKey(endDate),
        };
    }, [quests]);

    // Calculate daily loads
    const dailyLoads = useMemo(
        () => calculateDailyLoad(quests, dateRange.start, dateRange.end),
        [quests, dateRange]
    );

    const averageMinutes = useMemo(
        () => getAverageDailyCommitment(dailyLoads),
        [dailyLoads]
    );

    // Get today's tasks
    const todayKey = getLocalDateKey();
    const todayLoad = dailyLoads.find((l) => l.date === todayKey);

    // Load quests
    useEffect(() => {
        if (!user?.uid) return;

        const loadQuests = async () => {
            setLoading(true);
            try {
                const userQuests = await getUserQuests(user.uid);

                // Sync progress from Flow for each quest
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const syncedQuests: Quest[] = [];

                for (const quest of userQuests) {
                    const { updated, completedCount, updatedSyllabus } = await syncProgressFromFlow(
                        user.uid,
                        quest,
                        timezone
                    );
                    if (updated) {
                        syncedQuests.push({
                            ...quest,
                            completedUnits: completedCount,
                            syllabus: updatedSyllabus,
                        });
                    } else {
                        syncedQuests.push(quest);
                    }
                }

                setQuests(syncedQuests);
            } catch (error) {
                console.error("Failed to load quests:", error);
            } finally {
                setLoading(false);
            }
        };

        loadQuests();
    }, [user?.uid]);

    const activeQuests = quests.filter(
        (q) => q.status === "active" || q.status === "planning"
    );
    const completedQuests = quests.filter((q) => q.status === "completed");

    const handleQuestCreated = (quest: Quest) => {
        setQuests((prev) => [quest, ...prev]);
        setWizardOpen(false);
    };

    const formatMinutes = (mins: number) => {
        const hours = Math.floor(mins / 60);
        const minutes = mins % 60;
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    };

    const handleQuestUpdate = (updatedQuest: Quest) => {
        setQuests((prev) =>
            prev.map((q) => (q.id === updatedQuest.id ? updatedQuest : q))
        );
        setSelectedQuest(updatedQuest);
    };

    const handleQuestDelete = () => {
        if (selectedQuest) {
            setQuests((prev) => prev.filter((q) => q.id !== selectedQuest.id));
            setSelectedQuest(null);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="animate-pulse text-slate-500">Loading quests...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 shadow-lg shadow-amber-500/25">
                            <Target className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Quest
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Track your goals, conquer your quests
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setWizardOpen(true)}
                        className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-700"
                    >
                        <Plus className="h-4 w-4" />
                        New Quest
                    </Button>
                </div>

                {/* Roadmap (Hero) */}
                {quests.length > 0 && (
                    <section className="mb-8">
                        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-900/50">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-amber-500" />
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        Roadmap
                                    </span>
                                    <span className="text-sm text-slate-500">
                                        {dateRange.start} — {dateRange.end}
                                    </span>
                                </div>
                            </div>
                            <RoadmapTimeline
                                quests={quests}
                                dailyLoads={dailyLoads}
                                startDate={dateRange.start}
                                endDate={dateRange.end}
                            />
                        </div>
                    </section>
                )}

                {/* Daily Commitment Summary */}
                {quests.length > 0 && (
                    <section className="mb-8">
                        <div className="flex items-center gap-6 rounded-2xl border border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-emerald-500" />
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    Daily Commitment
                                </span>
                            </div>
                            <div className="flex items-center gap-4 overflow-x-auto pb-1">
                                {dailyLoads.slice(0, 7).map((load) => (
                                    <div
                                        key={load.date}
                                        className={cn(
                                            "flex flex-col items-center rounded-xl px-3 py-2 text-center",
                                            load.date === todayKey
                                                ? "bg-amber-100 dark:bg-amber-900/30"
                                                : "bg-slate-50 dark:bg-slate-800"
                                        )}
                                    >
                                        <span className="text-xs text-slate-500">
                                            {parseLocalDate(load.date).toLocaleDateString("en-US", {
                                                weekday: "short",
                                                day: "numeric",
                                            })}
                                        </span>
                                        <span
                                            className={cn(
                                                "font-semibold",
                                                load.totalMinutes > 180
                                                    ? "text-rose-600"
                                                    : "text-slate-900 dark:text-white"
                                            )}
                                        >
                                            {formatMinutes(load.totalMinutes)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="ml-auto flex items-center gap-2 border-l border-slate-200 pl-4 dark:border-slate-700">
                                <TrendingUp className="h-4 w-4 text-slate-400" />
                                <span className="text-sm text-slate-500">
                                    Avg: <strong>{formatMinutes(averageMinutes)}</strong>/day
                                </span>
                            </div>
                        </div>
                    </section>
                )}

                {/* Today's Focus */}
                {todayLoad && todayLoad.quests.length > 0 && (
                    <section className="mb-8">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                            📌 Today&apos;s Focus
                        </h2>
                        <div className="space-y-2">
                            {todayLoad.quests.map((q) => {
                                const quest = quests.find((quest) => quest.id === q.questId);
                                const todayMilestones = quest?.syllabus.filter(
                                    (m) => m.assignedDate === todayKey && m.status !== "done"
                                );
                                return todayMilestones?.map((milestone) => (
                                    <div
                                        key={milestone.id}
                                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">📚</span>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {quest?.title}: {milestone.title}
                                                </p>
                                                <p className="text-sm text-slate-500">
                                                    {formatMinutes(milestone.durationMinutes)}
                                                </p>
                                            </div>
                                        </div>
                                        {milestone.status === "scheduled" && (
                                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                In Flow
                                            </span>
                                        )}
                                    </div>
                                ));
                            })}
                        </div>
                    </section>
                )}

                {/* Active Quests */}
                <section className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                        🎯 Active Quests
                    </h2>
                    {activeQuests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 dark:border-slate-800 dark:bg-slate-900/50">
                            <Target className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
                            <p className="mb-2 text-lg font-medium text-slate-600 dark:text-slate-400">
                                No active quests
                            </p>
                            <p className="mb-4 text-sm text-slate-500">
                                Start your first quest to track your goals
                            </p>
                            <Button
                                onClick={() => setWizardOpen(true)}
                                variant="outline"
                                className="gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Create Quest
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {activeQuests.map((quest) => (
                                <QuestCard
                                    key={quest.id}
                                    quest={quest}
                                    onClick={() => setSelectedQuest(quest)}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Completed Quests */}
                {completedQuests.length > 0 && (
                    <section>
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                            ✅ Completed
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {completedQuests.map((quest) => (
                                <QuestCard
                                    key={quest.id}
                                    quest={quest}
                                    onClick={() => setSelectedQuest(quest)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Quest Wizard */}
                <QuestWizard
                    open={wizardOpen}
                    onClose={() => setWizardOpen(false)}
                    onComplete={handleQuestCreated}
                    existingQuests={quests}
                />

                {/* Quest Detail Dialog */}
                {user && (
                    <QuestDetailDialog
                        quest={selectedQuest}
                        userId={user.uid}
                        onClose={() => setSelectedQuest(null)}
                        onUpdate={handleQuestUpdate}
                        onDelete={handleQuestDelete}
                    />
                )}
            </div>
        </div>
    );
}
