// utils/finance.ts (or inside Summary.tsx)
import { Group, Expense, Member } from '@/types/group';

/**
 * Returns a map { memberId -> net balance }.
 * Positive ⇒ member is owed money, Negative ⇒ member owes money.
 */
export function calculateBalancesForSummary(
    members: Member[],
    expenses: Expense[]
  ): Record<string, number> {
    // initialise everyone at 0
    const balances: Record<string, number> = {};
    members.forEach(m => (balances[m.id] = 0));
  
    expenses.forEach(exp => {
      // 1️⃣ credit the payer
      // your expenses store `paidBy` as a *firstName*, so resolve it back to id
      const payerId =
        members.find(m => m.firstName === exp.paidBy)?.id ?? exp.paidBy;
      if (!(payerId in balances)) balances[payerId] = 0;
      balances[payerId] += exp.amount;
  
      // 2️⃣ debit each participant by their share
      Object.entries(exp.splits).forEach(([id, pct]) => {
        if (!(id in balances)) balances[id] = 0;
        balances[id] -= (exp.amount * pct) / 100;
      });
    });
  
    return balances;
  }
  