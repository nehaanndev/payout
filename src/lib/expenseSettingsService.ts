import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

import { db } from "./firebase";
import {
  ExpensePaymentPreferences,
  createDefaultExpensePaymentPreferences,
} from "@/types/paymentPreferences";

const expensePreferencesDoc = (userId: string) =>
  doc(db, "users", userId, "preferences", "expense");

export const fetchExpensePaymentPreferences = async (
  userId: string
): Promise<ExpensePaymentPreferences> => {
  if (!userId) {
    throw new Error("User ID is required to load payment preferences");
  }
  const ref = expensePreferencesDoc(userId);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    const data = snapshot.data() as Partial<ExpensePaymentPreferences>;
    return {
      ...createDefaultExpensePaymentPreferences(),
      ...data,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  }
  const defaults = createDefaultExpensePaymentPreferences();
  await setDoc(ref, defaults, { merge: true });
  return defaults;
};

export const saveExpensePaymentPreferences = async (
  userId: string,
  preferences: ExpensePaymentPreferences
) => {
  if (!userId) {
    throw new Error("User ID is required to save payment preferences");
  }
  const ref = expensePreferencesDoc(userId);
  const payload: ExpensePaymentPreferences = {
    ...preferences,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(ref, payload, { merge: true });
};

export const updateExpensePaymentPreferences = async (
  userId: string,
  patch: Partial<ExpensePaymentPreferences>
) => {
  if (!userId) {
    throw new Error("User ID is required to update payment preferences");
  }
  const ref = expensePreferencesDoc(userId);
  await updateDoc(ref, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
};
