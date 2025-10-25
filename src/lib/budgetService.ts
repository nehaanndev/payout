import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  BudgetCategoryRule,
  BudgetCustomCategory,
  BudgetDocument,
  BudgetFixedExpense,
  BudgetIncome,
  BudgetMember,
  BudgetMonth,
} from "@/types/budget";

export const GENERIC_BUDGET_TITLE = "Household Budget";

export const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

export const getMonthKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${month.toString().padStart(2, "0")}`;
};

const getPreviousMonthKey = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const prev = new Date(year, month - 2, 1);
  return getMonthKey(prev);
};

export const createBudgetDocument = async (member?: BudgetMember) => {
  const budgetRef = doc(collection(db, "budgets"));
  const nowIso = new Date().toISOString();

  const base: Omit<BudgetDocument, "id"> = {
    title: GENERIC_BUDGET_TITLE,
    ownerIds: member?.id ? [member.id] : [],
    memberIds: member?.id ? [member.id] : [],
    members: member ? [member] : [],
    shareCode: budgetRef.id,
    createdAt: nowIso,
    updatedAt: nowIso,
    customCategories: [],
    categoryRules: [],
  };

  await setDoc(budgetRef, {
    ...base,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });

  return budgetRef.id;
};

export const fetchBudgetDocument = async (
  budgetId: string
): Promise<BudgetDocument | null> => {
  const ref = doc(db, "budgets", budgetId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...(snapshot.data() as Omit<BudgetDocument, "id">) };
};

export const ensureMemberOnBudget = async (
  budgetId: string,
  member: BudgetMember
) => {
  const ref = doc(db, "budgets", budgetId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return;
  }
  const data = snapshot.data() as Omit<BudgetDocument, "id">;
  if (data.memberIds?.includes(member.id)) {
    return;
  }
  await updateDoc(ref, {
    memberIds: arrayUnion(member.id),
    members: arrayUnion(member),
    serverUpdatedAt: serverTimestamp(),
    updatedAt: new Date().toISOString(),
  });
};

const defaultIncomes = (): BudgetIncome[] => [
  { id: generateId(), source: "Salary", amount: 0 },
];

const defaultFixeds = (): BudgetFixedExpense[] => [
  { id: generateId(), name: "Rent/Mortgage", amount: 0, enabled: true },
  { id: generateId(), name: "Utilities", amount: 0, enabled: true },
];

export const buildEmptyMonth = (monthKey: string): BudgetMonth => {
  const nowIso = new Date().toISOString();
  return {
    id: monthKey,
    month: monthKey,
    incomes: defaultIncomes(),
    fixeds: defaultFixeds(),
    entries: [],
    createdAt: nowIso,
    updatedAt: nowIso,
    initializedFrom: null,
  };
};

const copyMonthData = (prev: BudgetMonth, monthKey: string): BudgetMonth => {
  const nowIso = new Date().toISOString();
  return {
    id: monthKey,
    month: monthKey,
    incomes: prev.incomes.map((item) => ({ ...item, id: generateId() })),
    fixeds: prev.fixeds.map((item) => ({ ...item, id: generateId() })),
    entries: [],
    createdAt: nowIso,
    updatedAt: nowIso,
    initializedFrom: prev.id,
  };
};

export const fetchBudgetMonth = async (
  budgetId: string,
  monthKey: string
): Promise<BudgetMonth> => {
  const monthRef = doc(db, "budgets", budgetId, "months", monthKey);
  const snap = await getDoc(monthRef);
  if (snap.exists()) {
    return { id: snap.id, ...(snap.data() as Omit<BudgetMonth, "id">) };
  }

  // Try to reuse the most recent month for defaults.
  const previousKey = getPreviousMonthKey(monthKey);
  const previousRef = doc(db, "budgets", budgetId, "months", previousKey);
  const prevSnap = await getDoc(previousRef);

  let month = buildEmptyMonth(monthKey);
  if (prevSnap.exists()) {
    month = copyMonthData(
      { id: prevSnap.id, ...(prevSnap.data() as Omit<BudgetMonth, "id">) },
      monthKey
    );
  }

  await setDoc(monthRef, {
    ...month,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });

  return month;
};

export const saveBudgetMonth = async (
  budgetId: string,
  month: BudgetMonth
) => {
  const ref = doc(db, "budgets", budgetId, "months", month.id);
  const payload = {
    ...month,
    updatedAt: month.updatedAt ?? new Date().toISOString(),
    serverUpdatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
};

export const saveBudgetMetadata = async (
  budgetId: string,
  metadata: {
    customCategories: BudgetCustomCategory[];
    categoryRules: BudgetCategoryRule[];
    updatedAt: string;
  }
) => {
  const ref = doc(db, "budgets", budgetId);
  await updateDoc(ref, {
    customCategories: metadata.customCategories,
    categoryRules: metadata.categoryRules,
    updatedAt: metadata.updatedAt,
    serverUpdatedAt: serverTimestamp(),
  });
};

export const listBudgetMonthKeys = async (budgetId: string) => {
  const monthsRef = collection(db, "budgets", budgetId, "months");
  const snapshot = await getDocs(monthsRef);
  return snapshot.docs.map((docSnap) => docSnap.id);
};

export const listBudgetsForMember = async (memberId: string) => {
  const budgetsRef = collection(db, "budgets");
  const q = query(budgetsRef, where("memberIds", "array-contains", memberId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (docSnap) =>
      ({ id: docSnap.id, ...(docSnap.data() as Omit<BudgetDocument, "id">) }) as BudgetDocument
  );
};
