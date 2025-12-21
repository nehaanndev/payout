import { SettlementMethod } from "./settlement";

export type ExpensePaymentPreferences = {
  paypalMeLink: string | null;
  zelleId: string | null;
  venmoId: string | null;
  cashAppId: string | null;
  preferredPaymentMethod: SettlementMethod | null;
  suppressPaypalPrompt: boolean;
  updatedAt: string;
};

export const createDefaultExpensePaymentPreferences = (): ExpensePaymentPreferences => ({
  paypalMeLink: null,
  zelleId: null,
  venmoId: null,
  cashAppId: null,
  preferredPaymentMethod: null,
  suppressPaypalPrompt: false,
  updatedAt: new Date().toISOString(),
});
