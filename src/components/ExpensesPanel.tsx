
import { DollarSign, TrendingUp, TrendingDown, Clock, Wallet, CreditCard, Banknote, ArrowRight, Receipt, Plus, FileText, Sparkles } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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

const SETTLEMENT_METHOD_ICONS: Record<SettlementMethod | "other", typeof Wallet> = {
  paypal: Wallet,
  zelle: CreditCard,
  cash: Banknote,
  venmo: Wallet,
  other: Wallet,
};

const getSettlementMethodLabel = (method?: SettlementMethod) =>
  SETTLEMENT_METHOD_LABELS[method ?? "other"] ?? "Other";

const getSettlementMethodIcon = (method?: SettlementMethod) =>
  SETTLEMENT_METHOD_ICONS[method ?? "other"] ?? Wallet;

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
    isNight?: boolean;
  
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
    isNight = false,
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
  const openBalanceEntries = Object.entries(openBalances) as [string, number][];
  const yourBalance = openBalances[youId] ?? 0;
  const membersWhoOweYou = openBalanceEntries.filter(
    ([id, bal]) => id !== youId && bal < 0
  );
  const membersYouOwe = openBalanceEntries.filter(
    ([id, bal]) => id !== youId && bal > 0
  );
  const totalOwedToYou = yourBalance > 0 ? yourBalance : 0;
  const totalYouOwe = yourBalance < 0 ? Math.abs(yourBalance) : 0;
  const pendingSettlements = settlements.filter((settlement) => settlement.status === "pending");
  const pendingTotal = pendingSettlements.reduce((sum, settlement) => sum + settlement.amount, 0);
  const originalBalanceEntries = Object.entries(balances) as [string, number][];

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
    const computedSplitsMinor = splitByWeights(amountMinor, computedSplits);
    if (isEditingExpense) {
      // a) Persist the edit to Firestore
      await updateExpense(activeGroupId, currentExpense.id, {
        description: currentExpense.description,
        amount: parsedAmount,
        paidBy: currentExpense.paidBy,
        splits: computedSplits,
        createdAt: currentExpense.createdAt,
        amountMinor: amountMinor,
        splitsMinor: computedSplitsMinor,
      });
  
      // b) Update in-memory list
      updatedExpenses = expenses.map(exp =>
        exp.id === currentExpense.id
          ? {
              ...currentExpense,
              amount: parsedAmount,
              splits: computedSplits,
              amountMinor,
              splitsMinor: computedSplitsMinor,
            }
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
        splitsMinor: computedSplitsMinor,
      };
      const newExpenseId = await addExpense(
        activeGroupId,
        newExpensePayload.description,
        parsedAmount,
        newExpensePayload.paidBy,
        newExpensePayload.splits,
        newExpensePayload.createdAt,
        amountMinor,
        computedSplitsMinor
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
            splitsMinor: {},
            tags: [],
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
        <Card className={cn("rounded-3xl border shadow-sm", isNight ? "border-white/15 bg-slate-900/60" : "border-slate-200 bg-white")}>
            <CardHeader className={cn("border-b p-6", isNight ? "border-white/15 bg-slate-800/60" : "border-slate-100 bg-slate-50/80")}>
            <div className="flex items-center justify-between">
                <div className={cn("flex items-center gap-2", isNight ? "text-white" : "text-slate-900")}>
                <DollarSign className="h-6 w-6 text-emerald-500" />
                <span className="text-xl font-semibold">
                    Expenses for group
                </span>
                <Badge variant="outline" className={cn("px-2 py-0.5 text-sm", isNight ? "border-white/20 bg-white/10 text-slate-200" : "border-slate-300 bg-white text-slate-700")}>
                    {groupName}
                </Badge>
                </div>
                <Button
                size="sm"
                variant="outline"
                className={cn(isNight ? "border-white/20 bg-white/10 text-slate-200 hover:bg-white/20" : "border-slate-300 text-slate-700 hover:bg-slate-100")}
                onClick={onBack}
                >
                Edit group
                </Button>
            </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
        {showExpenseForm ? (
            <div className={cn("rounded-2xl border p-6", isNight ? "border-white/15 bg-slate-800/60" : "border-slate-200 bg-slate-50/60")}>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Plus className={cn("h-5 w-5", isNight ? "text-emerald-400" : "text-emerald-600")} />
                <p className={cn("text-base font-semibold", isNight ? "text-white" : "text-slate-900")}>Add a shared expense</p>
              </div>
              <p className={cn("text-xs leading-relaxed", isNight ? "text-slate-300" : "text-slate-500")}>
                This flows straight into the overview cards, so every field mirrors that calmer theme.
              </p>
            </div>
            <form onSubmit={handleExpenseSubmit} className="space-y-5">
            <div>
                <Label htmlFor="description" className={cn(isNight ? "text-slate-200" : "")}>Description</Label>
                <Input
                id="description"
                value={currentExpense.description}
                onChange={(e) => setCurrentExpense({ ...currentExpense, description: e.target.value })}
                placeholder="What's this expense for?"
                className={cn("mt-1", isNight ? "border-white/30 bg-slate-900/50 text-white placeholder:text-white/40" : "")}
                required
                />
            </div>

            <div>
                <Label htmlFor="amount" className={cn(isNight ? "text-slate-200" : "")}>Amount</Label>
                <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    className={cn("mt-1 no-spinner", isNight ? "border-white/30 bg-slate-900/50 text-white placeholder:text-white/40" : "")}
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
            <Label htmlFor="paidBy" className={cn(isNight ? "text-slate-200" : "")}>Paid By</Label>
            <select
              id="paidBy"
              value={currentExpense.paidBy ?? ""} // this should be the member.id
              onChange={(e) =>
                setCurrentExpense({ ...currentExpense, paidBy: e.target.value })
              }
              className={cn("w-full mt-1 rounded-md border p-2", isNight ? "border-white/30 bg-slate-900/50 text-white" : "border-gray-300")}
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
                <Label htmlFor="date" className={cn(isNight ? "text-slate-200" : "")}>Date</Label>
                <Input
                id="date"
                type="date"
                value={currentExpense.createdAt ? new Date(currentExpense.createdAt).toISOString().split('T')[0] : ''}
                onChange={(e) => setCurrentExpense({ ...currentExpense, createdAt: new Date(e.target.value) })}
                className={cn("mt-1", isNight ? "border-white/30 bg-slate-900/50 text-white" : "")}
                required
                />
            </div>
            <div>
                <div className={cn("space-y-5 rounded-xl border p-4", isNight ? "border-white/10 bg-slate-900/40" : "border-slate-200 bg-white/80")}>
                <div className="flex items-center justify-between">
                    <Label className={cn("text-sm font-semibold", isNight ? "text-slate-200" : "")}>Split By</Label>
                    <div className="flex items-center gap-3">
                    <Label className={cn("text-sm font-medium", isNight ? "text-slate-300" : "text-slate-600")}>Split Mode</Label>
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                      isNight 
                        ? "border-white/20 bg-white/5" 
                        : "border-slate-200 bg-slate-50"
                    )}>
                        <span className={cn(
                          "text-sm font-medium transition-colors",
                          splitMode === 'percentage' 
                            ? isNight ? "text-white" : "text-slate-900"
                            : isNight ? "text-slate-400" : "text-slate-500"
                        )}>%</span>
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
                        <span className={cn(
                          "text-sm font-medium transition-colors",
                          splitMode === 'weight' 
                            ? isNight ? "text-white" : "text-slate-900"
                            : isNight ? "text-slate-400" : "text-slate-500"
                        )}>w</span>
                    </div>
                    </div>

                </div>
                {splitMode === 'percentage' && (
                    <>
                    <div className="flex justify-between items-center">
                        <Label className={cn("text-sm font-semibold", isNight ? "text-slate-200" : "")}>Split Percentages</Label>
                        <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "transition-all duration-200 hover:scale-105",
                          isNight 
                            ? "border-white/20 bg-white/10 text-slate-200 hover:bg-white/20" 
                            : "border-slate-300 text-slate-700 hover:bg-slate-50"
                        )}
                        onClick={splitEqually}
                        >
                        Split Equally
                        </Button>
                    </div>
                    <div className={cn("space-y-3 rounded-lg p-3", isNight ? "bg-slate-900/30" : "bg-white/60")}>
                        {members.map(member => (
                        <div key={member.firstName} className="flex items-center gap-3">
                            <span className={cn("w-24 text-sm font-medium", isNight ? "text-slate-200" : "text-slate-700")}>{member.firstName}</span>
                            <Input
                            type="number"
                            value={currentExpense.splits[member.id] ?? ''}
                            onChange={(e) => updateSplit(member.id, e.target.value)}
                            placeholder="0"
                            className={cn("flex-1", isNight ? "border-white/30 bg-slate-900/50 text-white placeholder:text-white/40" : "")}
                            required
                            />
                            <span className={cn("text-sm font-medium w-6", isNight ? "text-slate-300" : "text-slate-600")}>%</span>
                        </div>
                        ))}
                    </div>
                    </>
                )}
                {splitMode === 'weight' && (
                    <>
                    <Label className={cn("text-sm font-semibold", isNight ? "text-slate-200" : "")}>Weights</Label>
                    <div className={cn("space-y-3 rounded-lg p-3", isNight ? "bg-slate-900/30" : "bg-white/60")}>
                        {members.map(member => (
                        <div key={member.firstName} className="flex items-center gap-3">
                            <span className={cn("w-24 text-sm font-medium", isNight ? "text-slate-200" : "text-slate-700")}>{member.firstName}</span>
                            <Input
                            type="number"
                            value={weightSplits[member.id] || ''}
                            onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                const newSplits = { ...weightSplits, [member.id]: value };
                                setWeightSplits(newSplits);
                            }}
                            placeholder="0"
                            className={cn("flex-1", isNight ? "border-white/30 bg-slate-900/50 text-white placeholder:text-white/40" : "")}
                            required
                            />
                            <span className={cn("text-sm font-medium w-10", isNight ? "text-slate-300" : "text-slate-600")}>pts</span>
                        </div>
                        ))}
                    </div>
                    </>
                )}
                </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t" style={isNight ? { borderColor: 'rgba(255, 255, 255, 0.1)' } : { borderColor: 'rgb(226, 232, 240)' }}>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "transition-all duration-200 hover:scale-105",
                  isNight 
                    ? "border-white/20 bg-white/10 text-slate-200 hover:bg-white/20" 
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                )}
                onClick={() => clearExpenseForm()}
                >
                Cancel
                </Button>
                <Button
                type="submit"
                className={cn(
                  "font-medium transition-all duration-200 hover:scale-105 flex items-center gap-2",
                  isNight 
                    ? "bg-emerald-500/90 text-slate-900 hover:bg-emerald-400 border-transparent" 
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                )}
                >
                <DollarSign className="h-4 w-4" />
                Save Expense
              </Button>
            </div>
            </form>
            </div>
        ) : showReceiptUploader ? (
            <div className={cn("rounded-2xl border p-5", isNight ? "border-white/15 bg-slate-800/60" : "border-slate-200 bg-slate-50/60")}>
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
                className={cn(
                  "font-medium transition-all duration-200 hover:scale-[1.02] flex items-center gap-2",
                  isNight 
                    ? "bg-emerald-500/90 text-slate-900 hover:bg-emerald-400 border-transparent" 
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                )}
                disabled={!activeGroupId}
                onClick={() => {
                  setShowReceiptUploader(false);
                  setShowExpenseForm(true);
                }}
                title={!activeGroupId ? "Select or create a group first" : undefined}
              >
                <Plus className="h-4 w-4" />
                Add Expense Manually
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "transition-all duration-200 hover:scale-[1.02] flex items-center gap-2",
                  isNight 
                    ? "border-white/20 bg-white/10 text-slate-200 hover:bg-white/20" 
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                )}
                disabled={!activeGroupId}
                onClick={() => {
                  setShowExpenseForm(false);
                  setShowReceiptUploader(true);
                }}
                title={!activeGroupId ? "Select or create a group first" : undefined}
              >
                <FileText className="h-4 w-4" />
                Upload Receipt
              </Button>
            </div>
        )}
        {/* 2️⃣ List of existing expenses */}
        {isIdleState && (
          <div className="mt-6 space-y-3">
            {expenses.length === 0 ? (
              <div className={cn(
                "rounded-2xl border border-dashed p-8 text-center",
                isNight 
                  ? "border-white/15 bg-slate-800/40" 
                  : "border-slate-200 bg-slate-50/80"
              )}>
                <Receipt className={cn(
                  "h-12 w-12 mx-auto mb-3",
                  isNight ? "text-slate-500" : "text-slate-400"
                )} />
                <p className={cn("text-sm font-semibold mb-1", isNight ? "text-white" : "text-slate-900")}>
                  No expenses yet
                </p>
                <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>
                  Add your first expense to start tracking shared costs
                </p>
              </div>
            ) : (
              expenses.map((exp) => (
                <ExpenseListItem
                  key={exp.id}
                  expense={exp}
                  membersMapById={membersMapById}
                  youId={youId}
                  group_currency={currency}
                  isNight={isNight}
                  onEdit={() => editExpense(exp.id)}
                  onDelete={async () => {
                    if (!activeGroupId) return;
                    if (!confirm("Delete this expense?")) return;
                    await deleteExpense(activeGroupId, exp.id);
                    setExpenses(expenses.filter((e) => e.id !== exp.id));
                  }}
                />
              ))
            )}
          </div>
        )}

        {isIdleState && expenses.length > 0 && (
          <div className="mt-8 space-y-6">
            <div className={cn("rounded-3xl border p-5 shadow-sm", isNight ? "border-white/15 bg-slate-800/60 shadow-slate-900/50" : "border-slate-200 bg-white/95 shadow-slate-200/60")}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className={cn("text-xs font-semibold uppercase tracking-[0.35em]", isNight ? "text-slate-300" : "text-slate-400")}>
                    Settlements & balances
                  </p>
                  <h3 className={cn("text-xl font-semibold", isNight ? "text-white" : "text-slate-900")}>Keep the ledger honest</h3>
                  <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-500")}>
                    Pending paybacks automatically adjust everyone&apos;s balance.
                  </p>
                </div>
                <div className="grid w-full gap-3 sm:grid-cols-3 md:w-auto">
                    <div className={cn(
                      "relative rounded-2xl border p-4 overflow-hidden transition-all duration-200 hover:scale-[1.02]",
                      isNight 
                        ? "border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5" 
                        : "border-slate-200 bg-gradient-to-br from-slate-50/70 to-emerald-50/30"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className={cn("h-4 w-4", isNight ? "text-emerald-300" : "text-emerald-600")} />
                        <p className={cn("text-xs font-semibold uppercase tracking-[0.3em]", isNight ? "text-emerald-200" : "text-slate-500")}>
                          You&apos;re owed
                        </p>
                      </div>
                      <div className={cn("text-2xl font-bold mb-1", isNight ? "text-emerald-200" : "text-emerald-700")}>
                        {formatMoney(totalOwedToYou, currency)}
                      </div>
                      <p className={cn("text-xs leading-relaxed", isNight ? "text-emerald-200/80" : "text-slate-500")}>
                        {totalOwedToYou > 0
                          ? `From ${Math.max(membersWhoOweYou.length, 1)} roommate${
                              Math.max(membersWhoOweYou.length, 1) > 1 ? "s" : ""
                            }`
                          : "No one owes you right now."}
                      </p>
                    </div>
                    <div className={cn(
                      "relative rounded-2xl border p-4 overflow-hidden transition-all duration-200 hover:scale-[1.02]",
                      isNight 
                        ? "border-rose-400/30 bg-gradient-to-br from-rose-500/10 to-rose-500/5" 
                        : "border-slate-200 bg-gradient-to-br from-slate-50/70 to-rose-50/30"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className={cn("h-4 w-4", isNight ? "text-rose-300" : "text-rose-600")} />
                        <p className={cn("text-xs font-semibold uppercase tracking-[0.3em]", isNight ? "text-rose-200" : "text-slate-500")}>
                          You owe
                        </p>
                      </div>
                      <div className={cn("text-2xl font-bold mb-1", isNight ? "text-rose-200" : "text-rose-600")}>
                        {formatMoney(totalYouOwe, currency)}
                      </div>
                      <p className={cn("text-xs leading-relaxed", isNight ? "text-rose-200/80" : "text-slate-500")}>
                        {totalYouOwe > 0
                          ? `To ${Math.max(membersYouOwe.length, 1)} friend${
                              Math.max(membersYouOwe.length, 1) > 1 ? "s" : ""
                            }`
                          : "Nothing due on your side."}
                      </p>
                    </div>
                    <div className={cn(
                      "relative rounded-2xl border p-4 overflow-hidden transition-all duration-200 hover:scale-[1.02]",
                      isNight 
                        ? "border-indigo-400/30 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5" 
                        : "border-slate-200 bg-gradient-to-br from-white to-indigo-50/20"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className={cn("h-4 w-4", isNight ? "text-indigo-300" : "text-indigo-600")} />
                        <p className={cn("text-xs font-semibold uppercase tracking-[0.3em]", isNight ? "text-indigo-200" : "text-slate-500")}>
                          Pending
                        </p>
                      </div>
                      <div className={cn("text-2xl font-bold mb-1", isNight ? "text-indigo-200" : "text-indigo-600")}>
                        {pendingSettlements.length ? formatMoney(pendingTotal, currency) : "—"}
                      </div>
                      <p className={cn("text-xs leading-relaxed", isNight ? "text-indigo-200/80" : "text-slate-500")}>
                        {pendingSettlements.length
                          ? `${pendingSettlements.length} settlement${pendingSettlements.length > 1 ? "s" : ""} awaiting confirmation`
                          : "All recent payments are confirmed."}
                      </p>
                    </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-sm font-semibold", isNight ? "text-white" : "text-slate-900")}>Recent settlements</p>
                      <p className={cn("text-xs", isNight ? "text-slate-300" : "text-slate-500")}>
                        {settlements.length
                          ? "Track what's pending versus confirmed."
                          : "Record payments from the overview tab to list them here."}
                      </p>
                    </div>
                    {settlements.length ? (
                      <Badge variant="outline" className={cn("text-xs", isNight ? "border-white/20 bg-white/10 text-slate-200" : "border-slate-200 text-slate-600")}>
                        {settlements.length} total
                      </Badge>
                    ) : null}
                  </div>
                  {settlements.length === 0 ? (
                    <div className={cn("rounded-2xl border border-dashed p-8 text-center", isNight ? "border-white/15 bg-slate-800/40" : "border-slate-200 bg-slate-50/80")}>
                      <Wallet className={cn("h-10 w-10 mx-auto mb-3", isNight ? "text-slate-500" : "text-slate-400")} />
                      <p className={cn("text-sm font-semibold mb-1", isNight ? "text-white" : "text-slate-900")}>
                        No settlements yet
                      </p>
                      <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>
                        Record payments from the overview tab to mark debts as settled.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {settlements.map((settlement) => {
                        const payer = membersMapById[settlement.payerId]?.firstName ?? settlement.payerId;
                        const payee = membersMapById[settlement.payeeId]?.firstName ?? settlement.payeeId;
                        const methodLabel = getSettlementMethodLabel(settlement.method);
                        const MethodIcon = getSettlementMethodIcon(settlement.method);
                        const statusLabel =
                          settlement.status === "pending" ? "Awaiting confirmation" : "Confirmed";
                        const statusBadgeClass =
                          settlement.status === "pending"
                            ? "border-amber-300/70 text-amber-700"
                            : "border-emerald-300/70 text-emerald-700";
                        const amountLabel = formatMoneySafeGivenCurrency(
                          toMinor(settlement.amount, currency),
                          currency
                        );
                        const note = settlement.paymentNote;
                        const isPayee = settlement.payeeId === youId;
                        const isPending = settlement.status === "pending";

                        return (
                          <div
                            key={settlement.id}
                            className={cn(
                              "space-y-3 rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md",
                              isNight 
                                ? "border-white/15 bg-slate-800/60 shadow-slate-900/50 hover:bg-slate-800/70" 
                                : "border-slate-200 bg-white hover:shadow-slate-200/50"
                            )}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className={cn("text-sm font-semibold", isNight ? "text-white" : "text-slate-900")}>
                                    {payer}
                                  </p>
                                  <ArrowRight className={cn("h-4 w-4 flex-shrink-0", isNight ? "text-slate-400" : "text-slate-500")} />
                                  <p className={cn("text-sm font-semibold", isNight ? "text-white" : "text-slate-900")}>
                                    {payee}
                                  </p>
                                </div>
                                <p className={cn("text-xs", isNight ? "text-slate-300" : "text-slate-500")}>
                                  {amountLabel} on {new Date(settlement.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={cn(
                                  "flex items-center gap-1.5",
                                  isNight 
                                    ? "border-white/20 bg-white/10 text-slate-200" 
                                    : "border-slate-200 text-slate-600"
                                )}>
                                  <MethodIcon className="h-3 w-3" />
                                  {methodLabel}
                                </Badge>
                                <Badge variant="outline" className={cn(
                                  isNight 
                                    ? settlement.status === "pending"
                                      ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                                      : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                                    : statusBadgeClass
                                )}>
                                  {statusLabel}
                                </Badge>
                              </div>
                            </div>
                            {note ? (
                              <div className={cn(
                                "rounded-lg border-l-2 pl-3 py-1.5",
                                isNight 
                                  ? "border-white/20 bg-white/5" 
                                  : "border-slate-200 bg-slate-50"
                              )}>
                                <p className={cn("text-xs italic", isNight ? "text-slate-300" : "text-slate-600")}>&quot;{note}&quot;</p>
                              </div>
                            ) : null}
                            {isPending ? (
                              <div className="flex justify-end pt-1">
                                {isPayee ? (
                                  <Button
                                    size="sm"
                                    className={cn(
                                      "transition-all duration-200",
                                      isNight 
                                        ? "bg-emerald-500/90 text-slate-900 hover:bg-emerald-400 border-transparent hover:scale-105" 
                                        : "bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105"
                                    )}
                                    onClick={() => {
                                      void onConfirmSettlement(settlement);
                                    }}
                                  >
                                    Mark as received
                                  </Button>
                                ) : (
                                  <span className={cn("text-xs flex items-center gap-1.5", isNight ? "text-slate-300" : "text-slate-500")}>
                                    <Clock className="h-3 w-3" />
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
                </div>
                <div className="space-y-4">
                  <div className={cn("rounded-2xl border p-4 shadow-sm", isNight ? "border-white/15 bg-slate-800/60 shadow-slate-900/50" : "border-slate-200 bg-white")}>
                    <div className="flex items-center justify-between">
                      <h4 className={cn("text-sm font-semibold", isNight ? "text-white" : "text-slate-900")}>
                        Balances after confirmed settlements
                      </h4>
                      <Badge variant="secondary" className={cn(
                        "text-xs uppercase tracking-wide flex items-center gap-1.5 animate-pulse",
                        isNight 
                          ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30" 
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      )}>
                        <Sparkles className="h-3 w-3" />
                        Live
                      </Badge>
                    </div>
                    {settlements.length === 0 ? (
                      <div className="mt-4 text-center">
                        <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-500")}>
                          No settlements have been recorded yet.
                        </p>
                      </div>
                    ) : openBalanceEntries.length ? (
                      <div className="mt-4 space-y-2.5">
                        {openBalanceEntries.map(([id, bal]) => {
                          const name = membersMapById[id]?.firstName ?? id;
                          const positive = bal >= 0;
                          return (
                            <div 
                              key={id} 
                              className={cn(
                                "flex items-center justify-between text-sm px-2 py-1.5 rounded-lg transition-colors",
                                isNight 
                                  ? positive ? "bg-emerald-500/5" : "bg-rose-500/5"
                                  : positive ? "bg-emerald-50/50" : "bg-rose-50/50"
                              )}
                            >
                              <span className={cn("font-medium", isNight ? "text-slate-200" : "text-slate-700")}>{name}</span>
                              <span className={cn("font-bold text-base", positive 
                                ? isNight ? "text-emerald-200" : "text-emerald-600"
                                : isNight ? "text-rose-200" : "text-rose-600"
                              )}>
                                {formatMoney(bal, currency)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 text-center">
                        <p className={cn("text-sm font-medium", isNight ? "text-emerald-200" : "text-emerald-600")}>
                          Everyone is square for now.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className={cn("rounded-2xl border p-4", isNight ? "border-white/15 bg-slate-800/40" : "border-slate-200 bg-slate-50/70")}>
                    <div className="flex items-center justify-between">
                      <h4 className={cn("text-sm font-semibold", isNight ? "text-white" : "text-slate-900")}>
                        {settlements.length > 0 ? "Balances before settlements" : "Current balances"}
                      </h4>
                      <Badge variant="outline" className={cn("text-xs", isNight ? "border-white/20 bg-white/10 text-slate-200" : "border-slate-200 text-slate-600")}>
                        Snapshot
                      </Badge>
                    </div>
                    {originalBalanceEntries.length ? (
                      <div className="mt-4 space-y-2.5">
                        {originalBalanceEntries.map(([id, bal]) => {
                          const name = membersMapById[id]?.firstName ?? id;
                          const positive = bal >= 0;
                          return (
                            <div 
                              key={id} 
                              className={cn(
                                "flex items-center justify-between text-sm px-2 py-1.5 rounded-lg transition-colors",
                                isNight 
                                  ? positive ? "bg-emerald-500/5" : "bg-rose-500/5"
                                  : positive ? "bg-emerald-50/50" : "bg-rose-50/50"
                              )}
                            >
                              <span className={cn("font-medium", isNight ? "text-slate-200" : "text-slate-700")}>{name}</span>
                              <span className={cn("font-bold text-base", positive 
                                ? isNight ? "text-emerald-200" : "text-emerald-600"
                                : isNight ? "text-rose-200" : "text-rose-600"
                              )}>
                                {formatMoney(bal, currency)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 text-center">
                        <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-500")}>No balances to show just yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3️⃣ Back / Save buttons */}
        {isIdleState && (
          <div className="flex justify-end mt-6">
            <Button size="sm" className={cn(isNight ? "bg-indigo-500/90 text-slate-900 hover:bg-indigo-400 border-transparent" : "bg-slate-900 hover:bg-slate-800 text-white")} onClick={onBack}>
              Back To Group Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
