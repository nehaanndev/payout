"use client";

import React, { useEffect, useState } from 'react';
import { getUserGroups, getExpenses, createGroup, updateGroupMembers, getUserGroupsById, getSettlements, addSettlement } from "@/lib/firebaseUtils";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Group, Expense, Member } from '@/types/group';
import { User } from "firebase/auth";
import IdentityPrompt from "@/components/IdentityPrompt";
import { generateUserId } from '@/lib/userUtils';
import Summary from '@/components/Summary';
import ExpensesPanel from '@/components/ExpensesPanel';
import GroupDetailsForm from '@/components/GroupDetailsForm';
import SettlementModal from '@/components/SettlementModal';
import { ReceiptPrefillData } from "@/components/ReceiptUploadPanel";
import { Settlement } from '@/types/settlement';
import { calculateRawBalancesMinor } from '@/lib/financeUtils';
import { CurrencyCode } from '@/lib/currency_core';
import { DEFAULT_CURRENCY, getGroupCurrency } from '@/lib/currency';


interface ExpenseSplitterProps {
  session: User | null;
  groupid: string | null;
  anonUser: Member | null | undefined;
  currency?: CurrencyCode;
}

export default function ExpenseSplitter({ session, groupid, anonUser, currency: initialCurrency }: ExpenseSplitterProps) {
const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState<'summary' | 'groups' | 'create'>('summary');
  // only show the Create/Edit tab when the user has clicked “New Group” or loaded an existing one
const [showCreateTab, setShowCreateTab] = useState(false);
const [savedGroups, setSavedGroups] = useState<Group[]>([]);
const [activeGroupId, setActiveGroupId] = useState<string>('');
const [activeGroup, setActiveGroup] = useState<Group | null>(null);
const [groupName, setGroupName] = useState('');
const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency || DEFAULT_CURRENCY)
const [members, setMembers] = useState<Member[]>([]);
const [expenses, setExpenses] = useState<Expense[]>([]);
const [splitMode, setSplitMode] = useState<'percentage' | 'weight'>('percentage');
const [weightSplits, setWeightSplits] = useState<Record<string, number>>({});
const [showExpenseForm, setShowExpenseForm] = useState(false);
const [showReceiptUploader, setShowReceiptUploader] = useState(false);
const [, setCurrentUser] = useState<Member | null>(null);
const [showIdentityPrompt, setShowIdentityPrompt] = useState(false);
const [currentExpense, setCurrentExpense] = useState<Omit<Expense, 'amount'> & { amount: string }>({
  id: '',
  description: '',
  amount: '', // now a string
  paidBy: '',
  splits: {},
  createdAt: new Date(),
  amountMinor: 0,
  splitsMinor: {}
});

const [isEditingExpense, setIsEditingExpense] = useState(false);
const [showAccessError, setShowAccessError] = useState(false);
// at the top of ExpenseSplitter(), after your other useStates:
const [wizardStep, setWizardStep] = useState<'details' | 'expenses'>('details');
const [showSettlementModal, setShowSettlementModal] = useState(false);
const [isMarkSettledMode, setIsMarkSettledMode] = useState(false);
const [settlementGroup, setSettlementGroup] = useState<Group|null>(null);
const [, setSettlements] = useState<Settlement[]>([]);
// ① map of groupId → settlements[]
const [settlementsByGroup, setSettlementsByGroup] = useState<Record<string, Settlement[]>>({});

  // holds the raw balances for the selected group
const [, setSettlementRawBalances] = useState<Record<string,number>>({});

// just your total debt, for a “Pay All” default
const [, setSettlementDefaults] = useState<{ defaultAmount: number }>({
  defaultAmount: 0
});

  const getAuthProviderFromSession = (user: User): Member["authProvider"] => {
    const providerIds = user.providerData
      .map((entry) => entry.providerId)
      .filter((id): id is string => Boolean(id));
    const primaryProvider =
      providerIds[providerIds.length - 1] ??
      providerIds[0] ??
      user.providerId ??
      "";

    switch (primaryProvider) {
      case "microsoft.com":
        return "microsoft";
      case "google.com":
        return "google";
      default:
        return "manual";
    }
  };

  // ② whenever savedGroups changes, fetch each group’s settlements
  useEffect(() => {
    async function loadAllSettlements() {
      const result: Record<string, Settlement[]> = {};
      for (const g of savedGroups) {
        result[g.id] = await getSettlements(g.id);
      }
      setSettlementsByGroup(result);
    }
    if (savedGroups.length) {
      loadAllSettlements();
    }
  }, [savedGroups]);

  useEffect(() => {
    if (settlementGroup) {
      getSettlements(settlementGroup.id).then(setSettlements);
    }
  }, [settlementGroup]);
  
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
        
        // Fetch expenses for all groups to populate the Summary tab correctly
        const formattedGroups: Group[] = await Promise.all(
          userGroups.map(async (group: Group) => {
            const expenses = await getExpenses(group.id);
            return {
              ...group,
              name: group.name || '',
              members: group.members || [],
              expenses: expenses || [],
              createdAt: group.createdAt,
              lastUpdated: group.lastUpdated
            };
          })
        );
        
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
  
  // derive a Member object for “me”:
  let me: Member | null = null;
  if (session) {
    // build “me” from the signed-in user
    me = {
      id: session.uid,
      firstName:
        session.displayName?.split(" ")[0] ??
        (session.email ? session.email.split("@")[0] : "User"),
      email: session.email ?? null,
      authProvider: getAuthProviderFromSession(session),
    };
  } else if (anonUser) {
    // anonUser is already a Member
    me = anonUser;
  }

  const clearcurrentExpense = () => {
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
  }

  const clearGroupForm = () => {
    setGroupName('');
    setMembers([]);
    setExpenses([]);
    setShowExpenseForm(false);
    setShowReceiptUploader(false);
    clearcurrentExpense();
    setActiveGroupId('');
    setActiveGroup(null);
  };

  const handleReceiptPrefill = (data: ReceiptPrefillData) => {
    setShowReceiptUploader(false);
    setShowExpenseForm(true);
    setIsEditingExpense(false);

    const nextSplitMode = data.splitMode ?? "percentage";
    const payerId = data.paidBy ?? me?.id ?? "";

    setCurrentExpense({
      id: "",
      description: data.description ?? "",
      amount: data.amount != null ? data.amount.toString() : "",
      paidBy: payerId,
      splits: nextSplitMode === "percentage" ? data.splits ?? {} : {},
      createdAt: new Date(),
      amountMinor: 0,
      splitsMinor: {},
    });

    setSplitMode(nextSplitMode);
    if (nextSplitMode === "weight") {
      setWeightSplits(data.splits ?? {});
    } else {
      setWeightSplits({});
    }
  };

  const loadGroup = async (group: Group) => {
    setActiveGroupId(group.id);
    setActiveGroup(group);
    setGroupName(group.name);
    setMembers(group.members);
    setShowCreateTab(true);
    setActiveTab('create');
    setWizardStep('expenses');
    setCurrency(getGroupCurrency(group));
    setShowReceiptUploader(false);
    setShowExpenseForm(false);

    const matchedMember = group.members.find((m) => m.id === currentUserId);
    if (matchedMember) {
      setCurrentUser(matchedMember);
    } else {
      setShowIdentityPrompt(true);
    }

    // Expenses are already loaded in the group object from fetchGroups
    setExpenses(group.expenses);
    setActiveTab("create");
  };

  const startNewGroup = () => {
    clearGroupForm();
    setWizardStep('details');
    setShowCreateTab(true);
    setActiveTab('create');
  };

   // replace handleAddMember from earlier:
   const handleAddMember = (firstName: string, email?: string | null) => {
    let name = firstName.trim();
    let mail = email?.trim() || null;
    if (!name) {
      alert("Please enter a valid first name");
      return;
    }
    console.log("Trying to add member:", name, mail);
    // If this matches “me”, force-use my real id/email
    if (me && (name === me.firstName || mail && mail === me.email)) {
      mail = me.email;
      name = me.firstName;
      // always dedupe below, so we don’t add twice
    }

    // duplicate check
    if (members.some(m => m.firstName === name || (mail && m.email === mail))) {
      alert("This member is already added!");
      return;
    }

    const newMember: Member = {
      id: (me && name === me.firstName && mail === me.email)
        ? me.id            // map to my real uid
        : generateUserId(),// otherwise random anon
      firstName: name,
      email: mail,
      authProvider: me && mail === me.email ? me.authProvider : "anon",
    };
    setMembers(prev => [...prev, newMember]);
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

  // open detials tab
  const handleDetailsNext = async () => {
    // 1️⃣ If it’s a brand-new group, call your Firebase helper:
    if (!activeGroupId) {
      const newId = await createGroup(
        groupName,
        session?.email ?? '',
        members,
        currency
      );
      setActiveGroupId(newId);
      // also add the placeholder into savedGroups so the UI can track it
      setSavedGroups(prev => [
        ...prev,
        {
          id: newId,
          name: groupName,
          members,
          expenses: [],
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          createdBy: session ? session.uid : anonUser!.id,
          currency: currency,
        },
      ]);
    } else {
      // 2️⃣ If we’re editing an existing group’s details, just push the member/name changes
      await updateGroupMembers(activeGroupId, members);
      setSavedGroups(prev =>
        prev.map(g =>
          g.id === activeGroupId
            ? { ...g, name: groupName, members, lastUpdated: new Date().toISOString() }
            : g
        )
      );
    }

    // 3️⃣ Move the wizard into the Expenses step
    setWizardStep('expenses');
  };

  // settlement
// 3. Replace the old handleOpenSettle with this:
const handleOpenSettle = (group: Group) => {
  // 1️⃣ compute raw balances so the modal can see who you owe using minor units
  const raw = calculateRawBalancesMinor(group.members, group.expenses, group.currency);

  // 2️⃣ your total debt (sum of all the positives in raw for others)
  const totalOwe = group.members
    .filter(m => m.id !== me!.id)
    .reduce((sum, m) => sum + Math.max(0, raw[m.id] ?? 0), 0);

  setSettlementGroup(group);
  setSettlementRawBalances(raw);
  setSettlementDefaults({ defaultAmount: totalOwe });
  setIsMarkSettledMode(false);
  setShowSettlementModal(true);
};

const handleMarkSettled = (group: Group) => {
  setSettlementGroup(group);
  setSettlementRawBalances({});
  setSettlementDefaults({ defaultAmount: 0 });
  setIsMarkSettledMode(true);
  setShowSettlementModal(true);
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
          {showCreateTab && (
            <TabsTrigger value="create">Expenses</TabsTrigger>
          )}
        </TabsList>

        {/* ⬇️  NEW TAB BODY  */}
        <TabsContent value="summary">
          <Summary
            groups={savedGroups}
            expensesByGroup={Object.fromEntries(savedGroups.map(g => [g.id, g.expenses]))}
            settlementsByGroup={settlementsByGroup} // ① pass in settlements
            fullUserId={me?.id ?? ''}
            onSettleClick={handleOpenSettle}
            onMarkSettledClick={handleMarkSettled}
            onSelectGroup={(g) => {
              // load that group into the wizard/ExpensesPanel
              setActiveGroupId(g.id);
              setActiveGroup(g);
              setGroupName(g.name);
              setMembers(g.members);
              setWizardStep('expenses');
              setShowCreateTab(true);
              setActiveTab('create');
            } }
            onShareGroup={group => {
              const link = getGroupShareLink(group.id);
              navigator.clipboard.writeText(link);
              alert('Group link copied!');
            } }
            onEditGroup={group => {
              // open the wizard back at Details for editing
              setActiveGroupId(group.id);
              setActiveGroup(group);
              setGroupName(group.name);
              setMembers(group.members);
              setWizardStep('details');
              setShowCreateTab(true);
              setActiveTab('create');
            } } onCreateGroup={startNewGroup}
          />
            {showSettlementModal && settlementGroup && (
            <SettlementModal
              isOpen
              onClose={() => setShowSettlementModal(false)}
              groupName={settlementGroup.name}
              members={settlementGroup.members}
              expenses={settlementGroup.expenses}
              settlements={settlementsByGroup[settlementGroup.id] || []}
              currentUserId={me!.id}
              currency={currency}
              isMarkSettledMode={isMarkSettledMode}
              onSave={async (payerId, payeeId, amt, date) => {
                await addSettlement(
                  settlementGroup.id,
                  payerId,
                  payeeId,
                  amt,
                  date
                );
                const updated = await getSettlements(settlementGroup.id);
                setSettlementsByGroup(prev => ({
                  ...prev,
                  [settlementGroup.id]: updated,
                }));
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="create">
          {wizardStep === 'details' ? (
            <GroupDetailsForm
              groupName={groupName}
              setGroupName={setGroupName}
              members={members}
              addMember={handleAddMember}
              removeMember={removeMember}
              canContinue={!!groupName.trim() && members.length > 0}
              onNext={handleDetailsNext}
              currentUser={me} onCancel={() => {
                // go to summary tab
                setActiveTab('summary');
              } }
              currency={currency} 
              setCurrency={setCurrency}
              />
          ) : (
            <ExpensesPanel
              /* DATA */
              groupName={groupName}
              expenses={expenses}
              members={members}
              splitMode={splitMode}
              currentExpense={currentExpense}
              weightSplits={weightSplits}
              isEditingExpense={isEditingExpense}
              showExpenseForm={showExpenseForm}
              showReceiptUploader={showReceiptUploader}
              settlements={settlementsByGroup[activeGroupId] ?? []}
              youId={session?.uid ?? anonUser?.id ?? ""}
              currency={currency}
              /* SETTERS */
              setExpenses={setExpenses}
              setCurrentExpense={setCurrentExpense}
              setWeightSplits={setWeightSplits}
              setSplitMode={setSplitMode}
              setIsEditingExpense={setIsEditingExpense}
              setShowExpenseForm={setShowExpenseForm}
              setShowReceiptUploader={setShowReceiptUploader}
              onReceiptPrefill={handleReceiptPrefill}
              /* HELPERS */
              membersMapById={Object.fromEntries(members.map(m => [m.id, m]))}
              //addExpenseToFirebase={(exp) =>
              //  addExpense(activeGroupId, exp.description, exp.amount, exp.paidBy, exp.splits, exp.createdAt)
              //}
              activeGroupId={activeGroupId}
              /* WIZARD NAV */
              onBack={() => setWizardStep('details')}
              onExpensesChange={(newExps) => {
                // patch the parent’s savedGroups
                setSavedGroups(gs =>
                  gs.map(g => g.id === activeGroupId ? { ...g, expenses: newExps } : g)
                );
              }} 
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
