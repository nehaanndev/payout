"use client";

import React, {act, useEffect, useState } from 'react';
import { getUserGroups, addExpense, getExpenses, createGroup, updateGroupMembers, fetchGroupById} from "@/lib/firebaseUtils";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Users, Edit2, DollarSign, Save, Share2, Clipboard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Group, Expense, Member } from '@/types/group';
import { User } from "firebase/auth";

interface ExpenseSplitterProps {
  session: User | null;
  groupid: string | null;
}

export default function ExpenseSplitter({ session, groupid }: ExpenseSplitterProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('create');
  const [savedGroups, setSavedGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup ] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [newMemberFirstName, setNewMemberFirstName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Expense>({
    id: '',
    description: '',
    amount: 0,
    paidBy: '',
    splits: {},
    createdAt: new Date()
  } as Expense);

  const [isEditingExpense, setIsEditingExpense] = useState(false);

  useEffect(() => {
    const fetchGroups = async () => {
      if (session) {
        // if the session exists, get the accessToken property
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
        if (groupid) {
          console.log("Group ID:", groupid);
          const loadedGroup = formattedGroups.find(group => group.id === groupid);
          console.log("Loaded Group:", loadedGroup);
          if (loadedGroup) {
            setActiveGroupId(groupid);
            setActiveGroup(activeGroup);
            setGroupName(loadedGroup.name);
            setMembers(loadedGroup.members);
            // fetch exoenses from Firebase
            loadedGroup.expenses = await getExpenses(loadedGroup.id);
            setExpenses(loadedGroup.expenses);
          }
        }
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
      await updateGroupMembers(activeGroupId, members);
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
      setActiveGroup(newGroup);
    }
    alert(`Group "${groupName}" has been saved!`);
  };

  const clearcurrentExpenseAndForm = () => {
    setShowExpenseForm(false);
    clearcurrentExpense();
    setIsEditingExpense(false);
  } 

  const clearcurrentExpense = () => {
    setCurrentExpense({
      id: '',
      description: '',
      amount: 0,
      paidBy: '',
      splits: {},
      createdAt: new Date()
    } as Expense);
  }

  const clearGroupForm = () => {
    setGroupName('');
    setMembers([]);
    setExpenses([]);
    setShowExpenseForm(false);
    clearcurrentExpense();
    setActiveGroupId(null);
    setActiveGroup(null);
  };

  const loadGroup = async (group : Group) => {
    setActiveGroupId(group.id);
    setActiveGroup(group);
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


  const editExpense = (expenseId : string) => {
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
    
    const totalSplit = Object.values(currentExpense.splits).reduce((sum: number, val: unknown) => sum + (typeof val === "number" ? val : parseFloat(val as string) || 0), 0);
    if (Math.abs(totalSplit - 100) > 0.01) {
      alert('Split percentages must sum to 100%');
      return;
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
                acc[member.email] = currentExpense.splits[member.email] || 0;
                return acc;
              }, {}) 
            }
          : expense
      );
    } else {

      console.log("Current Expense:", currentExpense);
      const newExpense = {
        ...currentExpense,
        id: generateId(),
        amount: currentExpense.amount,
        createdAt: currentExpense.createdAt ? currentExpense.createdAt : new Date(),
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
        newExpense.splits,
        newExpense.createdAt
      );

       updatedExpenses = [...expenses, newExpense];
    }
    if (updatedExpenses) {
      setExpenses(updatedExpenses);
    }

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

    clearcurrentExpenseAndForm();
  };


  const deleteExpense = (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      const updatedExpenses = expenses.filter(expense => expense.id !== expenseId);
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
    }
  };

  const calculateBalances = () => {
    const balances: Record<string, number> = {};
    members.forEach(member => {
      balances[member.email] = 0;
    });
    expenses.forEach(expense => {
      const paidByEmail = activeGroup?.members?.find((m) => m.firstName === expense.paidBy)?.email;
      if (paidByEmail) {
        balances[paidByEmail] += expense.amount;
      }
      Object.entries(expense.splits).forEach(([memberEmail, percentage]) => {
        balances[memberEmail] -= (expense.amount * percentage) / 100;
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
  // link sharing

  const getGroupShareLink = (groupId: string) => {
    return `${window.location.origin}?group_id=${groupId}`;
  };

  const handleShareGroup = (groupId: string) => {
    const link = getGroupShareLink(groupId);
    navigator.clipboard.writeText(link);
    alert("Group link copied to clipboard!");
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
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleShareGroup(activeGroupId)}
                        className="flex items-center gap-2"
                      >
                        <Share2 className="h-4 w-4" />
                        Share Group
                      </Button>

                      <Button variant="outline" onClick={startNewGroup}>
                        Create New Group
                      </Button>
                    </>
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
                      <button onClick={() => removeMember(member.email)} className="text-red-500">
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
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={currentExpense.createdAt ? new Date(currentExpense.createdAt).toISOString().split('T')[0] : ''}
                      onChange={(e) => setCurrentExpense({...currentExpense, createdAt: new Date(e.target.value)})}
                      className="mt-1"
                      required
                    />
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
                      onClick={() => clearcurrentExpenseAndForm()}
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
                      {Object.entries(expense.splits).map(([memberEmail, percentage]) => {
                      // Find the corresponding member in the group by matching the email
                      const member = activeGroup?.members?.find((m) => m.email === memberEmail);
                      return (
                        <div key={memberEmail} className="text-sm">
                          {member ? member.firstName : memberEmail}: {percentage}%
                        </div>
                       );
                      })}
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
                  {Object.entries(calculateBalances()).map(([memberEmail, balance]) => {
                    const numericBalance = balance as number; // Ensure balance is a number
                    // Find the corresponding member in the group by matching the email
                    const member = activeGroup?.members?.find((m) => m.email === memberEmail);
                    return (
                      <div key={memberEmail} className="flex justify-between">
                        <span>{member ? member.firstName : memberEmail}</span>
                        <span className={numericBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ${numericBalance.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
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
                    className="p-4 border rounded-lg flex justify-between items-center hover:bg-slate-50"
                  >
                    <div onClick={() => loadGroup(group)} className="cursor-pointer flex-1">
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
                  
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShareGroup(group.id)}
                      className="ml-4"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
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
