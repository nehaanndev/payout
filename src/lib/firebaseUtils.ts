import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from "firebase/firestore";

export const createGroup = async (
  groupName: string,
  userId: string,
  members: Member[]
) => {
  
  const formattedMembers = members.map((member) => ({
    email: member.email,
    firstName: member.firstName || "Unknown"  // Include first name with fallback
  }));

  const docRef = await addDoc(collection(db, "groups"), {
    name: groupName,
    createdBy: userId,
    members: formattedMembers,  // Store both email and first names
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
    expenses: [],
  });

  return docRef.id;
};

/**
 * Updates a group by adding or removing members
 * @param groupId - ID of the group to update
 * @param newMembers - Members to add (array of Member objects)
 * @param removeEmails - Emails of members to remove (array of strings)
 */
export const modifyGroupMembers = async (
  groupId: string,
  newMembers: Member[] = [],
  removeEmails: string[] = []
) => {
  if (!groupId) {
    console.error("Invalid group ID");
    return;
  }

  const groupRef = doc(db, "groups", groupId);

  try {
    const groupSnapshot = await getDoc(groupRef);

    if (!groupSnapshot.exists()) {
      console.error(`Group with ID ${groupId} not found`);
      return;
    }

    const groupData = groupSnapshot.data();

    // Retrieve the current members
    const currentMembers: Member[] = groupData.members || [];

    // Filter out the members to be removed
    const updatedMembers = currentMembers
      .filter((member) => !removeEmails.includes(member.email))
      .concat(newMembers);

    // Update the group in Firestore
    await updateDoc(groupRef, {
      members: updatedMembers,
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

// Function to get user groups
export const getUserGroups =  async (userId: string) => {
        const q = query(
          collection(db, "groups"),
          where("members", "array-contains", userId)
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Group[];
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
  splits: Record<string, number>
) => {
  try {
    const expenseRef = collection(db, "groups", groupId, "expenses");

    const newExpense = {
      description,
      amount,
      paidBy,
      splits,
      createdAt: Timestamp.now(),
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
  const expensesRef = collection(db, "groups", groupId, "expenses");
  console.log("Fetching expenses for group", groupId);
  const q = query(expensesRef, orderBy("createdAt", "desc"));
  
  const querySnapshot = await getDocs(q);
  
  const expenses = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  console.log(expenses)
  return expenses as Expense[];
};
