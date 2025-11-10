import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import {
  getExpenses,
  getUserGroups,
  getUserGroupsById,
} from "@/lib/firebaseUtils";
import { calculateRawBalancesMinor } from "@/lib/financeUtils";
import { db } from "@/lib/firebase";
import { DEFAULT_CURRENCY, getGroupCurrency } from "@/lib/currency";
import {
  fetchBudgetMonthSnapshot,
  getMonthKey,
} from "@/lib/budgetService";
import { listSharedLinks } from "@/lib/shareService";
import {
  FlowPlan,
  FlowTask,
} from "@/types/flow";
import { Group, Expense } from "@/types/group";
import {
  MindExperienceSnapshot,
  MindRequest,
  MindUserIdentity,
} from "./types";

type SnapshotHints = MindRequest["contextHints"];

// Returns true when the provided value is an array composed entirely of strings.
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

// Extracts group ids from the request hints, normalizing to an array.
const pickGroupIdsFromHints = (hints: SnapshotHints): string[] => {
  if (!hints) {
    return [];
  }
  if (isStringArray(hints.groupIds)) {
    return hints.groupIds;
  }
  if (typeof hints.groupId === "string") {
    return [hints.groupId];
  }
  return [];
};

// Determines which budget month (if any) was requested via hints.
const pickBudgetMonthFromHints = (hints: SnapshotHints): string | undefined => {
  if (!hints) {
    return undefined;
  }
  if (typeof hints.budgetMonth === "string") {
    return hints.budgetMonth;
  }
  if (typeof hints.month === "string") {
    return hints.month;
  }
  return undefined;
};

// Pulls a specific budget id from hints if one was provided.
const pickBudgetIdFromHints = (hints: SnapshotHints): string | undefined => {
  if (!hints) {
    return undefined;
  }
  if (typeof hints.budgetId === "string") {
    return hints.budgetId;
  }
  return undefined;
};

// Provides the number of fraction digits for special-case currencies.
const currencyFractionDigits = (currency: string | null | undefined) => {
  const normalized = currency?.toUpperCase() ?? DEFAULT_CURRENCY;
  switch (normalized) {
    case "JPY":
      return 0;
    case "KWD":
    case "BHD":
      return 3;
    default:
      return 2;
  }
};

// Converts a major currency amount into its minor unit representation.
const toMinor = (amountMajor: number, currency: string | null | undefined) => {
  const digits = currencyFractionDigits(currency);
  return Math.round(amountMajor * 10 ** digits);
};

// Builds the expense-group portion of the snapshot by loading memberships and balances.
const computeExpenseGroups = async (
  identity: MindUserIdentity,
  hints: SnapshotHints
) => {
  let groups: Group[] = [];

  try {
    if (identity.email) {
      groups = await getUserGroups(identity.email);
    }
  } catch (error) {
    console.error("[mind] failed to load groups by email", error);
  }

  if (!groups.length && identity.userId) {
    try {
      groups = await getUserGroupsById(identity.userId);
    } catch (error) {
      console.error("[mind] failed to load groups by id", error);
    }
  }

  const hintGroupIds = pickGroupIdsFromHints(hints);
  if (hintGroupIds.length) {
    groups = groups.filter((group) => hintGroupIds.includes(group.id));
  }

  const results = await Promise.all(
    groups.map(async (group) => {
      let expenses: Expense[] = [];
      try {
        expenses = await getExpenses(group.id);
      } catch (error) {
        console.error("[mind] failed to load expenses for group", group.id, error);
      }
      const currency = getGroupCurrency(group);
      const balances = calculateRawBalancesMinor(
        group.members ?? [],
        expenses,
        currency
      );
      const outstandingBalanceMinor = Object.values(balances)
        .filter((value) => value < 0)
        .reduce((acc, value) => acc - value, 0);

      const memberIdCandidates = [
        identity.userId,
        identity.email,
        identity.displayName,
      ].filter((value): value is string => Boolean(value));

      const locateMemberId = () => {
        for (const candidate of memberIdCandidates) {
          const match = group.members?.find(
            (member) =>
              member.id === candidate ||
              member.email === candidate ||
              member.firstName === candidate
          );
          if (match) {
            return match.id;
          }
        }
        return memberIdCandidates[0] ?? "";
      };

      const currentMemberId = locateMemberId();
      const youBalanceMinor = currentMemberId
        ? balances[currentMemberId] ?? 0
        : 0;

      return {
        id: group.id,
        name: group.name,
        currency,
        outstandingBalanceMinor,
        youOweMinor: youBalanceMinor < 0 ? -youBalanceMinor : 0,
        owedToYouMinor: youBalanceMinor > 0 ? youBalanceMinor : 0,
        recentExpenses: expenses.slice(0, 5),
        members: group.members ?? [],
        memberCount: group.members?.length ?? 0,
        primaryMemberId: currentMemberId ?? null,
      };
    })
  );

  return { groups: results };
};

// Lists lightweight budget documents that the user has access to.
const fetchBudgetDocumentsForUser = async (
  userId?: string
): Promise<
  Array<
    {
      id: string;
      title: string;
      currency?: string | null;
    }
  >
> => {
  if (!userId) {
    return [];
  }
  try {
    const q = query(
      collection(db, "budgets"),
      where("memberIds", "array-contains", userId),
      limit(5)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as {
        title?: string;
        currency?: string | null;
      };
      return {
        id: docSnap.id,
        title: data.title ?? "Budget",
        currency: data?.currency ?? null,
      };
    });
  } catch (error) {
    console.error("[mind] failed to list budgets", error);
    return [];
  }
};

// Constructs the budget snapshot, falling back to basic metadata when data is missing.
const computeBudgetSnapshot = async (
  identity: MindUserIdentity,
  hints: SnapshotHints
): Promise<MindExperienceSnapshot["budget"]> => {
  const budgetIdHint = pickBudgetIdFromHints(hints);
  const monthHint = pickBudgetMonthFromHints(hints);

  const budgetDocs = await fetchBudgetDocumentsForUser(identity.userId);
  const targetBudget = budgetIdHint
    ? budgetDocs.find((entry) => entry.id === budgetIdHint) ?? budgetDocs[0]
    : budgetDocs[0];

  if (!targetBudget) {
    return {
      activeBudgetId: null,
      month: null,
      netPlannedMinor: undefined,
      netSpentMinor: undefined,
      currency: null,
      monthKey: null,
      documents: budgetDocs,
    };
  }

  const monthKey = monthHint ?? getMonthKey();
  try {
    const month = await fetchBudgetMonthSnapshot(targetBudget.id, monthKey);
    if (!month) {
      return {
        activeBudgetId: targetBudget.id,
        month: null,
        netPlannedMinor: undefined,
        netSpentMinor: undefined,
        currency: targetBudget.currency ?? null,
        monthKey,
        documents: budgetDocs,
      };
    }

    const currency = targetBudget.currency ?? "USD";
    const netSpentMinor = month.entries?.reduce((acc, entry) => {
      return acc + toMinor(entry.amount, currency);
    }, 0);
    const plannedIncomeMinor = month.incomes?.reduce((acc, income) => {
      return acc + toMinor(income.amount, currency);
    }, 0);
    const fixedMinor = month.fixeds
      ?.filter((item) => item.enabled !== false)
      .reduce((acc, item) => acc + toMinor(item.amount, currency), 0);
    const netPlannedMinor =
      typeof plannedIncomeMinor === "number" && typeof fixedMinor === "number"
        ? plannedIncomeMinor - fixedMinor
        : undefined;

    return {
      activeBudgetId: targetBudget.id,
      month,
      netPlannedMinor,
      netSpentMinor,
      currency: targetBudget.currency ?? null,
      monthKey,
      documents: budgetDocs,
    };
  } catch (error) {
    console.error("[mind] failed to fetch budget month", error);
    return {
      activeBudgetId: targetBudget.id,
      month: null,
      netPlannedMinor: undefined,
      netSpentMinor: undefined,
      currency: targetBudget.currency ?? null,
      monthKey,
      documents: budgetDocs,
    };
  }
};

// Reads a single Flow plan document for a given day.
const fetchFlowPlanSnapshot = async (
  userId: string,
  dateKey: string
): Promise<FlowPlan | null> => {
  if (!userId) {
    return null;
  }
  try {
    const ref = doc(collection(db, "users", userId, "flowPlans"), dateKey);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      return null;
    }
    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<FlowPlan, "id">),
    };
  } catch (error) {
    console.error("[mind] failed to fetch flow plan", dateKey, error);
    return null;
  }
};

// Produces Flow state (today/tomorrow plus upcoming tasks) for the user.
const computeFlowSnapshot = async (
  identity: MindUserIdentity,
  hints: SnapshotHints
) => {
  const userId = identity.userId;
  if (!userId) {
    return {
      today: null,
      tomorrow: null,
      upcomingTasks: [],
    };
  }

  const now = new Date();
  const todayKey = hints?.flowDateKey?.toString?.() ?? dateKeyFromDate(now);
  const tomorrowKey = dateKeyFromDate(addDays(now, 1));

  const [today, tomorrow] = await Promise.all([
    fetchFlowPlanSnapshot(userId, todayKey),
    fetchFlowPlanSnapshot(userId, tomorrowKey),
  ]);

  const upcomingTasks: FlowTask[] = [
    ...(today?.tasks ?? []),
    ...(tomorrow?.tasks ?? []),
  ].filter((task) => task.status === "pending" || task.status === "in_progress");

  return {
    today,
    tomorrow,
    upcomingTasks,
  };
};

// Utility to clone a date and advance it by N days.
const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

// Formats a Date into YYYY-MM-DD so it matches stored Flow documents.
const dateKeyFromDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Retrieves a lightweight list of the user's recently shared links.
const computeShareSnapshot = async (identity: MindUserIdentity) => {
  if (!identity.userId) {
    return {
      recent: [],
    };
  }
  try {
    const recent = await listSharedLinks(identity.userId, { limit: 10 });
    return { recent };
  } catch (error) {
    console.error("[mind] failed to load shared links", error);
    return { recent: [] };
  }
};

// Builds the complete Mind snapshot that powers planning and tool execution.
export const buildMindSnapshot = async ({
  user,
  contextHints,
}: MindRequest): Promise<MindExperienceSnapshot> => {
  const snapshot: MindExperienceSnapshot = {
    expenses: { groups: [] },
    budget: {
      activeBudgetId: null,
      month: null,
      netPlannedMinor: undefined,
      netSpentMinor: undefined,
      documents: [],
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

  if (!user?.userId && !user?.email) {
    return snapshot;
  }

  const [expenseData, budgetData, flowData, shareData] = await Promise.all([
    computeExpenseGroups(user, contextHints),
    computeBudgetSnapshot(user, contextHints),
    computeFlowSnapshot(user, contextHints),
    computeShareSnapshot(user),
  ]);

  snapshot.expenses = expenseData;
  snapshot.budget = budgetData;
  snapshot.flow = flowData;
  snapshot.shares = shareData;

  return snapshot;
};
