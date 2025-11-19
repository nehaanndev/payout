export type FlowCategory =
  | "work"
  | "family"
  | "home"
  | "wellness"
  | "play"
  | "growth";

export type FlowTaskType = "priority" | "chore" | "flex";

export type FlowTaskStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "skipped"
  | "failed";

export type FlowTask = {
  id: string;
  title: string;
  type: FlowTaskType;
  category: FlowCategory;
  estimateMinutes: number;
  sequence: number;
  locked?: boolean;
  templateId?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  status: FlowTaskStatus;
  notes?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FlowReflectionSentiment = "positive" | "neutral" | "challenging";

export type FlowReflection = {
  id: string;
  taskId: string | null;
  note: string;
  sentiment: FlowReflectionSentiment;
  mood?: string | null;
  moodLabel?: string | null;
  photoUrl?: string | null;
  createdAt: string;
};

export type FlowPlan = {
  id: string;
  date: string;
  timezone: string;
  startTime: string;
  autoScheduleEnabled?: boolean;
  tasks: FlowTask[];
  reflections: FlowReflection[];
  createdAt: string;
  updatedAt: string;
};

export type FlowMealPreference = {
  id: "lunch" | "dinner" | string;
  label: string;
  time: string;
  durationMinutes: number;
};

export type FlowFixedEventPreference = {
  id: string;
  label: string;
  category: FlowCategory;
  startTime: string;
  durationMinutes: number;
  days?: FlowDayOfWeek[];
  tags?: string[];
};

export type FlowDayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const FLOW_DAY_ORDER: FlowDayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export type FlowSleepOverrides = Partial<
  Record<
    FlowDayOfWeek,
    {
      sleepStart: string;
      sleepEnd: string;
    }
  >
>;

export type FlowSettings = {
  workStart: string;
  workEnd: string;
  sleepStart: string;
  sleepEnd: string;
  meals: FlowMealPreference[];
  fixedEvents: FlowFixedEventPreference[];
  sleepOverrides?: FlowSleepOverrides;
  updatedAt: string;
  timezone: string;
};
