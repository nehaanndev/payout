import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
  } from '@/components/ui/card';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Switch } from "@/components/ui/switch";
  import { DollarSign, Edit2, Trash2 } from 'lucide-react';
  import { Expense, Member } from '@/types/group';
  import { getUserGroups, addExpense, getExpenses, createGroup, updateGroupMembers, fetchGroupById, getUserGroupsById } from "@/lib/firebaseUtils";
  import { useState } from 'react';

  export interface ExpensesPanelProps {
    /* Data */
    expenses: Expense[];
    members: Member[];
    splitMode: 'percentage' | 'weight';
    currentExpense: Expense;
    weightSplits: Record<string, number>;
    isEditingExpense: boolean;
    showExpenseForm: boolean;
  
    /* Callbacks to mutate parent state */
    setExpenses: (e: Expense[]) => void;
    setCurrentExpense: (e: Expense) => void;
    setWeightSplits: (w: Record<string, number>) => void;
    setSplitMode: (m: 'percentage' | 'weight') => void;
    setIsEditingExpense: (b: boolean) => void;
    setShowExpenseForm: (b: boolean) => void;
  
    /* External helpers from parent */
    membersMapById: Record<string, Member>;      // computed once in parent for easy lookup
    addExpenseToFirebase: (exp: Omit<Expense, 'id'>) => Promise<string>; // wrapper around addExpense()
    activeGroupId: string;
    onBack: () => void;      // wizard ←
    onSaveGroup: () => void; // final “Save Group”
  }
  

  export default function ExpensesPanel({
    /* DATA */
    expenses,
    members,
    splitMode,
    currentExpense,
    weightSplits,
    isEditingExpense,
    showExpenseForm,
    /* MUTATORS */
    setExpenses,
    setCurrentExpense,
    setWeightSplits,
    setSplitMode,
    setIsEditingExpense,
    setShowExpenseForm,
    /* HELPERS */
    membersMapById,
    addExpenseToFirebase,
    activeGroupId,
    /* WIZARD NAV */
    onBack,
    onSaveGroup,
  }: ExpensesPanelProps) {

  const editExpense = (expenseId: string) => {
    setIsEditingExpense(true);
    const expenseToEdit = expenses.find(expense => expense.id === expenseId);
    if (expenseToEdit) {
      setCurrentExpense({
        ...expenseToEdit,
        amount: expenseToEdit.amount // Convert back to string for form input
      });
      setShowExpenseForm(true);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!currentExpense.description || !currentExpense.amount || !currentExpense.paidBy || !currentExpense.createdAt) {
      alert('Please fill in all expense details');
      return;
    }

    if (!activeGroupId) {
      alert("Please create a group first to add expenses")
    }

    let computedSplits = { ...currentExpense.splits };

    if (splitMode === 'weight') {
      const totalWeight = Object.values(weightSplits).reduce((sum, w) => sum + w, 0);
      if (totalWeight === 0) {
        alert("Total weight must be greater than 0");
        return;
      }
      computedSplits = Object.fromEntries(
        Object.entries(weightSplits).map(([email, weight]) => [
          email,
          (weight / totalWeight) * 100,
        ])
      );
    } else {
      const totalSplit = Object.values(computedSplits).reduce((sum: number, val: unknown) => sum + (typeof val === "number" ? val : parseFloat(val as string) || 0), 0);
      if (Math.abs(totalSplit - 100) > 0.01) {
        alert('Split percentages must sum to 100%');
        return;
      }
    }


    let updatedExpenses: Expense[] = [];
    if (isEditingExpense) {
      // Update existing expense
      updatedExpenses = expenses.map(expense =>
        expense.id === currentExpense.id
          ? {
            ...currentExpense,
            id: currentExpense.id,
            description: currentExpense.description,
            paidBy: currentExpense.paidBy,
            amount: currentExpense.amount,
            createdAt: currentExpense.createdAt ? currentExpense.createdAt : new Date(),
            splits: members.reduce<Record<string, number>>((acc, member) => {
              acc[member.id] = computedSplits[member.id] || 0;
              return acc;
            }, {})
          }
          : expense
      );
    } else {

      console.log("Current Expense:", currentExpense);
      const newExpense = {
        ...currentExpense,
        id: "placeholder_expense_id",
        amount: currentExpense.amount,
        createdAt: currentExpense.createdAt ? currentExpense.createdAt : new Date(),
        splits: members.reduce<Record<string, number>>((acc, member) => {
          acc[member.id] = computedSplits[member.id] || 0;
          return acc;
        }, {})
      };

      // save to Firebase
      let newExpenseId = await addExpense(
        activeGroupId,
        newExpense.description,
        newExpense.amount,
        newExpense.paidBy,
        newExpense.splits,
        newExpense.createdAt
      );
      newExpense.id = newExpenseId;
      updatedExpenses = [...expenses, newExpense];
    }
    if (updatedExpenses) {
      setExpenses(updatedExpenses);
    }

    /* if (activeGroupId) {
      setSavedGroups(prevGroups =>
        prevGroups.map(group =>
          group.id === activeGroupId
            ? {
              ...group,
              expenses: updatedExpenses,
              lastUpdated: new Date().toISOString()
            }
            : group
        )
      );
    } */

      clearExpenseForm();
  };


    // new local helper
  const clearExpenseForm = () => {
        setShowExpenseForm(false);
        setIsEditingExpense(false);
        setCurrentExpense({
            id: '',
            description: '',
            amount: 0,
            paidBy: '',
            splits: {},
            createdAt: new Date(),
        });
        };

  const deleteExpense = (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      const updatedExpenses = expenses.filter(expense => expense.id !== expenseId);
      setExpenses(updatedExpenses);

      /*if (activeGroupId) {
        setSavedGroups(prevGroups =>
          prevGroups.map(group =>
            group.id === activeGroupId
              ? {
                ...group,
                expenses: updatedExpenses,
                lastUpdated: new Date().toISOString()
              }
              : group
          )
        );
      }*/
    }
  };

  const calculateBalances = () => {
    // 1. start everyone at zero
    const balances: Record<string, number> = {};
    members.forEach(m => {
      balances[m.id] = 0;
    });
  
    expenses.forEach(exp => {
      // 2. resolve who paid
      const payerMember = members.find(m => m.firstName === exp.paidBy);
      const payerId = payerMember?.id ?? exp.paidBy;
  
      // ensure the payerId key exists
      if (!(payerId in balances)) balances[payerId] = 0;
  
      // credit the payer
      balances[payerId] += exp.amount;
  
      // 3. debit each split
      Object.entries(exp.splits).forEach(([memberId, pct]) => {
        if (!(memberId in balances)) balances[memberId] = 0;
        balances[memberId] -= (exp.amount * pct) / 100;
      });
    });
  
    return balances;
  };
  

  const updateSplit = (member: string, value: string) => {
    const pct = parseFloat(value) || 0;
    setCurrentExpense({
      ...currentExpense,
      splits: {
        ...currentExpense.splits,
        [member]: pct,
      },
    });
  };
  

  const splitEqually = () => {
    const equalPct = Number((100 / members.length).toFixed(2));
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
        <Card>
        <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Expenses
        </CardTitle>
        </CardHeader>
        <CardContent>
        {!showExpenseForm ? (
            <Button
            variant="primaryDark"
            className="w-full"
            disabled={!activeGroupId}
            onClick={() => setShowExpenseForm(true)}
            title={!activeGroupId ? "Select or create a group first" : undefined}
            >
            Add Expense
            </Button>
        ) : (
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
                value={currentExpense.amount}
                onChange={(e) => {
                    const value = e.target.value;
                    setCurrentExpense({
                    ...currentExpense,
                    amount: value === '' ? 0 : parseFloat(value) || 0
                    });
                }}
                placeholder="0.00"
                className="mt-1"
                required
                />
            </div>

            <div>
                <Label htmlFor="paidBy">Paid By</Label>
                <select
                id="paidBy"
                value={currentExpense.paidBy}
                onChange={(e) => setCurrentExpense({ ...currentExpense, paidBy: e.target.value })}
                className="w-full mt-1 rounded-md border border-gray-300 p-2"
                required
                >
                <option value="">Select person</option>
                {members.map(member => (
                    <option key={member.firstName} value={member.firstName}>{member.firstName}</option>
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
                            value={currentExpense.splits[member.id] || ''}
                            onChange={(e) => updateSplit(member.id, e.target.value)}
                            placeholder="0"
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

            <div className="flex gap-2">
                <Button variant="primaryDark" type="submit">Save Expense</Button>
                <Button
                type="button"
                variant="outline"
                onClick={() => clearExpenseForm()}
                >
                Cancel
                </Button>
            </div>
            </form>
        )}

        <div className="mt-6 space-y-4">
            {expenses.map(expense => (
            <div key={expense.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                <h3 className="font-medium">{expense.description}</h3>
                <span className="font-bold">${expense.amount.toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-600">
                Paid by: {expense.paidBy} • {new Date(expense.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-2">
                {Object.entries(expense.splits).map(([id, pct]) => (
                    <div key={id} className="text-sm">
                    {membersMapById[id]?.firstName ?? id}: {pct}%
                    </div>
                ))}
                </div>

                <div className="mt-3 flex gap-2 justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editExpense(expense.id)}
                    className="flex items-center gap-1"
                >
                    <Edit2 className="h-4 w-4" />
                    Edit
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteExpense(expense.id)}
                    className="flex items-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                    <Trash2 className="h-4 w-4" />
                    Delete
                </Button>
                </div>
            </div>
            ))}
        </div>

        {expenses.length > 0 && (
            <div className="mt-6">
                <h3 className="font-medium mb-2">Current Balances</h3>
                {Object.entries(calculateBalances()).map(([id, bal]) => {
                // lookup via the map
                const member = membersMapById[id];
                const displayName = member?.firstName ?? id;
                return (
                    <div key={id} className="flex justify-between">
                    <span>{displayName}</span>
                    <span className={bal >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ${bal.toFixed(2)}
                    </span>
                    </div>
                );
                })}
            </div>
        )}

        </CardContent>
        </Card>
  );
}
/*
<div className="flex gap-2 justify-end mt-6">
  <Button variant="outline" onClick={onBack}>Back</Button>
  <Button variant="primaryDark" onClick={onSaveGroup}>Save Group</Button>
</div>
*/