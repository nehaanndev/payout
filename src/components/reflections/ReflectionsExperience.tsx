"use client";

import { useEffect, useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import {
    ChevronLeft,
    Smile,
    CheckCircle2,
} from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { getFlowPlansInRange, getFlowDateKey } from "@/lib/flowService";
import { useToodlTheme } from "@/hooks/useToodlTheme";
import { cn } from "@/lib/utils";
import type { FlowPlan } from "@/types/flow";
import type { User } from "firebase/auth";

type ReflectionsExperienceProps = {
    user: User | null;
    onClose?: () => void;
};

type TimeRange = "week" | "month" | "3months" | "year";

const TIME_RANGES: { id: TimeRange; label: string; days: number }[] = [
    { id: "week", label: "Past Week", days: 7 },
    { id: "month", label: "Past Month", days: 30 },
    { id: "3months", label: "Past 3 Months", days: 90 },
    { id: "year", label: "Past Year", days: 365 },
];

export function ReflectionsExperience({ user, onClose }: ReflectionsExperienceProps) {
    const { isNight } = useToodlTheme();
    const [timeRange, setTimeRange] = useState<TimeRange>("month");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [plans, setPlans] = useState<FlowPlan[]>([]);

    useEffect(() => {
        if (!user) return;

        const fetchReflections = async () => {
            setLoading(true);
            try {
                const range = TIME_RANGES.find((r) => r.id === timeRange)!;
                const endDate = getFlowDateKey(new Date());
                const startDate = getFlowDateKey(subDays(new Date(), range.days));

                const fetchedPlans = await getFlowPlansInRange(user.uid, startDate, endDate);
                // Sort by date descending
                fetchedPlans.sort((a, b) => b.date.localeCompare(a.date));
                setPlans(fetchedPlans);
            } catch (error) {
                console.error("Error fetching reflections:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReflections();
    }, [user, timeRange]);

    const reflections = useMemo(() => {
        return plans.flatMap((plan) =>
            plan.reflections.map((reflection) => ({
                ...reflection,
                planDate: plan.date,
                planTasks: plan.tasks,
            }))
        );
    }, [plans]);

    const getMoodIcon = (mood?: string | null) => {
        if (!mood) return <Smile className="h-5 w-5 text-slate-400" />;
        // Simple mapping, can be expanded based on actual mood values
        return <span className="text-2xl">{mood}</span>;
    };

    return (
        <div className={cn("flex flex-col h-full flex-1 min-h-0", isNight ? "text-slate-100" : "text-slate-900")}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Reflections</h2>
                    <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-500")}>
                        Your journey through time, captured in moments.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Select
                        value={timeRange}
                        onValueChange={(v) => setTimeRange(v as TimeRange)}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIME_RANGES.map((range) => (
                                <SelectItem key={range.id} value={range.id}>
                                    {range.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-8 max-w-3xl mx-auto p-6">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex gap-4">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-[200px]" />
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            </div>
                        ))
                    ) : reflections.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="mx-auto h-24 w-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <Smile className="h-10 w-10 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium">No reflections found</h3>
                            <p className="text-slate-500">
                                Start adding reflections in Flow to see them here.
                            </p>
                        </div>
                    ) : (
                        reflections.map((reflection, idx) => (
                            <div key={`${reflection.planDate}-${idx}`} className="relative pl-8 border-l border-slate-200 dark:border-slate-800 last:border-0 pb-8 last:pb-0">
                                <div className="absolute -left-4 top-0 h-8 w-8 rounded-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm">
                                    {getMoodIcon(reflection.mood)}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-baseline justify-between">
                                        <h3 className="text-lg font-semibold">
                                            {format(new Date(reflection.planDate + 'T12:00:00'), "EEEE, MMMM do, yyyy")}
                                        </h3>
                                        <span className="text-xs text-slate-500 font-mono">
                                            {format(new Date(reflection.createdAt), "h:mm a")}
                                        </span>
                                    </div>

                                    <Card className={cn("overflow-hidden transition-all hover:shadow-md", isNight ? "bg-slate-900 border-slate-800" : "bg-white")}>
                                        <CardContent className="p-6 space-y-4">
                                            {reflection.photoUrl && (
                                                <div
                                                    className="relative h-48 w-full overflow-hidden rounded-lg cursor-pointer transition-opacity hover:opacity-90"
                                                    onClick={() => reflection.photoUrl && setSelectedImage(reflection.photoUrl)}
                                                >
                                                    <Image
                                                        src={reflection.photoUrl}
                                                        alt="Reflection"
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            )}

                                            <p className="text-base leading-relaxed whitespace-pre-wrap">
                                                {reflection.note}
                                            </p>

                                            <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                    <span>
                                                        {reflection.planTasks.filter(t => t.status === 'done').length} tasks completed
                                                    </span>
                                                </div>
                                                {reflection.moodLabel && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {reflection.moodLabel}
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>

            <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                    {selectedImage && (
                        <div className="relative w-full h-[80vh]">
                            <Image
                                src={selectedImage}
                                alt="Reflection Full View"
                                fill
                                className="object-contain"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}
