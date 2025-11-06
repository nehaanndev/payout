import { beforeAll, describe, expect, it, vi } from "vitest";

import { planDeterministicAddFlowTask } from "@/lib/mind/rules/addFlowTaskRule";
import { MindExperienceSnapshot } from "@/lib/mind/types";

const BASE_DATE = new Date("2025-02-15T12:00:00.000Z");

const BASE_SNAPSHOT: MindExperienceSnapshot = {
  expenses: { groups: [] },
  budget: {
    activeBudgetId: null,
    month: null,
    netPlannedMinor: undefined,
    netSpentMinor: undefined,
    currency: "USD",
    documents: [],
  },
  flow: {
    today: null,
    tomorrow: null,
    upcomingTasks: [],
  },
  shares: { recent: [] },
};

type FlowExpectation = {
  title: string;
  durationMinutes: number;
  scheduledFor?: string;
  startsAt?: string;
  minConfidence?: number;
};

const formatDurationDisplay = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
  }
  if (remaining > 0 || parts.length === 0) {
    parts.push(`${remaining} min${remaining === 1 ? "" : "s"}`);
  }
  return parts.join(" ");
};

const CASES: Array<{ name: string; utterance: string; expected: FlowExpectation }> = [
  {
    name: "schedules a session with relative date and time",
    utterance: "Schedule yoga session tomorrow at 6am for 45 minutes.",
    expected: {
      title: "Yoga Session",
      durationMinutes: 45,
      scheduledFor: "tomorrow",
      startsAt: "6:00am",
      minConfidence: 0.75,
    },
  },
  {
    name: "handles absolute ISO date and decimal hours",
    utterance: "Plan deep work block on 2025-03-10 at 9:30am for 1.5 hours.",
    expected: {
      title: "Deep Work Block",
      durationMinutes: 90,
      scheduledFor: "2025-03-10",
      startsAt: "9:30am",
      minConfidence: 0.72,
    },
  },
  {
    name: "parses 24 hour time with today keyword",
    utterance: "Add team sync meeting today @ 14:00 for 30 min.",
    expected: {
      title: "Add Team Sync Meeting",
      durationMinutes: 30,
      scheduledFor: "today",
      startsAt: "14:00",
      minConfidence: 0.7,
    },
  },
  {
    name: "understands month name date and minutes",
    utterance: "Set up customer interview meeting on March 7 at 4:15pm for 50 minutes.",
    expected: {
      title: "Customer Interview Meeting",
      durationMinutes: 50,
      scheduledFor: "2025-03-07",
      startsAt: "4:15pm",
      minConfidence: 0.7,
    },
  },
  {
    name: "accepts slash style date and evening time",
    utterance: "Block reading hour on 4/12 at 8pm for 60 minutes.",
    expected: {
      title: "Reading Hour",
      durationMinutes: 60,
      scheduledFor: "2025-04-12",
      startsAt: "8:00pm",
      minConfidence: 0.7,
    },
  },
  {
    name: "defaults duration when missing explicit minutes",
    utterance: "Create weekly planning block tomorrow morning at 10:00.",
    expected: {
      title: "Weekly Planning Block Morning",
      durationMinutes: 30,
      scheduledFor: "tomorrow",
      startsAt: "10:00",
      minConfidence: 0.65,
    },
  },
  {
    name: "captures noon keyword",
    utterance: "Schedule customer lunch meeting on March 21 at noon for 90 minutes.",
    expected: {
      title: "Customer Lunch Meeting",
      durationMinutes: 90,
      scheduledFor: "2025-03-21",
      startsAt: "12:00pm",
      minConfidence: 0.7,
    },
  },
  {
    name: "handles statements without explicit date",
    utterance: "Plan focus sprint at 7:30am for an hour.",
    expected: {
      title: "Focus Sprint",
      durationMinutes: 60,
      scheduledFor: undefined,
      startsAt: "7:30am",
      minConfidence: 0.65,
    },
  },
];

describe("planDeterministicAddFlowTask", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_DATE);
  });

  CASES.forEach(({ name, utterance, expected }) => {
    it(name, () => {
      const result = planDeterministicAddFlowTask(utterance, BASE_SNAPSHOT);

      expect(result).toBeTruthy();
      expect(result?.intent.tool).toBe("add_flow_task");

      expect(result?.intent.input.title).toBe(expected.title);
      expect(result?.intent.input.durationMinutes).toBe(expected.durationMinutes);

      if (expected.scheduledFor) {
        expect(result?.intent.input.scheduledFor).toBe(expected.scheduledFor);
      } else {
        expect(result?.intent.input.scheduledFor).toBeUndefined();
      }

      if (expected.startsAt) {
        expect(result?.intent.input.startsAt).toBe(expected.startsAt);
      } else {
        expect(result?.intent.input.startsAt).toBeUndefined();
      }

      const minConfidence = expected.minConfidence ?? 0.65;
      expect(result?.confidence ?? 0).toBeGreaterThanOrEqual(minConfidence);

      const durationDisplay = formatDurationDisplay(expected.durationMinutes);
      expect(result?.message).toContain(expected.title);
      expect(result?.message).toContain(durationDisplay);

      const editable = result?.editableMessage;
      expect(editable).toBeTruthy();
      expect(editable?.template).toContain("{{title}}");
      expect(editable?.template).toContain("{{duration}}");

      const titleField = editable?.fields.find((field) => field.key === "title");
      expect(titleField?.value).toBe(expected.title);

      const durationField = editable?.fields.find((field) => field.key === "duration");
      expect(durationField?.value).toBe(durationDisplay);
    });
  });

  it("returns null for non scheduling utterances", () => {
    const utterance = "Summarize my Orbit status";
    const result = planDeterministicAddFlowTask(utterance, BASE_SNAPSHOT);
    expect(result).toBeNull();
  });
});
