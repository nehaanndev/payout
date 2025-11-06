export type ExpensePaymentPreferences = {
  paypalMeLink: string | null;
  suppressPaypalPrompt: boolean;
  updatedAt: string;
};

export const createDefaultExpensePaymentPreferences = (): ExpensePaymentPreferences => ({
  paypalMeLink: null,
  suppressPaypalPrompt: false,
  updatedAt: new Date().toISOString(),
});
