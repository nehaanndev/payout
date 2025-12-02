import { describe, it, expect } from "vitest";
import { calculateFreeTime, parseTimeStringToDate } from "./flowCalculator";
import { FlowSettings, FlowTask } from "@/types/flow";

describe("flowCalculator", () => {
    const mockSettings: FlowSettings = {
        workStart: "09:00",
        sleepStart: "23:00",
        sleepEnd: "07:00",
        meals: [],
        fixedEvents: [],
        workEnd: "17:00",
        timezone: "UTC",
        updatedAt: new Date().toISOString(),
    };

    const baseDate = "2023-10-27"; // A Friday

    const createMockTask = (
        id: string,
        category: FlowTask["category"],
        estimateMinutes: number,
        status: FlowTask["status"] = "pending"
    ): FlowTask => ({
        id,
        title: "Task",
        category,
        type: "chore",
        estimateMinutes,
        status,
        sequence: 0,
        createdAt: "",
        updatedAt: "",
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: null,
        actualEnd: null,
        notes: null,
    });

    it("calculates free time correctly when now is before work start", () => {
        // Now is 08:00. Work starts 09:00. Window should be 09:00 - 23:00 = 14 hours (840 mins).
        // No tasks.
        const now = parseTimeStringToDate(baseDate, "08:00").getTime();
        const result = calculateFreeTime(now, baseDate, mockSettings, []);

        expect(result).toEqual({ hours: 14, minutes: 0 });
    });

    it("calculates free time correctly when now is during work day", () => {
        // Now is 13:00. Window should be 13:00 - 23:00 = 10 hours (600 mins).
        const now = parseTimeStringToDate(baseDate, "13:00").getTime();
        const result = calculateFreeTime(now, baseDate, mockSettings, []);

        expect(result).toEqual({ hours: 10, minutes: 0 });
    });

    it("subtracts pending work tasks", () => {
        // Now is 13:00. Remaining window: 10 hours (600 mins).
        // 2 hours of pending work.
        // Free time should be 8 hours.
        const now = parseTimeStringToDate(baseDate, "13:00").getTime();
        const tasks = [
            createMockTask("1", "work", 60),
            createMockTask("2", "work", 60),
        ];
        const result = calculateFreeTime(now, baseDate, mockSettings, tasks);

        expect(result).toEqual({ hours: 8, minutes: 0 });
    });

    it("does not subtract done tasks", () => {
        // Now is 13:00. Remaining window: 10 hours (600 mins).
        // 1 hour pending, 1 hour done.
        // Free time should be 9 hours.
        const now = parseTimeStringToDate(baseDate, "13:00").getTime();
        const tasks = [
            createMockTask("1", "work", 60, "pending"),
            createMockTask("2", "work", 60, "done"),
        ];
        const result = calculateFreeTime(now, baseDate, mockSettings, tasks);

        expect(result).toEqual({ hours: 9, minutes: 0 });
    });

    it("does not subtract play tasks", () => {
        // Now is 13:00. Remaining window: 10 hours (600 mins).
        // 1 hour pending work, 1 hour pending play.
        // Free time should be 9 hours (play doesn't reduce free time).
        const now = parseTimeStringToDate(baseDate, "13:00").getTime();
        const tasks = [
            createMockTask("1", "work", 60, "pending"),
            createMockTask("2", "play", 60, "pending"),
        ];
        const result = calculateFreeTime(now, baseDate, mockSettings, tasks);

        expect(result).toEqual({ hours: 9, minutes: 0 });
    });

    it("returns 0 if committed time exceeds remaining time", () => {
        // Now is 22:00. Remaining window: 1 hour (60 mins).
        // 2 hours pending work.
        // Free time should be 0.
        const now = parseTimeStringToDate(baseDate, "22:00").getTime();
        const tasks = [
            createMockTask("1", "work", 120, "pending"),
        ];
        const result = calculateFreeTime(now, baseDate, mockSettings, tasks);

        expect(result).toEqual({ hours: 0, minutes: 0 });
    });

    it("handles sleepStart being next day (e.g. 01:00)", () => {
        const lateSettings = { ...mockSettings, sleepStart: "01:00" };
        // Now is 23:00. Window ends 01:00 next day.
        // Remaining: 2 hours.
        const now = parseTimeStringToDate(baseDate, "23:00").getTime();
        const result = calculateFreeTime(now, baseDate, lateSettings, []);

        expect(result).toEqual({ hours: 2, minutes: 0 });
    });
});
