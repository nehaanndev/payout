
import { DollarSign } from 'lucide-react';
// import { useMemo } from 'react';

import {
    Card,
    CardHeader,
    CardContent,
  } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from "@/components/ui/switch";
import { Badge } from '@/components/ui/badge';
import { Expense, Member } from '@/types/group';
import { Settlement, SettlementMethod } from '@/types/settlement';

import { addExpense, updateExpense, deleteExpense } from "@/lib/firebaseUtils";
import { calculateOpenBalancesMinor, calculateRawBalancesMinor } from '@/lib/financeUtils';
import ExpenseListItem from "@/components/ExpenseListItem";
import { formatMoneySafeGivenCurrency } from '@/lib/currency';
import { toMinor, splitByWeights, CurrencyCode, formatMoney } from '@/lib/currency_core';
import ReceiptUploadPanel, { ReceiptPrefillData } from "@/components/ReceiptUploadPanel";

const SETTLEMENT_METHOD_LABELS: Record<SettlementMethod | "other", string> = {
  paypal: "PayPal",
  zelle: "Zelle",
  cash: "Cash",
  venmo: "Venmo",
  other: "Other",
};

const getSettlementMethodLabel = (method?: SettlementMethod) =>
  SETTLEMENT_METHOD_LABELS[method ?? "other"] ?? "Other";

export interface ExpensesPanelProps {
    /* Data */
    groupName: string;
    expenses: Expense[];
    members: Member[];
    splitMode: 'percentage' | 'weight';
    currentExpense: Omit<Expense, 'amount'> & { amount: string };
    weightSplits: Record<string, number>;
    isEditingExpense: boolean;
    showExpenseForm: boolean;
    settlements: Settlement[];
    youId: string;
    currency:CurrencyCode;
    showReceiptUploader: boolean;
    setShowReceiptUploader: (value: boolean) => void;
    onReceiptPrefill: (data: ReceiptPrefillData) => void;
  
    /* Callbacks to mutate parent state */
    setExpenses: (e: Expense[]) => void;
    setCurrentExpense: (e: Omit<Expense, 'amount'> & { amount: string }) => void;
    setWeightSplits: (w: Record<string, number>) => void;
    setSplitMode: (m: 'percentage' | 'weight') => void;
    setIsEditingExpense: (b: boolean) => void;
    setShowExpenseForm: (b: boolean) => void;
  
    /* External helpers from parent */
    membersMapById: Record<string, Member>;      // computed once in parent for easy lookup
    activeGroupId: string;
    onBack: () => void;      // wizard ←
    onExpensesChange: (newExpenses: Expense[]) => void;
    onConfirmSettlement: (settlement: Settlement) => Promise<void>;
  }
  

  export default function ExpensesPanel({
    /* DATA */
    groupName,
    expenses,
    members,
    splitMode,
    currentExpense,
    weightSplits,
    isEditingExpense,
    showExpenseForm,
    settlements,
    youId,
    currency,
    showReceiptUploader,
    setShowReceiptUploader,
    onReceiptPrefill,
    /* MUTATORS */
    setExpenses,
    setCurrentExpense,
    setWeightSplits,
    setSplitMode,
    setIsEditingExpense,
    setShowExpenseForm,
    /* HELPERS */
  membersMapById,
  activeGroupId,
  /* WIZARD NAV */
  onBack,
  onExpensesChange,
  onConfirmSettlement,
}: ExpensesPanelProps) {

  // ① compute balances with the correct args using minor units
  const balances: Record<string, number> = calculateRawBalancesMinor(members, expenses, currency);
  const openBalances = calculateOpenBalancesMinor(members, expenses, settlements, currency);

  // ② per‐member color palette
  /*const memberColors = useMemo(() => {
    const palette = [
      '#3B82F6', // blue-500
      '#6366F1', // indigo-500
      '#8B5CF6', // violet-500
      '#EC4899', // pink-500
      '#F59E0B', // amber-500
      '#10B981', // green-500
    ];
    return members.reduce((map, m, i) => {
      map[m.id] = palette[i % palette.length];
      return map;
    }, {} as Record<string,string>);
  }, [members]); */
  
  

  const editExpense = (expenseId: string) => {
    setIsEditingExpense(true);
    const expenseToEdit = expenses.find(expense => expense.id === expenseId);
    if (expenseToEdit) {
      setCurrentExpense({
        ...expenseToEdit,
        amount: expenseToEdit.amount.toString() // Convert back to string for form input
      });
      setShowExpenseForm(true);
    }
  };


  const isIdleState = !showExpenseForm && !showReceiptUploader;
  const handleExpenseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedAmount = parseFloat(currentExpense.amount.trim());

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
    alert('Please enter a valid, non-zero amount');
    return;
    }
    // 1. Basic validation
    if (!currentExpense.description ||
        !parsedAmount ||
        !currentExpense.paidBy ||
        !currentExpense.createdAt
    ) {
      alert('Please fill in all expense details');
      return;
    }
    if (!activeGroupId) {
      alert("Please create a group first to add expenses");
      return;
    }
  
    // 2. Compute splits based on mode
    let computedSplits: Record<string, number> = { ...currentExpense.splits };
    if (splitMode === 'weight') {
      const totalWeight = Object.values(weightSplits).reduce((sum, w) => sum + w, 0);
      if (totalWeight === 0) {
        alert("Total weight must be greater than 0");
        return;
      }
      computedSplits = Object.fromEntries(
        Object.entries(weightSplits).map(([memberId, weight]) => [
          memberId,
          (weight / totalWeight) * 100,
        ])
      );
    } else {
      const totalPct = Object.values(computedSplits).reduce(
        (sum, v) => sum + (typeof v === "number" ? v : parseFloat(v as string) || 0),
        0
      );
      if (Math.abs(totalPct - 100) > 0.01) {
        alert('Split percentages must sum to 100%');
        return;
      }
    }
  
    // 3. Persist & update local state
    let updatedExpenses: Expense[] = [];
    const amountMinor = toMinor(parsedAmount, currency);
    if (isEditingExpense) {
      // a) Persist the edit to Firestore
      await updateExpense(activeGroupId, currentExpense.id, {
        description: currentExpense.description,
        amount: parsedAmount,
        paidBy: currentExpense.paidBy,
        splits: computedSplits,
        createdAt: currentExpense.createdAt,
        amountMinor: amountMinor,
        splitsMinor: splitByWeights(amountMinor, computedSplits)
      });
  
      // b) Update in-memory list
      updatedExpenses = expenses.map(exp =>
        exp.id === currentExpense.id
          ? { ...currentExpense, amount:parsedAmount, splits: computedSplits }
          : exp
      );
    } else {
      // a) Create new expense in Firestore
      const newExpensePayload = {
        description: currentExpense.description,
        amount: parsedAmount,
        paidBy: currentExpense.paidBy,
        splits: computedSplits,
        createdAt: currentExpense.createdAt,
        amountMinor: amountMinor,
        splitsMinor: splitByWeights(amountMinor, computedSplits)
      };
      const newExpenseId = await addExpense(
        activeGroupId,
        newExpensePayload.description,
        parsedAmount,
        newExpensePayload.paidBy,
        newExpensePayload.splits,
        newExpensePayload.createdAt,
        amountMinor,
        splitByWeights(amountMinor, newExpensePayload.splits)
      );
  
      // b) Append to local state
      updatedExpenses = [
        ...expenses,
        { id: newExpenseId, ...newExpensePayload },
      ];
    }
  
    // 4. Commit state and reset form
    setExpenses(updatedExpenses);
    onExpensesChange(updatedExpenses);
    clearExpenseForm();
  };
  


    // new local helper
  const clearExpenseForm = () => {
        setShowExpenseForm(false);
        setIsEditingExpense(false);
        setCurrentExpense({
            id: '',
            description: '',
            amount: '',
            paidBy: '',
            splits: {},
            createdAt: new Date(),
            amountMinor: 0,
            splitsMinor: {}
        });
        };


  const updateSplit = (memberId: string, value: string) => {
    // If the user has cleared the field, keep it blank in state:
    if (value === '') {
      // remove that key entirely (so value becomes undefined)
      const { [memberId]: _, ...rest } = currentExpense.splits; // eslint-disable-line @typescript-eslint/no-unused-vars
      setCurrentExpense({
        ...currentExpense,

        splits: rest,
      });
      return;
    }
  
    // Otherwise parse the number.  If it’s invalid, you could ignore or set 0,
    // but at least you let the user finish typing “0” or “10” fully first.
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setCurrentExpense({
        ...currentExpense,
        splits: {
          ...currentExpense.splits,
          [memberId]: num,
        },
      });
    }
  };
  

  const splitEqually = () => {
    const equalPct = Number((100 / members.length).toFixed(4));
    const newSplits: Record<string, number> = members.reduce((acc, m) => {
      acc[m.id] = equalPct;
      return acc;
    }, {} as Record<string, number>);
  
    // Non-functional update:
    setCurrentExpense({
      ...currentExpense,
      splits: newSplits,
    });
  };

  return (
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900">
                <DollarSign className="h-6 w-6 text-emerald-500" />
                <span className="text-xl font-semibold">
                    Expenses for group
                </span>
                <Badge variant="outline" className="border-slate-300 bg-white text-slate-700 px-2 py-0.5 text-sm">
                    {groupName}
                </Badge>
                </div>
                <Button
                size="sm"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
                onClick={onBack}
                >
                Edit group
                </Button>
            </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
        {showExpenseForm ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-900">Add a shared expense</p>
              <p className="text-xs text-slate-500">
                This flows straight into the overview cards, so every field mirrors that calmer theme.
              </p>
            </div>
            <form onSubmit={handleExpenseSubmit} className="space-y-4">
            <div>
                <Label htmlFor="description">Description</Label>
                <Input
                id="description"
                value={currentExpense.description}
                onChange={(e) => setCurrentExpense({ ...currentExpense, description: e.target.value })}
                placeholder="What's this expense for?"
                className="mt-1"
                required
                />
            </div>

            <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    className="mt-1 no-spinner"
                    value={currentExpense.amount}
                    onChange={(e) => {
                        setCurrentExpense({
                        ...currentExpense,
                        amount: e.target.value, // allow user to type blank, float, etc.
                        });
                    }}
                    required
                />

            </div>

            <div>
            <Label htmlFor="paidBy">Paid By</Label>
            <select
              id="paidBy"
              value={currentExpense.paidBy ?? ""} // this should be the member.id
              onChange={(e) =>
                setCurrentExpense({ ...currentExpense, paidBy: e.target.value })
              }
              className="w-full mt-1 rounded-md border border-gray-300 p-2"
              required
            >
              <option value="">Select person</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName}
                </option>
              ))}
            </select>
            </div>
            <div>
                <Label htmlFor="date">Date</Label>
                <Input
                id="date"
                type="date"
                value={currentExpense.createdAt ? new Date(currentExpense.createdAt).toISOString().split('T')[0] : ''}
                onChange={(e) => setCurrentExpense({ ...currentExpense, createdAt: new Date(e.target.value) })}
                className="mt-1"
                required
                />
            </div>
            <div>
                <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label>Split By</Label>
                    <div className="flex items-center justify-between mb-4">
                    <Label className="text-base">Split Mode</Label>
                    <div className="flex items-center gap-2">
                        <span className={splitMode === 'percentage' ? 'text-sm font-semibold' : 'text-sm text-gray-500'}>%</span>
                        <Switch
                        checked={splitMode === 'weight'}
                        onCheckedChange={(checked) => {
                            const newMode = checked ? 'weight' : 'percentage';

                            if (newMode === 'weight') {
                                // Convert current percentages to weights
                                const newWeights = members.reduce<Record<string, number>>((acc, member) => {
                                    acc[member.id] = currentExpense.splits[member.id] || 0;
                                    return acc;
                                }, {});
                            setWeightSplits(newWeights);
                            } else {
                                // Convert weights to percentages
                                const totalWeight = Object.values(weightSplits).reduce((sum, w) => sum + w, 0);
                                if (totalWeight > 0) {
                                    const newSplits = members.reduce<Record<string, number>>((acc, member) => {
                                    const w = weightSplits[member.id] || 0;
                                    acc[member.id] = (w / totalWeight) * 100;
                                    return acc;
                                    }, {});
                                    // ✂️ FUNCTIONAL UPDATE → PLAIN OBJECT
                                    setCurrentExpense({
                                        ...currentExpense,
                                        splits: newSplits,
                                    });
                                }
                            }

                            setSplitMode(newMode);
                        }}
                        />
                        <span className={splitMode === 'weight' ? 'text-sm font-semibold' : 'text-sm text-gray-500'}>w</span>
                    </div>
                    </div>

                </div>
                {splitMode === 'percentage' && (
                    <>
                    <div className="flex justify-between items-center">
                        <Label>Split Percentages</Label>
                        <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-slate-300 text-slate-700 hover:bg-slate-50"
                        onClick={splitEqually}
                        >
                        Split Equally
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {members.map(member => (
                        <div key={member.firstName} className="flex items-center gap-2">
                            <span className="w-24">{member.firstName}</span>
                            <Input
                            type="number"
                            value={currentExpense.splits[member.id] ?? ''}
                            onChange={(e) => updateSplit(member.id, e.target.value)}
                            placeholder=""
                            required
                            />
                            <span>%</span>
                        </div>
                        ))}
                    </div>
                    </>
                )}
                {splitMode === 'weight' && (
                    <>
                    <Label>Weights</Label>
                    <div className="space-y-2">
                        {members.map(member => (
                        <div key={member.firstName} className="flex items-center gap-2">
                            <span className="w-24">{member.firstName}</span>
                            <Input
                            type="number"
                            value={weightSplits[member.id] || ''}
                            onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                const newSplits = { ...weightSplits, [member.id]: value };
                                setWeightSplits(newSplits);
                            }}
                            placeholder="0"
                            required
                            />
                            <span>pts</span>
                        </div>
                        ))}
                    </div>
                    </>
                )}
                </div>
            </div>

            <div className="flex justify-end space-x-3 mt-4">
              <Button
                type="button"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => clearExpenseForm()}
                >
                Cancel
                </Button>
                <Button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium"
                >
                Save Expense
              </Button>
            </div>
            </form>
            </div>
        ) : showReceiptUploader ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <ReceiptUploadPanel
              members={members}
              currency={currency}
              defaultPayerId={youId}
              onCancel={() => setShowReceiptUploader(false)}
              onPrefill={(data) => {
                onReceiptPrefill(data);
              }}
            />
            </div>
        ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium"
                disabled={!activeGroupId}
                onClick={() => {
                  setShowReceiptUploader(false);
                  setShowExpenseForm(true);
                }}
                title={!activeGroupId ? "Select or create a group first" : undefined}
              >
                Add Expense Manually
              </Button>
              <Button
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={!activeGroupId}
                onClick={() => {
                  setShowExpenseForm(false);
                  setShowReceiptUploader(true);
                }}
                title={!activeGroupId ? "Select or create a group first" : undefined}
              >
                Upload Receipt
              </Button>
            </div>
        )}
        {/* 2️⃣ List of existing expenses */}
        {isIdleState && (
          <div className="mt-6 space-y-1 rounded-xl overflow-hidden">
            {expenses.map((exp) => (
              <ExpenseListItem
                key={exp.id}
                expense={exp}
                membersMapById={membersMapById}
                youId={youId}
                group_currency={currency}
                onEdit={() => editExpense(exp.id)}
                onDelete={async () => {
                  if (!activeGroupId) return;
                  if (!confirm("Delete this expense?")) return;
                  await deleteExpense(activeGroupId, exp.id);
                  setExpenses(expenses.filter((e) => e.id !== exp.id));
                }}
              />
            ))}
          </div>
        )}

        {isIdleState && expenses.length > 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 space-y-4 hover:bg-slate-50">
            <div className="flex items-center justify-between">
              <h3 className="text-black font-semibold">Settlements</h3>
              {settlements.length > 0 ? (
                <span className="text-xs text-slate-500">
                  Showing {settlements.length} settlement{settlements.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            {settlements.length === 0 ? (
              <p className="text-sm text-slate-500">
                Record payments from the overview tab to mark debts as settled.
              </p>
            ) : (
              <div className="space-y-3">
                {settlements.map((settlement) => {
                  const payer = membersMapById[settlement.payerId]?.firstName ?? settlement.payerId;
                  const payee = membersMapById[settlement.payeeId]?.firstName ?? settlement.payeeId;
                  const methodLabel = getSettlementMethodLabel(settlement.method);
                  const statusLabel = settlement.status === "pending" ? "Awaiting confirmation" : "Confirmed";
                  const statusBadgeClass =
                    settlement.status === "pending"
                      ? "border-amber-300/70 text-amber-700"
                      : "border-emerald-300/70 text-emerald-700";
                  const amountLabel = formatMoneySafeGivenCurrency(toMinor(settlement.amount, currency), currency);
                  const note = settlement.paymentNote;
                  const isPayee = settlement.payeeId === youId;
                  const isPending = settlement.status === "pending";

                  return (
                    <div
                      key={settlement.id}
                      className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {payer} <span className="text-slate-400">→</span> {payee}
                          </p>
                          <p className="text-xs text-slate-500">
                            {amountLabel} on {new Date(settlement.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-slate-200 text-slate-600">
                            {methodLabel}
                          </Badge>
                          <Badge variant="outline" className={statusBadgeClass}>
                            {statusLabel}
                          </Badge>
                        </div>
                      </div>
                      {note ? (
                        <p className="text-xs italic text-slate-500">
                          “{note}”
                        </p>
                      ) : null}
                      {isPending ? (
                        <div className="flex justify-end">
                          {isPayee ? (
                            <Button
                              size="sm"
                              className="bg-emerald-600 text-white hover:bg-emerald-500"
                              onClick={() => {
                                void onConfirmSettlement(settlement);
                              }}
                            >
                              Mark as received
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Waiting for {payee} to confirm
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <hr className="my-2" />

            <h3 className="text-black font-semibold">Balances after confirmed settlements</h3>
            {(Object.entries(openBalances) as [string, number][]).map(([id, bal]) => {
              const name = membersMapById[id]?.firstName ?? id;
              return (
                <div key={id} className="flex justify-between text-sm">
                  <span className="text-black">{name}</span>
                  <span className={bal >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {formatMoney(bal, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {isIdleState && expenses.length > 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 space-y-4 hover:bg-slate-50">
            <h3 className="text-black font-semibold mb-2">{settlements.length > 0 ? "Original " : ""}Balances</h3>

            {/* ← Assert the entry type so TS knows bal is a number: */}
            {(Object.entries(balances) as [string, number][]).map(([id, bal]) => {
              const name = membersMapById[id]?.firstName ?? id;
              return (
                <div key={id} className="text-sm flex justify-between">
                  <span>{name}</span>
                  <span className={bal >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {formatMoney(bal, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 3️⃣ Back / Save buttons */}
        {isIdleState && (
          <div className="flex justify-end mt-6">
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white" onClick={onBack}>
              Back To Group Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
