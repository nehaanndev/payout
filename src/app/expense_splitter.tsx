"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Users, DollarSign, Save } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Group, Expense } from '@/types/group';



const ExpenseSplitter = () => {
  const [activeTab, setActiveTab] = useState('create');
  const [savedGroups, setSavedGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<{
    description: string;
    amount: string;
    paidBy: string;
    splits: Record<string, number>;
  }>({
    description: '',
    amount: '',
    paidBy: '',
    splits: {}
  });

  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  const saveGroup = () => {
    if (!groupName.trim() || members.length === 0) {
      alert('Please enter a group name and add at least one member');
      return;
    }

    if (activeGroupId) {
      setSavedGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === activeGroupId
            ? {
                ...group,
                name: groupName,
                members: [...members],
                expenses: [...expenses],
                lastUpdated: new Date().toISOString()
              }
            : group
        )
      );
    } else {
      const newGroup = {
        id: generateId(),
        name: groupName,
        members: [...members],
        expenses: [...expenses],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      setSavedGroups(prev => [...prev, newGroup]);
      setActiveGroupId(newGroup.id);
    }
    alert(`Group "${groupName}" has been saved!`);
  };

  const clearGroupForm = () => {
    setGroupName('');
    setMembers([]);
    setExpenses([]);
    setShowExpenseForm(false);
    setCurrentExpense({
      description: '',
      amount: '',
      paidBy: '',
      splits: {}
    });
    setActiveGroupId(null);
  };

  const loadGroup = (group : Group) => {
    setActiveGroupId(group.id);
    setGroupName(group.name);
    setMembers(group.members);
    setExpenses(group.expenses);
    setActiveTab('create');
  };

  const startNewGroup = () => {
    clearGroupForm();
    setActiveTab('create');
  };

  const addMember = () => {
    if (newMember.trim() && !members.includes(newMember.trim())) {
      setMembers([...members, newMember.trim()]);
      setNewMember('');
    }
  };

  const removeMember = (memberToRemove: string) => {
    setMembers(members.filter(member => member !== memberToRemove));
  };

  const handleExpenseSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!currentExpense.description || !currentExpense.amount || !currentExpense.paidBy) {
      alert('Please fill in all expense details');
      return;
    }
    
    const totalSplit = Object.values(currentExpense.splits).reduce((sum: number, val: unknown) => sum + (typeof val === "number" ? val : parseFloat(val as string) || 0), 0);
    if (Math.abs(totalSplit - 100) > 0.01) {
      alert('Split percentages must sum to 100%');
      return;
    }

    const newExpense = {
      ...currentExpense,
      id: generateId(),
      amount: parseFloat(currentExpense.amount),
      date: new Date().toISOString(),
      splits: members.reduce<Record<string, number>>((acc, member) => {
        acc[member] = currentExpense.splits[member] || 0;
        return acc;
      }, {})
    };

    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);

    if (activeGroupId) {
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
    }

    setCurrentExpense({
      description: '',
      amount: '',
      paidBy: '',
      splits: {}
    });
    setShowExpenseForm(false);
  };

  const calculateBalances = () => {
    const balances: Record<string, number> = {};
    members.forEach(member => {
      balances[member] = 0;
    });

    expenses.forEach(expense => {
      balances[expense.paidBy] += expense.amount;
      Object.entries(expense.splits).forEach(([member, percentage]) => {
        balances[member] -= (expense.amount * percentage) / 100;
      });
    });

    return balances;
  };

  const updateSplit = (member: string, value: string) => {
    setCurrentExpense(prev => ({
      ...prev,
      splits: {
        ...prev.splits,
        [member]: parseFloat(value) || 0
      }
    }));
  };

  const splitEqually = () => {
    const equalSplit = (100 / members.length).toFixed(2);
    const newSplits = members.reduce<Record<string, number>>((acc, member) => {
      acc[member] = parseFloat(equalSplit);
      return acc;
    }, {});
    setCurrentExpense(prev => ({
      ...prev,
      splits: newSplits
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full">
          <TabsTrigger value="create">Create/Edit Group</TabsTrigger>
          <TabsTrigger value="view">View Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-6 w-6" />
                  {activeGroupId ? 'Edit Group' : 'Create New Group'}
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveGroup} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {activeGroupId ? 'Update Group' : 'Save Group'}
                  </Button>
                  {activeGroupId && (
                    <Button variant="outline" onClick={startNewGroup}>
                      Create New Group
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="groupName">Group Name</Label>
                  <Input
                    id="groupName"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name"
                    className="mt-1"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Input
                    value={newMember}
                    onChange={(e) => setNewMember(e.target.value)}
                    placeholder="Add member name"
                    onKeyPress={(e) => e.key === 'Enter' && addMember()}
                  />
                  <Button onClick={addMember}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {members.map(member => (
                    <div key={member} className="flex items-center gap-2 bg-slate-100 p-2 rounded">
                      {member}
                      <button onClick={() => removeMember(member)} className="text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-6 w-6" />
                Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!showExpenseForm ? (
                <Button onClick={() => setShowExpenseForm(true)} className="w-full">
                  Add Expense
                </Button>
              ) : (
                <form onSubmit={handleExpenseSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={currentExpense.description}
                      onChange={(e) => setCurrentExpense({...currentExpense, description: e.target.value})}
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
                      onChange={(e) => setCurrentExpense({...currentExpense, amount: e.target.value})}
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
                      onChange={(e) => setCurrentExpense({...currentExpense, paidBy: e.target.value})}
                      className="w-full mt-1 rounded-md border border-gray-300 p-2"
                      required
                    >
                      <option value="">Select person</option>
                      {members.map(member => (
                        <option key={member} value={member}>{member}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
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
                        <div key={member} className="flex items-center gap-2">
                          <span className="w-24">{member}</span>
                          <Input
                            type="number"
                            value={currentExpense.splits[member] || ''}
                            onChange={(e) => updateSplit(member, e.target.value)}
                            placeholder="0"
                            required
                          />
                          <span>%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit">Save Expense</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowExpenseForm(false)}
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
                      Paid by: {expense.paidBy} • {new Date(expense.date).toLocaleDateString()}
                    </p>
                    <div className="mt-2">
                      {Object.entries(expense.splits).map(([member, percentage]) => (
                        <div key={member} className="text-sm">
                          {member}: {percentage}%
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {expenses.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium mb-2">Current Balances</h3>
                  {Object.entries(calculateBalances()).map(([member, balance]) => {
                    const numericBalance = balance as number; // Ensure balance is a number
                    return (<div key={member} className="flex justify-between">
                      <span>{member}</span>
                      <span className={numericBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ${numericBalance.toFixed(2)}
                      </span>
                    </div>
                  )})}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="view">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Your Groups</span>
                <Button onClick={startNewGroup}>Create New Group</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savedGroups.length === 0 ? (
                <p className="text-center text-gray-500">No saved groups yet</p>
              ) : (
                <div className="space-y-4">
                  {savedGroups.map(group => (
                    <div
                      key={group.id}
                      className="p-4 border rounded-lg cursor-pointer hover:bg-slate-50"
                      onClick={() => loadGroup(group)}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">{group.name}</h3>
                        <span className="text-sm text-gray-600">
                          {new Date(group.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {group.members.length} members • {group.expenses.length} expenses
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExpenseSplitter;
