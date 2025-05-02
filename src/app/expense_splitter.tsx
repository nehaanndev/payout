"use client";

import React, { act, useEffect, useState } from 'react';
import { getUserGroups, addExpense, getExpenses, createGroup, updateGroupMembers, fetchGroupById, getUserGroupsById } from "@/lib/firebaseUtils";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Users, Edit2, DollarSign, Save, Share2, Clipboard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Group, Expense, Member } from '@/types/group';
import { User } from "firebase/auth";
import { Switch } from "@/components/ui/switch";
import IdentityPrompt from "@/components/IdentityPrompt";
import { generateUserId } from '@/lib/userUtils';
import Summary from '@/components/Summary';
import ExpensesPanel from '@/components/ExpensesPanel';
import GroupDetailsForm from '@/components/GroupDetailsForm';


interface ExpenseSplitterProps {
  session: User | null;
  groupid: string | null;
  anonUser: Member | null | undefined;
}

export default function ExpenseSplitter({ session, groupid, anonUser }: ExpenseSplitterProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'groups' | 'create'>('summary');
  const [savedGroups, setSavedGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [newMemberFirstName, setNewMemberFirstName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splitMode, setSplitMode] = useState<'percentage' | 'weight'>('percentage');
  const [weightSplits, setWeightSplits] = useState<Record<string, number>>({});
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Expense>({
    id: '',
    description: '',
    amount: 0,
    paidBy: '',
    splits: {},
    createdAt: new Date()
  } as Expense);

  const [isEditingExpense, setIsEditingExpense] = useState(false);
  const [showAccessError, setShowAccessError] = useState(false);
  // at the top of ExpenseSplitter(), after your other useStates:
const [wizardStep, setWizardStep] = useState<'details' | 'expenses'>('details');


  useEffect(() => {
    const fetchGroups = async () => {
      if (session || anonUser) {
        // if the session exists, get the accessToken property
        let userGroups: Group[] = [];
        if (session) {
          userGroups = await getUserGroups(session.email!) as Group[];
        }
        else if (anonUser) {
          userGroups = await getUserGroupsById(anonUser.id) as Group[];
        }
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
            setActiveGroup(loadedGroup);
            setGroupName(loadedGroup.name);
            setMembers(loadedGroup.members);
            // fetch exoenses from Firebase
            loadedGroup.expenses = await getExpenses(loadedGroup.id);
            setExpenses(loadedGroup.expenses);
          }
          else {
            console.log("Group not found");
            setShowAccessError(true);   // 👉 trigger dialog
          }
        }
      }
      setLoading(false);
    };
    fetchGroups();
  }, [session, anonUser, groupid]);

  if (loading) {
    return <p>Loading groups...</p>;
  }

  // Early guard for either signed-in user or anonymous user and bail out if neither is present
  if (!session && !anonUser) {
    throw new Error("Anonymous user must be provided when not signed in");
  }

  const currentUserId = (session ? session.uid : anonUser!.id) as string
  //const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  const saveGroup = async () => {
    if (!groupName.trim() || members.length === 0) {
      alert('Please enter a group name and add at least one member');
      return;
    }

    const formattedMembers = members.map((member) => ({
      email: member.email,
      firstName: member.firstName || "Unknown",  // Include first name with fallback
      id: member.id,
      authProvider: member.authProvider || (session ? 'google' : 'anon')
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
      const newGroup: Group = {
        id: "placeholder_group_id",
        name: groupName,
        members: [...members],
        expenses: [...expenses],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        createdBy: currentUserId,
      };
      console.log(newGroup)
      // save new group to Firebase
      let newGroupId = await createGroup(groupName, session?.email ?? '', members);
      newGroup.id = newGroupId;
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
    setActiveGroupId('');
    setActiveGroup(null);
  };

  const loadGroup = async (group: Group) => {
    setActiveGroupId(group.id);
    setActiveGroup(group);
    setGroupName(group.name);
    setMembers(group.members);

    let matchedMember = group.members.find((m) => m.id === currentUserId);
    if (matchedMember) {
      setCurrentUser(matchedMember);
    } else {
      setShowIdentityPrompt(true);
    }

    group.expenses = await getExpenses(group.id);
    setExpenses(group.expenses);
    setActiveTab("create");
  };

  const startNewGroup = () => {
    clearGroupForm();
    setActiveTab('create');
  };

  const addMember = () => {
    const trimmedFirstName = newMemberFirstName.trim();
    const trimmedEmail = newMemberEmail?.trim() || undefined;
    if (trimmedFirstName) {
      // Check if the name or email already exists
      const isDuplicate = (members.some((m) => (m.email && (m.email === trimmedEmail))) || (members.some((m) => m.firstName === trimmedFirstName)));

      if (!isDuplicate) {
        // Add logic to set the authProvider based on the session and user name
        if (session && session?.displayName?.startsWith(trimmedFirstName)) {
          setMembers([
            ...members,
            {
              id: currentUserId,
              firstName: trimmedFirstName,
              email: trimmedEmail,
              authProvider: 'google'
            }
          ]);
        } else if(anonUser && anonUser?.firstName ==trimmedFirstName) {
          setMembers([
            ...members,
            {
              id: currentUserId,
              firstName: trimmedFirstName,
              email: trimmedEmail,
              authProvider: 'anon'
            }
          ]);
        }
         else {
          setMembers([
            ...members,
            {
              id: generateUserId(),
              firstName: trimmedFirstName,
              email: trimmedEmail,
              authProvider: 'anon'
            }
          ]);
        }

        // Clear the input fields
        setNewMemberFirstName("");
        setNewMemberEmail("");
      } else {
        alert("This member is already added!");
      }
    } else {
      alert("Please enter a valid first name");
    }
  };

  const removeMember = (memberFirstNameToRemove: string) => {
    setMembers(members.filter(member => member.firstName !== memberFirstNameToRemove));
  };
/* ---- */

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
      <Tabs
         value={activeTab}
         onValueChange={(v: string) => setActiveTab(v as 'summary' | 'groups' | 'create')}
         className="space-y-6"
      >

        <TabsList className="w-full">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="create">Create / Edit</TabsTrigger>
        </TabsList>

        {/* ⬇️  NEW TAB BODY  */}
        <TabsContent value="summary">
          <Summary
            groups={savedGroups}
            expensesByGroup={Object.fromEntries(savedGroups.map(g => [g.id, g.expenses]))}
            onSettleClick={(g) => {
              setActiveGroupId(g.id);
              setActiveTab('groups');  // jump to group details if they hit “Settle”
            }}
          />
        </TabsContent>

        <TabsContent value="create">
          {wizardStep === 'details' ? (
            <GroupDetailsForm
              groupName={groupName}
              setGroupName={setGroupName}
              members={members}
              addMember={(f, e) => {/* call your existing addMember logic */}}
              removeMember={removeMember}
              canContinue={!!groupName.trim() && members.length > 0}
              onNext={() => setWizardStep('expenses')}
            />
          ) : (
            <ExpensesPanel
              /* DATA */
              expenses={expenses}
              members={members}
              splitMode={splitMode}
              currentExpense={currentExpense}
              weightSplits={weightSplits}
              isEditingExpense={isEditingExpense}
              showExpenseForm={showExpenseForm}
              /* SETTERS */
              setExpenses={setExpenses}
              setCurrentExpense={setCurrentExpense}
              setWeightSplits={setWeightSplits}
              setSplitMode={setSplitMode}
              setIsEditingExpense={setIsEditingExpense}
              setShowExpenseForm={setShowExpenseForm}
              /* HELPERS */
              membersMapById={Object.fromEntries(members.map(m => [m.id, m]))}
              addExpenseToFirebase={(exp) =>
                addExpense(activeGroupId, exp.description, exp.amount, exp.paidBy, exp.splits, exp.createdAt)
              }
              activeGroupId={activeGroupId}
              /* WIZARD NAV */
              onBack={() => setWizardStep('details')}
              onSaveGroup={saveGroup}
            />
          )}
        </TabsContent>


        <TabsContent value="groups">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Your Groups</span>
                <Button variant="primaryDark" onClick={startNewGroup}>Create New Group</Button>
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
      {showIdentityPrompt && activeGroup && (
        <IdentityPrompt
          members={members}
          onSelect={(member: Member) => {
            setCurrentUser(member);
            localStorage.setItem('user_id', member.id);
            setShowIdentityPrompt(false);
          }}
        />
      )}
      {showAccessError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Group Access Error
            </h2>
            <p className="mb-6 text-sm text-gray-700">
              You’re currently signed in, but it looks like you’re not a member of
              this group. If you think that’s a mistake, try logging out and opening
              the link again (you’ll be able to choose the correct identity).
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAccessError(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Close
              </button>
              {/* Optional: sign‑out button for convenience */}
              {/*
              <button
                onClick={() => {
                  await signOut();   // if you use next-auth
                  setShowAccessError(false);
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Log Out
              </button>*/
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
