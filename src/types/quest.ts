export type QuestType = "known" | "unknown";
export type QuestStatus = "planning" | "active" | "completed" | "paused";
export type MilestoneStatus = "pending" | "scheduled" | "done" | "skipped";
export type ResourceType = "video" | "article" | "practice" | "other";

export type Quest = {
    id: string;
    title: string;
    description?: string;
    type: QuestType;
    status: QuestStatus;

    // Timeline
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD

    // Time allocation
    dailyMinutes: number;
    availableDays: string[]; // ['monday', 'tuesday', ...]

    // Scope (for known syllabus)
    totalUnits?: number; // e.g., 24 videos, 300 pages
    unitLabel?: string; // "videos", "pages", "chapters"
    unitDurationMinutes?: number;

    // Syllabus (generated or user-provided)
    syllabus: QuestMilestone[];

    // Progress
    completedUnits: number;

    createdAt: string;
    updatedAt: string;
};

export type QuestMilestone = {
    id: string;
    day: number;
    title: string;
    description?: string;
    durationMinutes: number;
    resourceUrl?: string; // YouTube link, article URL
    resourceType?: ResourceType;
    assignedDate?: string; // YYYY-MM-DD
    status: MilestoneStatus;
    flowTaskId?: string; // Link to Flow task when scheduled
};

export type ClarifyingQuestion = {
    id: string;
    question: string;
    inputType: "text" | "number" | "select" | "multi-select" | "days";
    options?: string[];
    required: boolean;
};

export type ClarifyingAnswer = {
    questionId: string;
    value: string | number | string[];
};

// Used for capacity calculations
export type DailyLoad = {
    date: string; // YYYY-MM-DD
    totalMinutes: number;
    quests: Array<{
        questId: string;
        questTitle: string;
        minutes: number;
    }>;
};
