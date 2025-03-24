"use client";

import React, {useEffect, useState } from 'react';
import { getUserGroups, addExpense, getExpenses, createGroup, modifyGroupMembers} from "@/lib/firebaseUtils";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Users, DollarSign, Save } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Group, Expense, Member } from '@/types/group';
import { User } from "firebase/auth";

interface ExpenseSplitterProps {
  session: User | null;
}

export default function ExpenseSplitter({ session }: ExpenseSplitterProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('create');
  const [savedGroups, setSavedGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [newMemberFirstName, setNewMemberFirstName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
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

  useEffect(() => {
    const fetchGroups = async () => {
      if (session) {
        // if the session exists, get the accessToken property
        console.log(session.email);
        const userGroups = await getUserGroups(session.email!) as Group[];
        const formattedGroups: Group[] = userGroups.map((group: Group) => ({
          ...group,
          name: group.name || '',
          members: group.members || [],
          expenses: group.expenses || [],
          createdAt: group.createdAt,
          lastUpdated: group.lastUpdated
        }));
        setSavedGroups(formattedGroups);
      }
      setLoading(false);
    };
    fetchGroups();
  }, [session]);
  
  if (loading) {
    return <p>Loading groups...</p>;
  }

  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  const saveGroup = async () => {
    if (!groupName.trim() || members.length === 0) {
      alert('Please enter a group name and add at least one member');
      return;
    }

    const formattedMembers = members.map((member) => ({
      email: member.email,
      firstName: member.firstName || "Unknown"  // Include first name with fallback
    }));

    if (activeGroupId) {
      // TODO: Save the existing group to Firebase
      await modifyGroupMembers(activeGroupId, formattedMembers, []);
      setSavedGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === activeGroupId
            ? {
                ...group,
                name: groupName,
                members: [...formattedMembers],
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
        lastUpdated: new Date().toISOString(),
        createdBy: session?.email ?? ''
      };
      // save new group to Firebase
      await createGroup(groupName, session?.email ?? '', members);
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

  const loadGroup = async (group : Group) => {
    setActiveGroupId(group.id);
    setGroupName(group.name);
    setMembers(group.members);
    // fetch exoenses from Firebase
    group.expenses = await getExpenses(group.id);
    setExpenses(group.expenses);
    setActiveTab('create');
  };

  const startNewGroup = () => {
    clearGroupForm();
    setActiveTab('create');
  };

  const addMember = () => {
    const trimmedFirstName = newMemberFirstName.trim();
    const trimmedEmail = newMemberEmail.trim();
  
    if (trimmedFirstName && trimmedEmail) {
      // Check if the email already exists
      const isDuplicate = members.some((m) => m.email === trimmedEmail);
  
      if (!isDuplicate) {
        // Add the new member as an object with first name and email
        setMembers([
          ...members,
          { firstName: trimmedFirstName, email: trimmedEmail }
        ]);
        
        // Clear the input fields
        setNewMemberFirstName("");
        setNewMemberEmail("");
      } else {
        alert("This email is already added!");
      }
    }
  };

  const removeMember = (memberEmailToRemove: string) => {
    setMembers(members.filter(member => member.email !== memberEmailToRemove));
  };

  const handleExpenseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      createdAt: new Date().toISOString(),
      splits: members.reduce<Record<string, number>>((acc, member) => {
        acc[member.email] = currentExpense.splits[member.email] || 0;
        return acc;
      }, {})
    };

    // save to Firebase
    await addExpense(
      activeGroupId ? activeGroupId : generateId(),
      newExpense.description,
      newExpense.amount,
      newExpense.paidBy,
      newExpense.splits
    );

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
      balances[member.email] = 0;
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
      acc[member.email] = parseFloat(equalSplit);
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
                
                <div className="flex gap-2 items-center">
                  <Input
                    value={newMemberFirstName}
                    onChange={(e) => setNewMemberFirstName(e.target.value)}
                    placeholder="First Name"
                    onKeyPress={(e) => e.key === 'Enter' && addMember()}
                    className="flex-1"
                  />
                  <Input
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="Email"
                    onKeyPress={(e) => e.key === 'Enter' && addMember()}
                    className="flex-1"
                  />
                  <Button onClick={addMember} className="p-2">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>


                <div className="flex flex-wrap gap-2">
                  {members.map(member => (
                    <div key={member.email} className="flex items-center gap-2 bg-slate-100 p-2 rounded">
                      {member.firstName}
                      <button onClick={() => removeMember(member.firstName)} className="text-red-500">
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
                        <option key={member.email} value={member.firstName}>{member.firstName}</option>
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
                        <div key={member.firstName} className="flex items-center gap-2">
                          <span className="w-24">{member.firstName}</span>
                          <Input
                            type="number"
                            value={currentExpense.splits[member.email] || ''}
                            onChange={(e) => updateSplit(member.email, e.target.value)}
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
                      Paid by: {expense.paidBy} • {new Date(expense.createdAt).toLocaleDateString()}
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
                        {group.members.length} members
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
