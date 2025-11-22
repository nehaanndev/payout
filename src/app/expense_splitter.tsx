"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { getUserGroups, getExpenses, createGroup, updateGroupMembers, getUserGroupsById, getSettlements, addSettlement, confirmSettlement } from "@/lib/firebaseUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Group, Expense, Member } from '@/types/group';
import { ExpensePaymentPreferences } from "@/types/paymentPreferences";
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
  paymentPreferences?: ExpensePaymentPreferences | null;
  onShowPaymentSettings?: () => void;
  isNight?: boolean;
  onTabStateChange?: (state: { activeTab: 'summary' | 'create'; showCreateTab: boolean; setActiveTab: (tab: 'summary' | 'create') => void }) => void;
}

export default function ExpenseSplitter({
  session,
  groupid,
  anonUser,
  currency: initialCurrency,
  paymentPreferences,
  onShowPaymentSettings,
  isNight = false,
  onTabStateChange,
}: ExpenseSplitterProps) {
const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState<'summary' | 'create'>('summary');
  // only show the Create/Edit tab when the user has clicked "New Group" or loaded an existing one
const [showCreateTab, setShowCreateTab] = useState(false);

  // Notify parent of tab state changes
  // Use a ref to track the last state to avoid unnecessary updates
  const lastStateRef = React.useRef<{ activeTab: 'summary' | 'create'; showCreateTab: boolean } | null>(null);
  
  useEffect(() => {
    const currentState = { activeTab, showCreateTab };
    // Only notify if state actually changed
    if (
      !lastStateRef.current ||
      lastStateRef.current.activeTab !== currentState.activeTab ||
      lastStateRef.current.showCreateTab !== currentState.showCreateTab
    ) {
      lastStateRef.current = currentState;
      onTabStateChange?.({ activeTab, showCreateTab, setActiveTab });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, showCreateTab]); // Don't include onTabStateChange to avoid loops
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
  splitsMinor: {},
  tags: [],
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
      case "facebook.com":
        return "facebook";
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

  const me = useMemo<Member | null>(() => {
    if (session) {
      return {
        id: session.uid,
        firstName:
          session.displayName?.split(" ")[0] ??
          (session.email ? session.email.split("@")[0] : "User"),
        email: session.email ?? null,
        authProvider: getAuthProviderFromSession(session),
      };
    }
    if (anonUser) {
      return anonUser;
    }
    return null;
  }, [session, anonUser]);

  useEffect(() => {
    if (!me?.id) {
      return;
    }
    const normalizedLink = paymentPreferences?.paypalMeLink ?? null;

    setMembers((prev) => {
      const index = prev.findIndex((member) => member.id === me.id);
      if (index === -1) {
        return prev;
      }
      const existing = prev[index];
      if ((existing.paypalMeLink ?? null) === normalizedLink) {
        return prev;
      }
      const next = prev.slice();
      next[index] = {
        ...existing,
        paypalMeLink: normalizedLink,
      };
      return next;
    });

    setSavedGroups((prev) =>
      prev.map((group) => {
        const memberIndex = group.members.findIndex((member) => member.id === me.id);
        if (memberIndex === -1) {
          return group;
        }
        const currentMember = group.members[memberIndex];
        if ((currentMember.paypalMeLink ?? null) === normalizedLink) {
          return group;
        }
        const membersWithLink = group.members.slice();
        membersWithLink[memberIndex] = {
          ...currentMember,
          paypalMeLink: normalizedLink,
        };
        return { ...group, members: membersWithLink };
      })
    );
  }, [me?.id, paymentPreferences?.paypalMeLink]);

  useEffect(() => {
    if (!me?.id) {
      return;
    }
    if (paymentPreferences?.paypalMeLink === undefined) {
      return;
    }
    const normalizedLink = paymentPreferences.paypalMeLink ?? null;
    const groupsToSync = savedGroups.filter((group) =>
      group.members.some(
        (member) =>
          member.id === me.id &&
          (member.paypalMeLink ?? null) !== normalizedLink
      )
    );
    if (!groupsToSync.length) {
      return;
    }
    void Promise.all(
      groupsToSync.map((group) =>
        updateGroupMembers(
          group.id,
          group.members.map((member) =>
            member.id === me.id
              ? { ...member, paypalMeLink: normalizedLink }
              : member
          )
        )
      )
    ).catch((error) => {
      console.error("Failed to sync PayPal link to groups", error);
    });
  }, [me?.id, paymentPreferences?.paypalMeLink, savedGroups]);

  if (loading) {
    return <p>Loading groups...</p>;
  }

  // Early guard for either signed-in user or anonymous user and bail out if neither is present
  if (!session && !anonUser) {
    throw new Error("Anonymous user must be provided when not signed in");
  }

  const currentUserId = me?.id ?? (session ? session.uid : anonUser!.id);

  const shouldShowPaymentReminder =
    Boolean(
      session &&
      paymentPreferences &&
      !paymentPreferences.paypalMeLink &&
      !paymentPreferences.suppressPaypalPrompt &&
      onShowPaymentSettings
    );

  const clearcurrentExpense = () => {
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
      tags: [],
    });

    setSplitMode(nextSplitMode);
    if (nextSplitMode === "weight") {
      setWeightSplits(data.splits ?? {});
    } else {
      setWeightSplits({});
    }
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
      await updateGroupMembers(activeGroupId, members, { name: groupName, currency });
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

  const handleConfirmSettlement = async (settlement: Settlement) => {
    if (!activeGroupId) {
      return;
    }
    if (settlement.payeeId !== currentUserId) {
      console.warn("Only the payee can confirm a settlement");
      return;
    }
    try {
      await confirmSettlement(activeGroupId, settlement.id, currentUserId);
      const updated = await getSettlements(activeGroupId);
      setSettlementsByGroup((prev) => ({
        ...prev,
        [activeGroupId]: updated,
      }));
    } catch (error) {
      console.error("Failed to confirm settlement", error);
      alert("We couldn't mark this settlement as received. Please try again.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {shouldShowPaymentReminder ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-slate-700">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-900">
                Add a PayPal link for faster paybacks
              </p>
              <p className="text-xs text-slate-600">
                Share your PayPal.Me link so friends see it when they settle up.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto"
              onClick={() => onShowPaymentSettings?.()}
            >
              Open payment settings
            </Button>
          </div>
        </div>
      ) : null}
      <Tabs
        value={activeTab}
        onValueChange={(v: string) => setActiveTab(v as 'summary' | 'create')}
        className="space-y-6"
      >
        <TabsList className="w-full hidden">
          <TabsTrigger value="summary">Overview</TabsTrigger>
          {showCreateTab && <TabsTrigger value="create">Expenses</TabsTrigger>}
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
              setExpenses(g.expenses);
              setCurrency(getGroupCurrency(g));
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
              setCurrency(getGroupCurrency(group));
              setWizardStep('details');
              setShowCreateTab(true);
              setActiveTab('create');
            } } onCreateGroup={startNewGroup}
            isNight={isNight}
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
              onSave={async (payerId, payeeId, amt, date, method, note) => {
                await addSettlement(
                  settlementGroup.id,
                  payerId,
                  payeeId,
                  amt,
                  date,
                  {
                    method,
                    createdBy: me?.id ?? currentUserId,
                    paymentNote: note ?? null,
                  }
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
              isNight={isNight}
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
                // patch the parent's savedGroups
                setSavedGroups(gs =>
                  gs.map(g => g.id === activeGroupId ? { ...g, expenses: newExps } : g)
                );
              }} 
              onConfirmSettlement={handleConfirmSettlement}
            />
          )}
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
