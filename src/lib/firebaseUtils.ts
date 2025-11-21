import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, setDoc, deleteDoc, type DocumentData } from "firebase/firestore";
import { firebaseExpenseConverter } from "./firebaseExpenseConverter";
import { CurrencyCode } from "./currency_core";
import { extractTagsFromText } from "./tagHelpers";

export const createGroup = async (
  groupName: string,
  userId: string,
  members: Member[],
  currency: CurrencyCode
) => {
  
  const formattedMembers = members.map((member) => ({
    email: member.email || null,
    firstName: member.firstName, // Include first name with fallback
    id: member.id, // Ensure id is included
    authProvider: member.authProvider,
    paypalMeLink: member.paypalMeLink ?? null,
  }));

  const formattedMemberEmails = members.map((member) => member.email || null);
  const formattedMemberIds = members.map((member) => member.id);

  const docRef = await addDoc(collection(db, "groups"), {
    name: groupName,
    currency: currency,
    createdBy: userId,
    members: formattedMembers,  // Store both email and first names
    memberEmails:formattedMemberEmails,          // Array of emails for easier querying
    memberIds: formattedMemberIds,              // Array of IDs for easier querying
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
    expenses: [],
    tags: extractTagsFromText(groupName),
  });

  return docRef.id;
};

/**
 * Updates a group by replacing the members with the provided list
 * @param groupId - ID of the group to update
 * @param members - Array of updated members (with emails and first names)
 */
export const updateGroupMembers = async (
  groupId: string,
  members: Member[],
  options?: {
    name?: string;
    currency?: CurrencyCode;
  }
) => {
  if (!groupId || !members) {
    console.error("Invalid group ID or members");
    return;
  }

  const groupRef = doc(db, "groups", groupId);

  try {
    const formattedMembers = members.map((member) => ({
      ...member,
      paypalMeLink: member.paypalMeLink ?? null,
    }));
    const memberEmails = formattedMembers.map((member) => member.email);
    const memberIds = formattedMembers.map((member) => member.id);
    console.log(memberEmails);
    console.log(memberIds);
    console.log(members);
    console.log(groupId);
    console.log(groupRef);
    const updatePayload: DocumentData = {
      members: formattedMembers,                    // Save the updated members array
      memberEmails,               // Save only emails for easier querying
      memberIds,                 // Save only IDs for easier querying
      lastUpdated: serverTimestamp(),
    };
    if (options?.name) {
      updatePayload.name = options.name;
      updatePayload.tags = extractTagsFromText(options.name);
    }
    if (options?.currency) {
      updatePayload.currency = options.currency;
    }
    await updateDoc(groupRef, updatePayload);

    console.log(`Group ${groupId} updated successfully`);
  } catch (error) {
    console.error("Error updating group:", error);
  }
};

import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { getDocs, query, where } from "firebase/firestore";
import { Expense, Group, Member } from "@/types/group";

/**
 * Fetches groups where the user is a member by email
 * @param userEmail - The email of the logged-in user
 * @returns Array of Group objects
 */
export const getUserGroups = async (userEmail: string) => {
  if (!userEmail) {
    return [];
  }
  try {
    const q = query(
      collection(db, "groups"),
      where("memberEmails", "array-contains", userEmail)
    );
    const querySnapshot = await getDocs(q);
    console.log(querySnapshot)
    const groups: Group[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Group[];

    return groups;
  } catch (error) {
    console.error("Error fetching user groups:", error);
    return [];
  }
};

/**
 * Fetches groups where the user is a member by email
 * @param userEmail - The email of the logged-in user
 * @returns Array of Group objects
 */
export const getUserGroupsById = async (id: string) => {
  if (!id) {
    return [];
  }
  try {
    const q = query(
      collection(db, "groups"),
      where("memberIds", "array-contains", id)
    );
    const querySnapshot = await getDocs(q);
    console.log(querySnapshot)
    const groups: Group[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Group[];

    return groups;
  } catch (error) {
    console.error("Error fetching user groups:", error);
    return [];
  }
};

export const signInToFirebase = async (accessToken: string) => {
  console.log(accessToken)
  const credential = GoogleAuthProvider.credential(accessToken);
  try {
    await signInWithCredential(auth, credential);
    console.log('User signed in to Firebase');
  } catch (error) {
    console.error('Error signing in to Firebase:', error);
  }
};


import {  orderBy, Timestamp } from "firebase/firestore";
import { Settlement, SettlementMethod, SettlementStatus } from "@/types/settlement";

// ✅ Add expense to Firestore
export const addExpense = async (
  groupId: string,
  description: string,
  amount: number,
  paidBy: string,
  splits: Record<string, number>,
  createdAt: Date,
  amountMinor: number,
  splitsMinor: Record<string, number>,
  tags: string[] = []
) => {
  try {
    const expenseRef = collection(db, "groups", groupId, "expenses");

    const newExpense = {
      description,
      amount,
      paidBy,
      splits,
      createdAt: Timestamp.fromDate(createdAt),
      amountMinor,
      splitsMinor,
      tags,
    };
    // Help with debugging
    console.log(groupId, newExpense)
    const docRef = await addDoc(expenseRef, newExpense);
    console.log("Expense added successfully!");
    return docRef.id;
  } catch (error) {
    console.error("Error adding expense:", error);
    throw new Error("Failed to add expense");
  }
};

// ✅ Fetch expenses for a specific group
export const getExpenses = async (groupId: string) => {
  const expensesRef = collection(db, "groups", groupId, "expenses").withConverter(firebaseExpenseConverter);
  console.log("Fetching expenses for group", groupId);
  const q = query(expensesRef, orderBy("createdAt", "desc"));
  
  const querySnapshot = await getDocs(q);
  
  const expenses = querySnapshot.docs.map((doc) => ({
    ...doc.data(),
  }));
  //console.log(expenses)
  return expenses as Expense[];
};

// ✅ Fetch group by id
export const fetchGroupById = async (groupId: string) => {
  if (!groupId) {
    console.error("Invalid group ID");
    return null;
  }

  try {
    const groupRef = doc(db, "groups", groupId);
    const groupSnapshot = await getDoc(groupRef);

    if (groupSnapshot.exists()) {
      const groupData = { id: groupSnapshot.id, ...groupSnapshot.data() };
      console.log("Group data:", groupData);
      return groupData as Group;
    } else {
      console.error(`Group with ID ${groupId} not found`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching group:", error);
    return null;
  }
};



/** Overwrite an existing expense’s fields */
export async function updateExpense(
  groupId: string,
  expenseId: string,
  data: {
    description: string;
    amount: number;
    paidBy: string;
    splits: Record<string, number>;
    createdAt: string | Date;
    amountMinor: number;
    splitsMinor: Record<string, number>;
    tags?: string[];
  }
) {
  const ref = doc(db, 'groups', groupId, 'expenses', expenseId);
  const payload = { ...data };
  if (typeof payload.tags === "undefined") {
    delete (payload as { tags?: string[] }).tags;
  }
  await setDoc(ref, payload, { merge: true });
}

/** Delete an expense document */
export async function deleteExpense(
  groupId: string,
  expenseId: string
) {
  const ref = doc(db, 'groups', groupId, 'expenses', expenseId);
  await deleteDoc(ref);
}

/* Settlement functions */
type AddSettlementOptions = {
  method?: SettlementMethod;
  createdBy?: string;
  paymentNote?: string | null;
  status?: SettlementStatus;
};

export async function addSettlement(
  groupId: string,
  payerId: string,
  payeeId: string,
  amount: number,
  createdAt: Date = new Date(),
  options: AddSettlementOptions = {}
): Promise<string> {
  const colRef = collection(db, 'groups', groupId, 'settlements');
  const status: SettlementStatus =
    options.status ??
    (options.createdBy && options.createdBy === payeeId ? "confirmed" : "pending");
  const docRef = await addDoc(colRef, {
    payerId,
    payeeId,
    amount,
    createdAt: createdAt.toISOString(),
    createdOn: serverTimestamp(),
    method: options.method ?? "other",
    status,
    createdBy: options.createdBy ?? payerId,
    paymentNote: options.paymentNote ?? null,
    confirmedAt: status === "confirmed" ? new Date().toISOString() : null,
    confirmedBy: status === "confirmed" ? options.createdBy ?? payeeId : null,
  });
  return docRef.id;
}

export async function getSettlements(groupId: string): Promise<Settlement[]> {
  const colRef = collection(db, 'groups', groupId, 'settlements');
  const snap = await getDocs(colRef);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function confirmSettlement(
  groupId: string,
  settlementId: string,
  confirmerId: string
) {
  const ref = doc(db, 'groups', groupId, 'settlements', settlementId);
  await updateDoc(ref, {
    status: "confirmed",
    confirmedBy: confirmerId,
    confirmedAt: new Date().toISOString(),
  });
}
