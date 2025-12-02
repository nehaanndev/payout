import { FlowSettings, FlowTask } from "@/types/flow";

export const parseTimeStringToDate = (dateKey: string, time: string) => {
    // time expected HH:mm
    const [hours, minutes] = time.split(":").map((value) => Number(value));
    const [year, month, day] = dateKey.split("-").map((value) => Number(value));
    return new Date(year, month - 1, day, hours, minutes || 0, 0, 0);
};

export const calculateFreeTime = (
    now: number,
    activeDate: string,
    settings: FlowSettings,
    tasks: FlowTask[]
): { hours: number; minutes: number } => {
    // 1. Determine the effective start time of the "availability window".
    //    This is the LATER of:
    //    - The current time (now)
    //    - The work start time for the active date
    const workStart = parseTimeStringToDate(activeDate, settings.workStart);
    const effectiveStart = new Date(Math.max(now, workStart.getTime()));

    // 2. Determine the end time of the "availability window".
    //    This is usually sleepStart (bedtime).
    //    Note: logic from FlowExperience used sleepEnd and sleepStart to determine day length.
    //    Here we assume the user wants to know how much time is left until they sleep.
    //    If sleepStart is "07:00" (next day) and activeDate is today, we need to handle crossing midnight?
    //    The original code did:
    //      start = sleepEnd (wake up)
    //      end = sleepStart (bedtime)
    //      activeMinutes = end - start
    //    But the issue says "calculate based on the time the page is opened or the work day start time".
    //    So we should use sleepStart as the hard deadline.

    let windowEnd = parseTimeStringToDate(activeDate, settings.sleepStart);

    // Handle case where sleepStart is technically the next day (e.g. 01:00)
    // If windowEnd is BEFORE workStart, it probably means it's the next day.
    if (windowEnd.getTime() < workStart.getTime()) {
        windowEnd = new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    // Calculate total remaining available minutes
    const remainingMinutes = (windowEnd.getTime() - effectiveStart.getTime()) / 1000 / 60;

    // If we are already past the end time, 0 free time.
    if (remainingMinutes < 0) {
        return { hours: 0, minutes: 0 };
    }

    // 3. Calculate committed time from PENDING tasks.
    //    We only care about tasks that are NOT done/skipped.
    //    We also exclude "play" (fun stuff doesn't count as 'committed' work usually? Or maybe it does?)
    //    Original code excluded "play" and "reminder".
    //    "Free time" usually means "Time I have available to do whatever I want (including Play)".
    //    So we subtract "Work", "Chores", "Growth", etc.
    //    But if I schedule "Play", does that reduce my "Free time"?
    //    Technically yes, if I scheduled it, it's "committed".
    //    BUT the original code explicitly EXCLUDED "play" from committedMinutes:
    //      t.category !== "play" && t.type !== "reminder"
    //    So we will stick to that logic for now.

    const committedMinutes = tasks
        .filter((t) =>
            t.category !== "play" &&
            t.type !== "reminder" &&
            t.status !== "done" &&
            t.status !== "skipped" &&
            t.status !== "failed"
        )
        .reduce((acc, t) => acc + t.estimateMinutes, 0);

    const freeMinutes = Math.max(0, remainingMinutes - committedMinutes);

    return {
        hours: Math.floor(freeMinutes / 60),
        minutes: Math.floor(freeMinutes % 60),
    };
};
