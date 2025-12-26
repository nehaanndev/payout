import { Quest, QuestMilestone } from "@/types/quest";
import { FlowTask, FlowSettings } from "@/types/flow";
import {
    ensureFlowPlan,
    saveFlowPlan,
    fetchFlowPlanSnapshot,
} from "@/lib/flowService";
import { fetchFlowSettings } from "@/lib/flowSettingsService";
import { generateId } from "@/lib/id";

// Schedule all milestones for a quest into Flow
export async function scheduleQuestToFlow(
    userId: string,
    quest: Quest,
    timezone: string
): Promise<QuestMilestone[]> {
    const settings = await fetchFlowSettings(userId, timezone);
    const updatedMilestones: QuestMilestone[] = [];

    // Group milestones by assigned date
    const milestonesByDate = new Map<string, QuestMilestone[]>();
    for (const milestone of quest.syllabus) {
        if (!milestone.assignedDate) continue;
        const existing = milestonesByDate.get(milestone.assignedDate) ?? [];
        existing.push(milestone);
        milestonesByDate.set(milestone.assignedDate, existing);
    }

    // Process each date
    for (const [dateKey, dayMilestones] of milestonesByDate) {
        const plan = await ensureFlowPlan(userId, dateKey, timezone);
        const existingTasks = plan.tasks;

        // Find time slots for each milestone
        for (const milestone of dayMilestones) {
            if (milestone.status === "scheduled" && milestone.flowTaskId) {
                // Already scheduled
                updatedMilestones.push(milestone);
                continue;
            }

            const startTime = findBestSlot(
                settings,
                existingTasks,
                milestone.durationMinutes
            );

            const endTime = calculateEndTime(startTime, milestone.durationMinutes);

            const flowTask: FlowTask = {
                id: generateId(),
                title: `🎯 Quest: ${milestone.title}`,
                type: "priority",
                category: "growth",
                estimateMinutes: milestone.durationMinutes,
                sequence: existingTasks.length + 1,
                locked: true,
                scheduledStart: startTime,
                scheduledEnd: endTime,
                status: "pending",
                notes: milestone.resourceUrl ?? milestone.description ?? null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            existingTasks.push(flowTask);

            updatedMilestones.push({
                ...milestone,
                status: "scheduled",
                flowTaskId: flowTask.id,
            });
        }

        // Save the updated plan
        await saveFlowPlan(userId, {
            ...plan,
            tasks: existingTasks,
        });
    }

    return updatedMilestones;
}

// Sync goal progress from Flow task completions
export async function syncProgressFromFlow(
    userId: string,
    quest: Quest,
    timezone: string
): Promise<{ updated: boolean; completedCount: number; updatedSyllabus: QuestMilestone[] }> {
    let updated = false;
    let completedCount = quest.completedUnits;
    const updatedSyllabus = [...quest.syllabus];

    const scheduledMilestones = quest.syllabus.filter(
        (m) => m.flowTaskId && m.status !== "done"
    );

    if (scheduledMilestones.length === 0) {
        return { updated: false, completedCount, updatedSyllabus };
    }

    // Group by date to minimize DB reads
    const milestonesByDate = new Map<string, QuestMilestone[]>();
    for (const m of scheduledMilestones) {
        if (!m.assignedDate) continue;
        const existing = milestonesByDate.get(m.assignedDate) ?? [];
        existing.push(m);
        milestonesByDate.set(m.assignedDate, existing);
    }

    for (const [dateKey, milestones] of milestonesByDate) {
        const plan = await fetchFlowPlanSnapshot(userId, dateKey);
        if (!plan) continue;

        for (const milestone of milestones) {
            const flowTask = plan.tasks.find((t) => t.id === milestone.flowTaskId);
            if (flowTask?.status === "done") {
                // Update the milestone in our copy of the syllabus
                const idx = updatedSyllabus.findIndex((m) => m.id === milestone.id);
                if (idx !== -1 && updatedSyllabus[idx].status !== "done") {
                    updatedSyllabus[idx] = { ...updatedSyllabus[idx], status: "done" };
                    completedCount++;
                    updated = true;
                }
            }
        }
    }

    // If there were updates, persist them to Firebase
    if (updated) {
        const { updateQuest } = await import("@/lib/questService");
        await updateQuest(userId, quest.id, {
            syllabus: updatedSyllabus,
            completedUnits: completedCount,
        });
    }

    return { updated, completedCount, updatedSyllabus };
}

// Find the best time slot for a task
function findBestSlot(
    settings: FlowSettings | null,
    existingTasks: FlowTask[],
    durationMinutes: number
): string {
    // Default work hours
    const workStart = settings?.workStart ?? "09:00";
    const workEnd = settings?.workEnd ?? "18:00";

    // Find gaps in existing schedule
    const occupiedSlots: Array<{ start: number; end: number }> = [];

    // Add meals as occupied
    if (settings?.meals) {
        for (const meal of settings.meals) {
            const mealStart = timeToMinutes(meal.time);
            occupiedSlots.push({
                start: mealStart,
                end: mealStart + meal.durationMinutes,
            });
        }
    }

    // Add existing tasks as occupied
    for (const task of existingTasks) {
        if (task.scheduledStart) {
            const start = timeToMinutes(task.scheduledStart);
            occupiedSlots.push({
                start,
                end: start + task.estimateMinutes,
            });
        }
    }

    // Sort by start time
    occupiedSlots.sort((a, b) => a.start - b.start);

    // Find first gap that fits
    const dayStart = timeToMinutes(workStart);
    const dayEnd = timeToMinutes(workEnd);

    let searchStart = dayStart;

    // Prefer morning slots (9am-12pm) for growth tasks
    const preferredSlots = [
        { start: timeToMinutes("09:00"), end: timeToMinutes("12:00") },
        { start: timeToMinutes("14:00"), end: timeToMinutes("17:00") },
    ];

    for (const preferred of preferredSlots) {
        const slotStart = Math.max(dayStart, preferred.start);
        const slotEnd = Math.min(dayEnd, preferred.end);

        for (let t = slotStart; t + durationMinutes <= slotEnd; t += 15) {
            const fits = !occupiedSlots.some(
                (occ) => t < occ.end && t + durationMinutes > occ.start
            );
            if (fits) {
                return minutesToTime(t);
            }
        }
    }

    // Fallback: find any gap
    for (let t = dayStart; t + durationMinutes <= dayEnd; t += 15) {
        const fits = !occupiedSlots.some(
            (occ) => t < occ.end && t + durationMinutes > occ.start
        );
        if (fits) {
            return minutesToTime(t);
        }
    }

    // No gap found, return work start
    return workStart;
}

// Helper: Convert "HH:MM" to minutes since midnight
function timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

// Helper: Convert minutes since midnight to "HH:MM"
function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// Helper: Calculate end time from start time and duration
function calculateEndTime(startTime: string, durationMinutes: number): string {
    const startMinutes = timeToMinutes(startTime);
    return minutesToTime(startMinutes + durationMinutes);
}
