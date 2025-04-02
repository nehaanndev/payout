import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from "firebase/firestore";
import { firebaseExpenseConverter } from "./firebaseExpenseConverter";

export const createGroup = async (
  groupName: string,
  userId: string,
  members: Member[]
) => {
  
  const formattedMembers = members.map((member) => ({
    email: member.email,
    firstName: member.firstName || "Unknown"  // Include first name with fallback
  }));

  const formattedMemberEmails = members.map((member) => member.email);

  const docRef = await addDoc(collection(db, "groups"), {
    name: groupName,
    createdBy: userId,
    members: formattedMembers,  // Store both email and first names
    memberEmails:formattedMemberEmails,          // Array of emails for easier querying
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
    expenses: [],
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
  members: Member[]
) => {
  if (!groupId || !members) {
    console.error("Invalid group ID or members");
    return;
  }

  const groupRef = doc(db, "groups", groupId);

  try {
    const memberEmails = members.map((member) => member.email);

    await updateDoc(groupRef, {
      members,                    // Save the updated members array
      memberEmails,               // Save only emails for easier querying
      lastUpdated: serverTimestamp(),
    });

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

// ✅ Add expense to Firestore
export const addExpense = async (
  groupId: string,
  description: string,
  amount: number,
  paidBy: string,
  splits: Record<string, number>,
  createdAt: Date
) => {
  try {
    const expenseRef = collection(db, "groups", groupId, "expenses");

    const newExpense = {
      description,
      amount,
      paidBy,
      splits,
      createdAt: Timestamp.fromDate(createdAt),
    };

    await addDoc(expenseRef, newExpense);
    console.log("Expense added successfully!");
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
  console.log(expenses)
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