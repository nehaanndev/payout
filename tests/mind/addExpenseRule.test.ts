import { describe, expect, it } from "vitest";
import { planDeterministicAddExpense } from "@/lib/mind/rules/addExpenseRule";
import { MindExperienceSnapshot } from "@/lib/mind/types";

type TestGroup = {
  canonical: string;
  variants: string[];
};

type PatternContext = {
  group: TestGroup;
  variant: string;
  groupIndex: number;
  patternIndex: number;
};

type TestCase = {
  utterance: string;
  expected: {
    amountMinor: number;
    currency?: string;
    description?: string;
    groupName?: string;
    occurredAt?: string;
    minConfidence?: number;
  };
};

const ensureGroupWord = (variant: string) => {
  const trimmed = variant.trim();
  if (/\b(group|crew|team|fund)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} group`;
};

const TEST_GROUPS: TestGroup[] = [
  {
    canonical: "40th Birthday",
    variants: ["40th birthday", "40th bday crew", "the 40th birthday group"],
  },
  {
    canonical: "Ski Trip 2025",
    variants: ["Ski Trip 2025", "ski trip 2025 crew", "ski trip group"],
  },
  {
    canonical: "Team Lunch",
    variants: ["Team Lunch", "team lunch fund", "team lunch group"],
  },
  {
    canonical: "Wedding Crew",
    variants: ["wedding crew", "Wedding Group", "wedding celebration group"],
  },
  {
    canonical: "Family Reunion",
    variants: ["family reunion", "family reunion group", "reunion crew"],
  },
  {
    canonical: "Beach House",
    variants: ["beach house share", "Beach House Group", "beach house"],
  },
  {
    canonical: "Supper Club",
    variants: ["supper club", "supper club crew", "supper club group"],
  },
  {
    canonical: "Road Trip",
    variants: ["road trip squad", "road trip", "road trip group"],
  },
  {
    canonical: "NYC Weekend",
    variants: ["nyc weekend", "nyc wknd crew", "NYC Weekend group"],
  },
  {
    canonical: "Quarterly Offsite",
    variants: ["quarterly offsite", "offsite crew", "quarterly offsite group"],
  },
];

const BASE_SNAPSHOT: MindExperienceSnapshot = {
  expenses: {
    groups: TEST_GROUPS.map((group, index) => ({
      id: `group-${index}`,
      name: group.canonical,
      currency: index % 3 === 0 ? "USD" : index % 3 === 1 ? "EUR" : "USD",
      outstandingBalanceMinor: 0,
      youOweMinor: 0,
      owedToYouMinor: 0,
      recentExpenses: [],
      members: [],
      memberCount: 0,
      primaryMemberId: null,
    })),
  },
  budget: {
    activeBudgetId: null,
    month: null,
    netPlannedMinor: 0,
    netSpentMinor: 0,
    currency: "USD",
    monthKey: null,
  },
  flow: {
    today: null,
    tomorrow: null,
    upcomingTasks: [],
  },
  shares: {
    recent: [],
  },
};

const patterns: Array<(context: PatternContext) => TestCase> = [
  (context) => {
    const amount = 20 + context.groupIndex;
    const mention = ensureGroupWord(context.variant);
    return {
      utterance: `Add an expense for $${amount.toFixed(
        2
      )} gas in the ${mention}.`,
      expected: {
        amountMinor: Math.round(amount * 100),
        currency: "USD",
        description: "Gas",
        groupName: context.group.canonical,
        minConfidence: 0.75,
      },
    };
  },
  (context) => {
    const amount = 48.75 + context.groupIndex;
    const mention = ensureGroupWord(context.variant);
    return {
      utterance: `Log $${amount.toFixed(
        2
      )} spent on groceries to ${mention}.`,
      expected: {
        amountMinor: Math.round(amount * 100),
        currency: "USD",
        description: "Groceries",
        groupName: context.group.canonical,
        minConfidence: 0.72,
      },
    };
  },
  (context) => {
    const amount = 15.5 + context.groupIndex;
    const mention = ensureGroupWord(context.variant);
    return {
      utterance: `Record ${amount.toFixed(
        2
      )} bucks for snacks under the ${mention}.`,
      expected: {
        amountMinor: Math.round(amount * 100),
        currency: "USD",
        description: "Snacks",
        groupName: context.group.canonical,
        minConfidence: 0.7,
      },
    };
  },
  (context) => {
    const amount = 9.25 + context.groupIndex;
    const mention = ensureGroupWord(context.variant);
    return {
      utterance: `Track ${amount.toFixed(
        2
      )} bucks on breakfast burritos in ${mention}.`,
      expected: {
        amountMinor: Math.round(amount * 100),
        currency: "USD",
        description: "Breakfast Burritos",
        groupName: context.group.canonical,
        minConfidence: 0.68,
      },
    };
  },
  (context) => {
    const amount = 34 + context.groupIndex;
    const mention = ensureGroupWord(context.variant);
    return {
      utterance: `Add $${amount.toFixed(
        2
      )} fuel expense to the ${mention} tonight.`,
      expected: {
        amountMinor: Math.round(amount * 100),
        currency: "USD",
        description: "Gas",
        groupName: context.group.canonical,
        occurredAt: "tonight",
        minConfidence: 0.7,
      },
    };
  },
  (context) => {
    const amount = 62.25 + context.groupIndex;
    const mention = ensureGroupWord(context.variant);
    const day = ((context.groupIndex % 9) + 1).toString().padStart(2, "0");
    return {
      utterance: `Please add expense: $${amount.toFixed(
        2
      )} for Uber rides in the ${mention} on 2024-12-${day}.`,
      expected: {
        amountMinor: Math.round(amount * 100),
        currency: "USD",
        description: "Ride Share",
        groupName: context.group.canonical,
        occurredAt: `2024-12-${day}`,
        minConfidence: 0.8,
      },
    };
  },
  (context) => {
    const amount = 470 + context.groupIndex * 10;
    const mention = ensureGroupWord(context.variant);
    return {
      utterance: `₹${amount} petrol in the ${mention}, log it.`,
      expected: {
        amountMinor: Math.round(amount * 100),
        currency: "INR",
        description: "Gas",
        groupName: context.group.canonical,
        minConfidence: 0.65,
      },
    };
  },
  (context) => {
    const amount = 45 + context.groupIndex;
    const mention = ensureGroupWord(context.variant);
    return {
      utterance: `Track ${amount} euros on coffee for the ${mention}.`,
      expected: {
        amountMinor: amount * 100,
        currency: "EUR",
        description: "Coffee",
        groupName: context.group.canonical,
        minConfidence: 0.67,
      },
    };
  },
  (context) => {
    const amount = 28.5 + context.groupIndex;
    const mention = ensureGroupWord(context.variant);
    return {
      utterance: `Record £${amount.toFixed(
        2
      )} spent on snacks in our ${mention}.`,
      expected: {
        amountMinor: Math.round(amount * 100),
        currency: "GBP",
        description: "Snacks",
        groupName: context.group.canonical,
        minConfidence: 0.7,
      },
    };
  },
  (context) => {
    const amount = 120 + context.groupIndex;
    const mention = ensureGroupWord(context.variant);
    return {
      utterance: `Add ${amount} cad for lodging to the ${mention} tomorrow.`,
      expected: {
        amountMinor: amount * 100,
        currency: "CAD",
        description: "Lodging",
        groupName: context.group.canonical,
        occurredAt: "tomorrow",
        minConfidence: 0.66,
      },
    };
  },
];

const buildTestCases = (): TestCase[] => {
  const cases: TestCase[] = [];
  TEST_GROUPS.forEach((group, groupIndex) => {
    patterns.forEach((createCase, patternIndex) => {
      const variant =
        group.variants[(groupIndex + patternIndex) % group.variants.length];
      const testCase = createCase({
        group,
        variant,
        groupIndex,
        patternIndex,
      });
      if (!testCase.expected.groupName) {
        testCase.expected.groupName = group.canonical;
      }
      if (!testCase.expected.minConfidence) {
        testCase.expected.minConfidence = 0.6;
      }
      cases.push(testCase);
    });
  });
  return cases;
};

describe("planDeterministicAddExpense", () => {
  const snapshot = BASE_SNAPSHOT;
  const cases = buildTestCases();
  it("generates around 100 positive cases for validation", () => {
    expect(cases.length).toBe(100);
  });

  cases.forEach((testCase, index) => {
    it(`parses structured expense case #${index + 1}`, () => {
      const result = planDeterministicAddExpense(
        testCase.utterance,
        snapshot
      );
      expect(result).toBeTruthy();
      expect(result?.intent.tool).toBe("add_expense");
      expect(result?.intent.input.amountMinor).toBe(
        testCase.expected.amountMinor
      );

      if (testCase.expected.currency) {
        expect(result?.intent.input.currency).toBe(
          testCase.expected.currency
        );
      }

      if (testCase.expected.description) {
        expect(result?.intent.input.description).toBe(
          testCase.expected.description
        );
      }

      if (testCase.expected.groupName) {
        expect(result?.intent.input.groupName).toBe(
          testCase.expected.groupName
        );
      }

      if (testCase.expected.occurredAt) {
        expect(result?.intent.input.occurredAt).toBe(
          testCase.expected.occurredAt
        );
      }

      expect(result?.confidence ?? 0).toBeGreaterThanOrEqual(
        testCase.expected.minConfidence ?? 0.6
      );
      expect(typeof result?.message).toBe("string");
      expect(result?.message.length ?? 0).toBeGreaterThan(5);
    });
  });

  describe("negative scenarios", () => {
    const negatives = [
      "Remind me to call mom tomorrow",
      "Schedule yoga for 45 minutes",
      "How much did we spend last month?",
      "Add expense in ski trip group", // missing amount
      "Twenty dollars gas in the birthday group", // missing numeric prefix
    ];

    negatives.forEach((utterance, idx) => {
      it(`returns null when heuristics are not satisfied (#${idx + 1})`, () => {
        const result = planDeterministicAddExpense(utterance, snapshot);
        expect(result).toBeNull();
      });
    });
  });
});
