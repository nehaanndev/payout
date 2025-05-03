// utils/finance.ts (or inside Summary.tsx)
import { Group, Expense, Member } from '@/types/group';

/**
 * Compute net balances = (what you paid) − (what you owe by split).
 * Positive ⇒ you’re owed money; Negative ⇒ you owe money.
 */
export function calculateRawBalances(
  members: Member[],
  expenses: Expense[]
): Record<string, number> {
  const balances: Record<string, number> = {};
  members.forEach(m => (balances[m.id] = 0));

  expenses.forEach(exp => {
    const payerId =
      members.find(m => m.firstName === exp.paidBy)?.id ?? exp.paidBy;
    if (!(payerId in balances)) balances[payerId] = 0;
    balances[payerId] += exp.amount;

    Object.entries(exp.splits).forEach(([memberId, pct]) => {
      if (!(memberId in balances)) balances[memberId] = 0;
      balances[memberId] -= (exp.amount * pct) / 100;
    });
  });

  return balances;
}

/**
 * (Optional) Subtracts any settlements from the raw balances.
 */
export function calculateOpenBalances(
  members: Member[],
  expenses: Expense[],
  settlements: { payerId: string; payeeId: string; amount: number }[]
): Record<string, number> {
  const raw = calculateRawBalances(members, expenses);
  settlements.forEach(s => {
    // payer paid off some of their debt ⇒ decrease their balance
    raw[s.payerId] = (raw[s.payerId] ?? 0) - s.amount;
    // payee received money ⇒ increase their balance
    raw[s.payeeId] = (raw[s.payeeId] ?? 0) + s.amount;
  });
  return raw;
}