export type BudgetMember = {
  id: string;
  email: string | null;
  name: string | null;
};

export type BudgetIncome = {
  id: string;
  source: string;
  amount: number;
};

export type BudgetFixedExpense = {
  id: string;
  name: string;
  amount: number;
  enabled: boolean;
};

export type BudgetLedgerEntry = {
  id: string;
  amount: number;
  category: string;
  merchant?: string | null;
  date: string;
  isOneTime?: boolean;
  tags?: string[];
};

export type BudgetGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
  monthlyContribution: number;
  createdAt: string;
  updatedAt: string;
};

export type BudgetCustomCategory = {
  id: string;
  value: string;
  label: string;
  emoji?: string | null;
  memberId: string | null;
  createdAt: string;
};

export type BudgetCategoryRule = {
  id: string;
  memberId: string | null;
  operator: "contains" | "starts_with" | "equals";
  pattern: string;
  categoryValue: string;
  createdAt: string;
};

export type BudgetCustomTag = {
  id: string;
  value: string;
  memberId: string | null;
  createdAt: string;
};

export type BudgetTagRule = {
  id: string;
  memberId: string | null;
  operator: "contains" | "starts_with" | "equals";
  pattern: string;
  tags: string[];
  createdAt: string;
};

export type BudgetDocument = {
  id: string;
  title: string;
  ownerIds: string[];
  memberIds: string[];
  members: BudgetMember[];
  shareCode: string;
  createdAt: string;
  updatedAt: string;
  customCategories?: BudgetCustomCategory[];
  categoryRules?: BudgetCategoryRule[];
  customTags?: BudgetCustomTag[];
  tagRules?: BudgetTagRule[];
  goals?: BudgetGoal[];
};

export type BudgetMonth = {
  id: string;
  month: string;
  incomes: BudgetIncome[];
  fixeds: BudgetFixedExpense[];
  entries: BudgetLedgerEntry[];
  savingsTarget?: number;
  createdAt: string;
  updatedAt: string;
  initializedFrom?: string | null;
};
