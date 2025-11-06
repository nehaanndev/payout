import { addExpense } from "@/lib/firebaseUtils";
import {
  fetchBudgetMonth,
  getMonthKey,
  saveBudgetMonth,
} from "@/lib/budgetService";
import { CurrencyCode, FRACTION_DIGITS, splitByWeights } from "@/lib/currency_core";
import { generateId } from "@/lib/id";
import { ensureFlowPlan, saveFlowPlan } from "@/lib/flowService";
import { BudgetLedgerEntry } from "@/types/budget";
import { FlowTask } from "@/types/flow";
import { Member } from "@/types/group";
import { buildMindSnapshot } from "./snapshot";
import { createMindPlanner } from "./planner";
import {
  MindIntent,
  MindRequest,
  MindResponse,
  MindToolExecution,
  MindExperienceSnapshot,
} from "./types";

type OrchestratorOptions = {
  autoExecute?: boolean;
  includeSnapshotInCompletedResponse?: boolean;
};

const planner = createMindPlanner();

export class ToodlMindOrchestrator {
  constructor(private readonly options: OrchestratorOptions = {}) {}

  async handle(request: MindRequest): Promise<MindResponse> {
    if (!request?.user || (!request.user.userId && !request.user.email)) {
      return {
        status: "failed",
        error: "Toodl Mind needs a user identity to load context.",
      };
    }

    const snapshot = await buildMindSnapshot(request);
    const hints = (request.contextHints ?? {}) as OrchestratorHints;

    const overrideIntent = hints.intentOverride
      ? applyEditableOverrides(
          hints.intentOverride as MindIntent,
          hints.editableOverrides,
          snapshot
        )
      : null;

    const plan = overrideIntent
      ? {
          intent: overrideIntent,
          message:
            typeof hints.intentMessage === "string"
              ? hints.intentMessage
              : "Ready to execute your plan.",
          confidence: 0.9,
        }
      : await planner.plan({ request, snapshot });

    const shouldExecute =
      this.options.autoExecute ?? shouldAutoExecute(request);

    if (!shouldExecute) {
      return {
        status: "needs_confirmation",
        intent: plan.intent,
        message: plan.message,
        editableMessage: plan.editableMessage,
      };
    }

    const actions = await this.executeIntent(plan.intent, request, snapshot);
    const actionSummary =
      actions.find((action) => action.success)?.resultSummary ??
      actions[0]?.resultSummary ??
      plan.message;

    return {
      status: "executed",
      message: actionSummary ?? plan.message,
      actions,
      editableMessage: plan.editableMessage,
      snapshot: this.options.includeSnapshotInCompletedResponse
        ? snapshot
        : undefined,
    };
  }

  private async executeIntent(
    intent: MindIntent,
    request: MindRequest,
    snapshot: MindExperienceSnapshot
  ): Promise<MindToolExecution[]> {
    switch (intent.tool) {
      case "add_expense":
        return [await executeAddExpense(intent, request, snapshot)];
      case "add_budget_entry":
        return [await executeAddBudgetEntry(intent, request, snapshot)];
      case "add_flow_task":
        return [await executeAddFlowTask(intent, request, snapshot)];
      case "summarize_state":
        return [
          {
            name: intent.tool,
            input: intent.input,
            success: true,
            resultSummary:
              "Generated summary from cached snapshot. No API call executed.",
          },
        ];
      default:
        return [
          {
            name: intent.tool,
            input: intent.input,
            success: false,
            resultSummary: `No executor registered for ${intent.tool}`,
          },
        ];
    }
  }
}

type OrchestratorHints = {
  autoExecute?: boolean;
  confirm?: boolean;
  execute?: boolean;
  mode?: string;
  intentOverride?: MindIntent;
  editableOverrides?: Record<string, string>;
  intentMessage?: string;
};

const shouldAutoExecute = (request: MindRequest): boolean => {
  const hints = (request.contextHints ?? {}) as OrchestratorHints;
  if (!hints || typeof hints !== "object") {
    return false;
  }
  if (hints.autoExecute === true) {
    return true;
  }
  if (hints.confirm === true || hints.execute === true) {
    return true;
  }
  if (typeof hints.mode === "string") {
    return hints.mode === "execute" || hints.mode === "auto";
  }
  return false;
};

type ExpenseIntent = Extract<MindIntent, { tool: "add_expense" }>;
type BudgetIntent = Extract<MindIntent, { tool: "add_budget_entry" }>;
type FlowIntent = Extract<MindIntent, { tool: "add_flow_task" }>;

const executeAddExpense = async (
  intent: ExpenseIntent,
  request: MindRequest,
  snapshot: MindExperienceSnapshot
): Promise<MindToolExecution> => {
  const action: MindToolExecution = {
    name: intent.tool,
    input: intent.input,
    success: false,
  };

  const groups = snapshot.expenses.groups ?? [];
  if (!groups.length) {
    action.error = "No expense groups available for this user.";
    action.resultSummary = "No expense recorded.";
    return action;
  }

  const amountMinor = intent.input.amountMinor ?? 0;
  if (amountMinor <= 0) {
    action.error = "Amount must be provided for expense entry.";
    action.resultSummary = "Missing amount prevented expense creation.";
    return action;
  }

  const targetGroup = findBestGroup(groups, intent.input.groupName);
  if (!targetGroup) {
    const available =
      groups.length > 0
        ? `Available groups: ${groups
            .map((group) => group.name)
            .filter(Boolean)
            .join(", ")}.`
        : "No groups were found for this account.";
    action.error = "Unable to match a group for this expense.";
    action.resultSummary = `No matching group found, expense skipped. ${available}`;
    return action;
  }

  const currencyCode = normalizeCurrency(
    intent.input.currency ?? targetGroup.currency
  );
  const digits = fractionDigitsForCurrency(currencyCode);
  const amountMajor = toMajorUnits(amountMinor, digits);

  const participants = resolveParticipants(
    targetGroup.members,
    intent.input.participants
  );
  if (!participants.length) {
    action.error = "Could not infer participants for the expense.";
    action.resultSummary = "Expense not recorded.";
    return action;
  }

  const weights = participants.reduce<Record<string, number>>(
    (acc, member) => {
      acc[member.id] = 1;
      return acc;
    },
    {}
  );

  const splitsMinor = splitByWeights(amountMinor, weights);
  const splitsPercent = splitByWeights(100, weights);

  const paidByMember =
    findMemberMatch(participants, intent.input.paidByHint) ??
    findMemberMatch(participants, request.user.userId) ??
    findMemberMatch(participants, request.user.email ?? "") ??
    participants[0];

  const paidBy =
    paidByMember?.firstName ??
    paidByMember?.email ??
    paidByMember?.id ??
    "Unknown";

  const occurredAt =
    typeof intent.input.occurredAt === "string"
      ? parseDateTime(intent.input.occurredAt)
      : new Date();

  try {
    await addExpense(
      targetGroup.id,
      intent.input.description?.trim() || request.utterance,
      amountMajor,
      paidBy,
      splitsPercent,
      occurredAt,
      amountMinor,
      splitsMinor
    );
    action.success = true;
    const formatted = formatAmountForSummary(amountMajor, currencyCode, digits);
    action.resultSummary = `Added expense to ${targetGroup.name} (${formatted}).`;
    return action;
  } catch (error) {
    action.success = false;
    action.error =
      error instanceof Error
        ? error.message
        : "Unexpected error creating expense.";
    action.resultSummary = "Expense creation failed.";
    return action;
  }
};

const executeAddBudgetEntry = async (
  intent: BudgetIntent,
  request: MindRequest,
  snapshot: MindExperienceSnapshot
): Promise<MindToolExecution> => {
  const action: MindToolExecution = {
    name: intent.tool,
    input: intent.input,
    success: false,
  };

  const budgetId =
    intent.input.budgetId ?? snapshot.budget.activeBudgetId ?? null;
  if (!budgetId) {
    action.error = "No budget associated with this user.";
    action.resultSummary = "Budget entry not recorded.";
    return action;
  }

  const amountMinor = intent.input.amountMinor ?? 0;
  if (amountMinor <= 0) {
    action.error = "Budget entries require a positive amount.";
    action.resultSummary = "Budget entry skipped.";
    return action;
  }

  const resolvedDate = resolveDate(intent.input.occurredOn);
  const monthKey =
    snapshot.budget.monthKey ??
    (resolvedDate ? getMonthKey(new Date(resolvedDate)) : getMonthKey());

  const currencyCode = normalizeCurrency(snapshot.budget.currency ?? "USD");
  const digits = fractionDigitsForCurrency(currencyCode);
  const amountMajor = toMajorUnits(amountMinor, digits);

  try {
    const month = await fetchBudgetMonth(budgetId, monthKey);
    const nowIso = new Date().toISOString();
    const entry: BudgetLedgerEntry = {
      id: generateId(),
      amount: amountMajor,
      category: intent.input.category ?? "general",
      merchant: intent.input.merchant ?? null,
      date: resolvedDate ?? nowIso.slice(0, 10),
      tags: [],
    };

    month.entries = [entry, ...(month.entries ?? [])];
    month.updatedAt = nowIso;

    await saveBudgetMonth(budgetId, month);

    action.success = true;
    const formatted = formatAmountForSummary(amountMajor, currencyCode, digits);
    action.resultSummary = `Logged ${formatted} to ${entry.category} in the budget.`;
    return action;
  } catch (error) {
    action.success = false;
    action.error =
      error instanceof Error
        ? error.message
        : "Unexpected error saving budget entry.";
    action.resultSummary = "Budget entry failed.";
    return action;
  }
};

const executeAddFlowTask = async (
  intent: FlowIntent,
  request: MindRequest,
  snapshot: MindExperienceSnapshot
): Promise<MindToolExecution> => {
  const action: MindToolExecution = {
    name: intent.tool,
    input: intent.input,
    success: false,
  };

  const userId = request.user.userId;
  if (!userId) {
    action.error = "User ID required for Flow updates.";
    action.resultSummary = "Flow task not created.";
    return action;
  }

  const timezone =
    request.user.timezone ??
    snapshot.flow.today?.timezone ??
    snapshot.flow.tomorrow?.timezone ??
    "UTC";

  const dateKey = resolveFlowDateKey(intent.input.scheduledFor);

  const durationMinutes = intent.input.durationMinutes ?? 30;
  const startTime = intent.input.startsAt
    ? parseTimeTo24Hour(intent.input.startsAt)
    : null;
  const endTime =
    startTime !== null
      ? minutesToTimeString(startTime + durationMinutes)
      : null;

  const category = resolveFlowCategory(intent.input.category, request.utterance);
  const title = intent.input.title?.trim() || request.utterance;

  try {
    const plan = await ensureFlowPlan(userId, dateKey, timezone);
    const nowIso = new Date().toISOString();
    const nextSequence =
      plan.tasks.reduce((max, task) => Math.max(max, task.sequence ?? 0), 0) +
      1;

    const task: FlowTask = {
      id: generateId(),
      title,
      type: "flex",
      category,
      estimateMinutes: durationMinutes,
      sequence: nextSequence,
      scheduledStart: startTime !== null ? minutesToTimeString(startTime) : null,
      scheduledEnd: endTime,
      status: "pending",
      notes: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const tasks = [...plan.tasks, task];
    await saveFlowPlan(userId, { ...plan, tasks });

    action.success = true;
    action.resultSummary = `Added Flow task "${title}" on ${dateKey}.`;
    return action;
  } catch (error) {
    action.success = false;
    action.error =
      error instanceof Error
        ? error.message
        : "Unexpected error creating Flow task.";
    action.resultSummary = "Flow task creation failed.";
    return action;
  }
};

const findBestGroup = (
  groups: MindExperienceSnapshot["expenses"]["groups"],
  name?: string
) => {
  if (!name) {
    return groups[0];
  }
  const normalized = name.trim().toLowerCase();
  return (
    groups.find(
      (group) =>
        group.name?.toLowerCase() === normalized ||
        group.id.toLowerCase() === normalized
    ) ??
    groups.find((group) => group.name?.toLowerCase().includes(normalized)) ??
    undefined
  );
};

const resolveParticipants = (
  members: Member[],
  requested?: string[]
): Member[] => {
  if (!members?.length) {
    return [];
  }
  if (!requested || !requested.length) {
    return members;
  }
  const resolved = requested
    .map((candidate) => findMemberMatch(members, candidate))
    .filter((member): member is Member => Boolean(member));
  return resolved.length ? resolved : members;
};

const findMemberMatch = (
  members: Member[],
  candidate?: string | null
): Member | undefined => {
  if (!candidate) {
    return undefined;
  }
  const normalized = candidate.trim().toLowerCase();
  return members.find((member) => {
    if (member.id === candidate) {
      return true;
    }
    if (member.email && member.email.toLowerCase() === normalized) {
      return true;
    }
    if (member.firstName && member.firstName.toLowerCase() === normalized) {
      return true;
    }
    return false;
  });
};

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word.length > 1
        ? word[0].toUpperCase() + word.slice(1).toLowerCase()
        : word.toUpperCase()
    )
    .join(" ");

const parseMajorFromString = (value?: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const match = value.replace(/[^\d.,-]/g, "").match(/-?\d+(?:[.,]\d{1,2})?/);
  if (!match) {
    return undefined;
  }
  const normalized = match[0].replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeBudgetName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\bbudget\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const BUDGET_SYNONYM_MAP: Record<string, string> = {
  vacation: "travel",
  holidays: "travel",
  holiday: "travel",
  household: "family",
  bills: "utilities",
  outdoor: "adventure",
  adventures: "adventure",
  future: "savings",
  "future savings": "savings",
  reno: "home renovation",
  renovation: "home renovation",
};

const matchScore = (a: string, b: string) => {
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return a.length;
  }
  if (a.includes(b)) {
    return b.length;
  }
  if (b.includes(a)) {
    return a.length;
  }
  return 0;
};

const matchBudgetDocument = (
  name: string,
  snapshot: MindExperienceSnapshot,
  synonymTarget?: string | null
) => {
  const documents = snapshot.budget.documents ?? [];
  if (!documents.length) {
    return null;
  }
  const normalized = normalizeBudgetName(name);
  const singular = normalized.endsWith("s")
    ? normalized.slice(0, -1)
    : normalized;
  const candidates = documents.map((doc) => ({
    ...doc,
    normalized: normalizeBudgetName(doc.title ?? ""),
  }));

  const direct =
    candidates.find(
      (doc) =>
        doc.normalized === normalized ||
        doc.normalized === singular ||
        normalized.includes(doc.normalized) ||
        doc.normalized.includes(normalized)
    ) ?? null;
  if (direct) {
    return direct;
  }

  if (synonymTarget) {
    const normalizedSynonym = normalizeBudgetName(synonymTarget);
    const synonym = candidates.find(
      (doc) =>
        doc.normalized === normalizedSynonym ||
        doc.normalized.includes(normalizedSynonym) ||
        normalizedSynonym.includes(doc.normalized)
    );
    if (synonym) {
      return synonym;
    }
  }

  const scored = candidates
    .map((doc) => ({
      doc,
      score: matchScore(doc.normalized, normalized),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  return scored?.doc ?? null;
};

const splitDescription = (description: string) => {
  const parts = description.split(/\sat\s/i);
  if (parts.length >= 2) {
    const category = parts[0]?.trim();
    const merchant = parts.slice(1).join(" at ").trim();
    return {
      category: category ? titleCase(category) : undefined,
      merchant: merchant || null,
    };
  }
  const trimmed = description.trim();
  return {
    category: trimmed ? titleCase(trimmed) : undefined,
    merchant: null,
  };
};

const applyEditableOverrides = (
  intent: MindIntent,
  overrides: Record<string, string> | undefined,
  snapshot: MindExperienceSnapshot
): MindIntent => {
  if (!overrides) {
    return intent;
  }
  const clonedIntent = JSON.parse(JSON.stringify(intent)) as MindIntent;

  if (clonedIntent.tool === "add_budget_entry") {
    const input = { ...clonedIntent.input };
    const digits = fractionDigitsForCurrency(snapshot.budget.currency ?? "USD");

    if (typeof overrides.amount === "string") {
      const major = parseMajorFromString(overrides.amount);
      if (typeof major === "number" && Number.isFinite(major)) {
        input.amountMinor = Math.round(major * 10 ** digits);
      }
    }

    if (typeof overrides.budget === "string") {
      const synonym =
        BUDGET_SYNONYM_MAP[normalizeBudgetName(overrides.budget)] ??
        overrides.budget;
      const matched = matchBudgetDocument(
        overrides.budget,
        snapshot,
        synonym
      );
      if (matched?.id) {
        input.budgetId = matched.id;
      }
    }

    if (typeof overrides.description === "string") {
      const trimmed = overrides.description.trim();
      delete input.category;
      if (trimmed) {
        input.note = trimmed;
        const breakdown = splitDescription(trimmed);
        if (breakdown.merchant !== null) {
          input.merchant = breakdown.merchant;
        }
      }
    }

    clonedIntent.input = input;
  }

  return clonedIntent;
};

const normalizeCurrency = (code?: string | null): string => {
  if (!code) {
    return "USD";
  }
  return code.toString().trim().toUpperCase();
};

const fractionDigitsForCurrency = (currency: string): number => {
  const upper = normalizeCurrency(currency);
  if (upper in FRACTION_DIGITS) {
    return FRACTION_DIGITS[upper as CurrencyCode];
  }
  return 2;
};

const toMajorUnits = (amountMinor: number, digits: number): number => {
  return amountMinor / 10 ** digits;
};

const parseDateTime = (value: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

const resolveDate = (value?: string | null): string => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
};

const resolveFlowDateKey = (value?: string): string => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "today") {
    return new Date().toISOString().slice(0, 10);
  }
  if (normalized === "tomorrow") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
};

const FLOW_CATEGORIES = ["work", "family", "home", "wellness", "play", "growth"] as const;

const resolveFlowCategory = (
  requested: string | undefined,
  fallbackUtterance: string
): FlowTask["category"] => {
  if (requested) {
    const normalized = requested.trim().toLowerCase();
    if ((FLOW_CATEGORIES as ReadonlyArray<string>).includes(normalized)) {
      return normalized as FlowTask["category"];
    }
  }
  const utterance = fallbackUtterance.toLowerCase();
  if (utterance.includes("yoga") || utterance.includes("gym") || utterance.includes("run")) {
    return "wellness";
  }
  if (utterance.includes("meeting") || utterance.includes("work")) {
    return "work";
  }
  return "growth";
};

const parseTimeTo24Hour = (value: string): number | null => {
  const match = value
    .trim()
    .toLowerCase()
    .match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) {
    return null;
  }
  let hours = Number.parseInt(match[1], 10);
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridiem = match[3];

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  if (meridiem === "pm" && hours < 12) {
    hours += 12;
  } else if (meridiem === "am" && hours === 12) {
    hours = 0;
  }

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

const minutesToTimeString = (minutes: number): string | null => {
  if (!Number.isFinite(minutes)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(minutes, 24 * 60));
  const hrs = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor(clamped % 60)
    .toString()
    .padStart(2, "0");
  return `${hrs}:${mins}`;
};

const formatAmountForSummary = (
  amountMajor: number,
  currency: string,
  digits: number
) => {
  return `${amountMajor.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${currency}`;
};
