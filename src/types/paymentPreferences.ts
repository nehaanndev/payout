export type ExpensePaymentPreferences = {
  paypalMeLink: string | null;
  zelleId: string | null;
  venmoId: string | null;
  cashAppId: string | null;
  suppressPaypalPrompt: boolean;
  updatedAt: string;
};

export const createDefaultExpensePaymentPreferences = (): ExpensePaymentPreferences => ({
  paypalMeLink: null,
  zelleId: null,
  venmoId: null,
  cashAppId: null,
  suppressPaypalPrompt: false,
  updatedAt: new Date().toISOString(),
});
