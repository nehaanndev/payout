import { describe, expect, it } from "vitest";

import { planDeterministicAddBudget } from "@/lib/mind/rules/addBudgetRule";
import { MindExperienceSnapshot } from "@/lib/mind/types";

type BudgetVariant = {
  id: string;
  title: string;
  currency?: string | null;
  variants: string[];
};

type PatternContext = {
  budget: BudgetVariant;
  budgetIndex: number;
  patternIndex: number;
};

type TestCase = {
  utterance: string;
  snapshot: MindExperienceSnapshot;
  expected: {
    amountMinor: number;
    amountDisplay: string;
    budgetId?: string;
    budgetTitle: string;
    category?: string;
    merchant?: string | null;
    description: string;
    minConfidence?: number;
  };
};

const TEST_BUDGETS: BudgetVariant[] = [
  {
    id: "budget-1",
    title: "Home Budget",
    currency: "USD",
    variants: ["home", "home budget", "our home budget"],
  },
  {
    id: "budget-2",
    title: "Side Hustle Budget",
    currency: "USD",
    variants: ["side hustle", "hustle budget", "side hustle budget"],
  },
  {
    id: "budget-3",
    title: "Travel Budget",
    currency: "USD",
    variants: ["travel", "travel budget", "vacation budget"],
  },
  {
    id: "budget-4",
    title: "Family Budget",
    currency: "USD",
    variants: ["family", "family budget", "household budget"],
  },
  {
    id: "budget-5",
    title: "Wedding Budget",
    currency: "USD",
    variants: ["wedding", "wedding budget", "wedding plan"],
  },
  {
    id: "budget-6",
    title: "Groceries Budget",
    currency: "USD",
    variants: ["groceries", "grocery budget", "groceries plan"],
  },
  {
    id: "budget-7",
    title: "Utilities Budget",
    currency: "USD",
    variants: ["utilities", "utilities budget", "bills budget"],
  },
  {
    id: "budget-8",
    title: "Savings Budget",
    currency: "USD",
    variants: ["savings", "savings budget", "future savings budget"],
  },
  {
    id: "budget-9",
    title: "Adventure Budget",
    currency: "USD",
    variants: ["adventure", "adventure budget", "outdoor budget"],
  },
  {
    id: "budget-10",
    title: "Home Renovation Budget",
    currency: "USD",
    variants: ["home renovation", "reno budget", "renovation budget"],
  },
];

const BASE_BUDGET_DOCUMENTS = TEST_BUDGETS.map((budget) => ({
  id: budget.id,
  title: budget.title,
  currency: budget.currency ?? "USD",
}));

const ensureBudgetPhrase = (budget: BudgetVariant, variantIndex: number) => {
  const variants = budget.variants;
  return variants[variantIndex % variants.length];
};

const buildSnapshot = (
  activeBudgetId: string,
  currency?: string | null
): MindExperienceSnapshot => ({
  expenses: {
    groups: [],
  },
  budget: {
    activeBudgetId,
    month: null,
    netPlannedMinor: undefined,
    netSpentMinor: undefined,
    currency: currency ?? "USD",
    documents: BASE_BUDGET_DOCUMENTS,
  },
  flow: {
    today: null,
    tomorrow: null,
    upcomingTasks: [],
  },
  shares: {
    recent: [],
  },
});

const patterns: Array<(context: PatternContext) => TestCase> = [
  ({ budget, budgetIndex }) => {
    const amount = 30 + budgetIndex;
    const merchant = budgetIndex % 2 === 0 ? "Safeway" : "Trader Joes";
    return {
      utterance: `Add $${amount.toFixed(
        2
      )} to groceries at ${merchant}`,
      snapshot: buildSnapshot(budget.id, budget.currency),
      expected: {
        amountMinor: Math.round(amount * 100),
        amountDisplay: `$${amount.toFixed(2)}`,
        budgetId: budget.id,
        budgetTitle: budget.title,
        category: "Groceries",
        merchant,
        description: `Groceries at ${merchant}`,
        minConfidence: 0.7,
      },
    };
  },
  ({ budget, budgetIndex }) => {
    const amount = 48.75 + budgetIndex;
    const merchant = budgetIndex % 2 === 0 ? "Whole Foods" : "Costco";
    const variant = ensureBudgetPhrase(budget, budgetIndex);
    return {
      utterance: `Log $${amount.toFixed(
        2
      )} spent on dining in the ${variant} budget at ${merchant}`,
      snapshot: buildSnapshot(budget.id, budget.currency),
      expected: {
        amountMinor: Math.round(amount * 100),
        amountDisplay: `$${amount.toFixed(2)}`,
        budgetId: budget.id,
        budgetTitle: budget.title,
        merchant,
        description: `Dining at ${merchant}`,
        minConfidence: 0.72,
      },
    };
  },
  ({ budget, budgetIndex }) => {
    const amount = 62.5 + budgetIndex;
    const merchant = budgetIndex % 2 === 0 ? "Shell" : "Chevron";
    const variant = ensureBudgetPhrase(budget, budgetIndex + 1);
    return {
      utterance: `Track $${amount.toFixed(
        2
      )} fuel for the ${variant} budget at ${merchant}`,
      snapshot: buildSnapshot(budget.id, budget.currency),
      expected: {
        amountMinor: Math.round(amount * 100),
        amountDisplay: `$${amount.toFixed(2)}`,
        budgetId: budget.id,
        budgetTitle: budget.title,
        merchant,
        description: `Gas at ${merchant}`,
        minConfidence: 0.74,
      },
    };
  },
  ({ budget, budgetIndex }) => {
    const amount = 85 + budgetIndex;
    const variant = ensureBudgetPhrase(budget, budgetIndex + 2);
    return {
      utterance: `Record ${amount} dollars towards utilities in ${variant} budget`,
      snapshot: buildSnapshot(budget.id, budget.currency),
      expected: {
        amountMinor: Math.round(amount * 100),
        amountDisplay: `$${amount.toFixed(2)}`,
        budgetId: budget.id,
        budgetTitle: budget.title,
        merchant: null,
        description: "Utilities",
        minConfidence: 0.7,
      },
    };
  },
  ({ budget, budgetIndex }) => {
    const amount = 55.25 + budgetIndex;
    return {
      utterance: `Add ${amount.toFixed(
        2
      )} usd to home supplies`,
      snapshot: buildSnapshot(budget.id, budget.currency),
      expected: {
        amountMinor: Math.round(amount * 100),
        amountDisplay: `$${amount.toFixed(2)}`,
        budgetId: budget.id,
        budgetTitle: budget.title,
        merchant: null,
        description: "Supplies",
        minConfidence: 0.65,
      },
    };
  },
  ({ budget, budgetIndex }) => {
    const amount = 104.5 + budgetIndex;
    const merchant = budgetIndex % 2 === 0 ? "Ikea" : "Lowes";
    const variant = ensureBudgetPhrase(budget, budgetIndex + 3);
    return {
      utterance: `Please add expense: $${amount.toFixed(
        2
      )} for hardware at ${merchant} to ${variant} budget`,
      snapshot: buildSnapshot(budget.id, budget.currency),
      expected: {
        amountMinor: Math.round(amount * 100),
        amountDisplay: `$${amount.toFixed(2)}`,
        budgetId: budget.id,
        budgetTitle: budget.title,
        merchant,
        description: `Hardware at ${merchant}`,
        minConfidence: 0.75,
      },
    };
  },
  ({ budget, budgetIndex }) => {
    const amount = 70 + budgetIndex;
    const variant = ensureBudgetPhrase(budget, budgetIndex + 4);
    return {
      utterance: `Add ${amount} cad to travel in the ${variant} budget`,
      snapshot: buildSnapshot(budget.id, "CAD"),
      expected: {
        amountMinor: Math.round(amount * 100),
        amountDisplay: `$${amount.toFixed(2)}`,
        budgetId: budget.id,
        budgetTitle: budget.title,
        merchant: null,
        description: "Travel",
        minConfidence: 0.68,
      },
    };
  },
  ({ budget, budgetIndex }) => {
    const amount = 95 + budgetIndex;
    const merchant = budgetIndex % 2 === 0 ? "Best Buy" : "Apple Store";
    return {
      utterance: `Track $${amount} tech gear at ${merchant}`,
      snapshot: buildSnapshot(budget.id, budget.currency),
      expected: {
        amountMinor: Math.round(amount * 100),
        amountDisplay: `$${amount.toFixed(2)}`,
        budgetId: budget.id,
        budgetTitle: budget.title,
        merchant,
        description: `Tech at ${merchant}`,
        minConfidence: 0.66,
      },
    };
  },
  ({ budget, budgetIndex }) => {
    const amount = 120 + budgetIndex;
    const variant = ensureBudgetPhrase(budget, budgetIndex + 5);
    return {
      utterance: `Allocate ${amount} bucks to savings in ${variant} budget`,
      snapshot: buildSnapshot(budget.id, budget.currency),
      expected: {
        amountMinor: Math.round(amount * 100),
        amountDisplay: `$${amount.toFixed(2)}`,
        budgetId: budget.id,
        budgetTitle: budget.title,
        merchant: null,
        description: "Savings",
        minConfidence: 0.69,
      },
    };
  },
  ({ budget, budgetIndex }) => {
    const amount = 37.5 + budgetIndex;
    const merchant = budgetIndex % 2 === 0 ? "Target" : "Amazon";
    const variant = ensureBudgetPhrase(budget, budgetIndex + 6);
    return {
      utterance: `Record $${amount.toFixed(
        2
      )} on gifts at ${merchant} in ${variant} budget`,
      snapshot: buildSnapshot(budget.id, budget.currency),
      expected: {
        amountMinor: Math.round(amount * 100),
        amountDisplay: `$${amount.toFixed(2)}`,
        budgetId: budget.id,
        budgetTitle: budget.title,
        merchant,
        description: `Gifts at ${merchant}`,
        minConfidence: 0.71,
      },
    };
  },
];

const buildTestCases = () => {
  const cases: TestCase[] = [];
  TEST_BUDGETS.forEach((budget, budgetIndex) => {
    patterns.forEach((pattern, patternIndex) => {
      const testCase = pattern({ budget, budgetIndex, patternIndex });
      if (!testCase.expected.minConfidence) {
        testCase.expected.minConfidence = 0.65;
      }
      cases.push(testCase);
    });
  });
  return cases;
};

describe("planDeterministicAddBudget", () => {
  const cases = buildTestCases();

  it("builds around 100 deterministic scenarios", () => {
    expect(cases.length).toBe(100);
  });

  cases.forEach((testCase, index) => {
    it(`plans budget entry for case #${index + 1}`, () => {
      const result = planDeterministicAddBudget(
        testCase.utterance,
        testCase.snapshot
      );
      expect(result).toBeTruthy();
      expect(result?.intent.tool).toBe("add_budget_entry");

      expect(result?.intent.input.amountMinor).toBe(
        testCase.expected.amountMinor
      );

      if (testCase.expected.budgetId) {
        expect(result?.intent.input.budgetId).toBe(
          testCase.expected.budgetId
        );
      }

      expect(result?.intent.input.category).toBeUndefined();

      if (testCase.expected.merchant !== undefined) {
        expect(result?.intent.input.merchant ?? null).toBe(
          testCase.expected.merchant
        );
      }

      expect(result?.intent.input.note).toBe(testCase.expected.description);

      expect(result?.confidence ?? 0).toBeGreaterThanOrEqual(
        testCase.expected.minConfidence ?? 0.65
      );

      expect(result?.editableMessage).toBeTruthy();
      const editable = result?.editableMessage!;
      expect(editable.template).toContain("{{amount}}");
      expect(editable.template).toContain("{{budget}}");
      expect(editable.template).toContain("{{description}}");

      const amountField = editable.fields.find(
        (field) => field.key === "amount"
      );
      expect(amountField?.value).toBe(testCase.expected.amountDisplay);
      expect(amountField?.fieldType).toBe("amount");

      const budgetField = editable.fields.find(
        (field) => field.key === "budget"
      );
      expect(budgetField?.value).toBe(testCase.expected.budgetTitle);
      expect(budgetField?.fieldType).toBe("budget");

      const descriptionField = editable.fields.find(
        (field) => field.key === "description"
      );
      expect(descriptionField?.value).toBe(testCase.expected.description);
      expect(descriptionField?.fieldType).toBe("description");

      expect(result?.message).toContain(testCase.expected.amountDisplay);
      expect(result?.message).toContain(testCase.expected.budgetTitle);
      expect(result?.message).toContain(testCase.expected.description);
    });
  });

  describe("negative cases", () => {
    const negatives = [
      {
        utterance: "Schedule yoga for 45 minutes",
        snapshot: buildSnapshot(TEST_BUDGETS[0].id),
      },
      {
        utterance: "Add groceries to the ski trip group",
        snapshot: buildSnapshot(TEST_BUDGETS[0].id),
      },
      {
        utterance: "Twenty dollars to savings",
        snapshot: buildSnapshot(TEST_BUDGETS[0].id),
      },
    ];

    negatives.forEach((testCase, index) => {
      it(`returns null when heuristics do not match (#${index + 1})`, () => {
        const result = planDeterministicAddBudget(
          testCase.utterance,
          testCase.snapshot
        );
        expect(result).toBeNull();
      });
    });
  });
});
