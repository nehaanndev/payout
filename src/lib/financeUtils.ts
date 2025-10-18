// utils/finance.ts (or inside Summary.tsx)
import { Expense, Member } from '@/types/group';
import { CurrencyCode, toMinor } from '@/lib/currency_core';

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

/**
 * Given final net balances for each member,
 * generate a minimal set of payments to settle all debts.
 *
 * @param members   The group’s Member[] (so everyone appears in the result)
 * @param balances A map of memberId → net balance (positive = they’re owed, negative = they owe)
 * @returns A map of memberId → { owes, receives }
 */
export function getSettlementPlan(
  members: Member[],
  balances: Record<string, number>
): Record<string, {
  owes: { to: string; amount: number }[];
  receives: { from: string; amount: number }[];
}> {
  // 1️⃣ Build sorted arrays of debtors (balance<0) and creditors (balance>0)
  type Person = { id: string; balance: number };
  const debtors: Person[] = [];
  const creditors: Person[] = [];

  for (const m of members) {
    const bal = balances[m.id] ?? 0;
    if (bal < -0.005) debtors.push({ id: m.id, balance: bal });
    else if (bal > 0.005) creditors.push({ id: m.id, balance: bal });
  }

  // sort so we always match the biggest debts/credits first
  debtors.sort((a, b) => a.balance - b.balance);     // most negative first
  creditors.sort((a, b) => b.balance - a.balance);   // most positive first

  // 2️⃣ Initialize the result structure for everybody
  const plan: Record<string, {
    owes: { to: string; amount: number }[];
    receives: { from: string; amount: number }[];
  }> = {};

  for (const m of members) {
    plan[m.id] = { owes: [], receives: [] };
  }

  // 3️⃣ Greedily match debtors to creditors
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];

    // how much can flow from debtor -> creditor?
    const amount = Math.min(-debtor.balance, creditor.balance);
    if (amount <= 0) break;

    // record it
    plan[debtor.id].owes.push({ to: creditor.id, amount });
    plan[creditor.id].receives.push({ from: debtor.id, amount });

    // adjust balances
    debtor.balance += amount;
    creditor.balance -= amount;

    // advance pointers if one is settled
    if (Math.abs(debtor.balance) < 0.005) di++;
    if (Math.abs(creditor.balance) < 0.005) ci++;
  }

  return plan;
}

/**
 * Compute net balances using minor units when available for better precision.
 * Positive ⇒ you're owed money; Negative ⇒ you owe money.
 * Returns balances in minor units.
 */
export function calculateRawBalancesMinor(
  members: Member[],
  expenses: Expense[],
  currency: CurrencyCode
): Record<string, number> {
  const balances: Record<string, number> = {};
  members.forEach(m => (balances[m.id] = 0));

  expenses.forEach(exp => {
    const payerId =
      members.find(m => m.firstName === exp.paidBy)?.id ?? exp.paidBy;
    if (!(payerId in balances)) balances[payerId] = 0;

    // Use amountMinor if available, otherwise convert amount to minor units
    const amountMinor = exp.amountMinor ?? toMinor(exp.amount, currency);
    balances[payerId] += amountMinor;

    // Use splitsMinor if available, otherwise calculate from splits
    if (exp.splitsMinor && Object.keys(exp.splitsMinor).length > 0) {
      Object.entries(exp.splitsMinor).forEach(([memberId, splitMinor]) => {
        if (!(memberId in balances)) balances[memberId] = 0;
        balances[memberId] -= splitMinor;
      });
    } else {
      // Fallback to percentage-based calculation
      Object.entries(exp.splits).forEach(([memberId, pct]) => {
        if (!(memberId in balances)) balances[memberId] = 0;
        balances[memberId] -= Math.round((amountMinor * pct) / 100);
      });
    }
  });

  return balances;
}

/**
 * Calculate open balances using minor units when available.
 * Subtracts any settlements from the raw balances.
 * Returns balances in minor units.
 */
export function calculateOpenBalancesMinor(
  members: Member[],
  expenses: Expense[],
  settlements: { payerId: string; payeeId: string; amount: number }[],
  currency: CurrencyCode
): Record<string, number> {
  const raw = calculateRawBalancesMinor(members, expenses, currency);
  settlements.forEach(s => {
    // Convert settlement amount to minor units
    const settlementMinor = toMinor(s.amount, currency);
    // payer paid off some of their debt ⇒ decrease their balance
    raw[s.payerId] = (raw[s.payerId] ?? 0) - settlementMinor;
    // payee received money ⇒ increase their balance
    raw[s.payeeId] = (raw[s.payeeId] ?? 0) + settlementMinor;
  });
  return raw;
}

/**
 * Get settlement plan using minor units for better precision.
 * Returns amounts in minor units.
 */
export function getSettlementPlanMinor(
  members: Member[],
  balancesMinor: Record<string, number>,
): Record<string, {
  owes: { to: string; amount: number }[];
  receives: { from: string; amount: number }[];
}> {
  // 1️⃣ Build sorted arrays of debtors (balance<0) and creditors (balance>0)
  type Person = { id: string; balance: number };
  const debtors: Person[] = [];
  const creditors: Person[] = [];

  // Use currency-specific threshold (1 minor unit)
  const threshold = 1;

  for (const m of members) {
    const bal = balancesMinor[m.id] ?? 0;
    if (bal < -threshold) debtors.push({ id: m.id, balance: bal });
    else if (bal > threshold) creditors.push({ id: m.id, balance: bal });
  }

  // sort so we always match the biggest debts/credits first
  debtors.sort((a, b) => a.balance - b.balance);     // most negative first
  creditors.sort((a, b) => b.balance - a.balance);   // most positive first

  // 2️⃣ Initialize the result structure for everybody
  const plan: Record<string, {
    owes: { to: string; amount: number }[];
    receives: { from: string; amount: number }[];
  }> = {};

  for (const m of members) {
    plan[m.id] = { owes: [], receives: [] };
  }

  // 3️⃣ Greedily match debtors to creditors
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];

    // how much can flow from debtor -> creditor?
    const amount = Math.min(-debtor.balance, creditor.balance);
    if (amount <= 0) break;

    // record it
    plan[debtor.id].owes.push({ to: creditor.id, amount });
    plan[creditor.id].receives.push({ from: debtor.id, amount });

    // adjust balances
    debtor.balance += amount;
    creditor.balance -= amount;

    // advance pointers if one is settled
    if (Math.abs(debtor.balance) < threshold) di++;
    if (Math.abs(creditor.balance) < threshold) ci++;
  }

  return plan;
}