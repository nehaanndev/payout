import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const createGroup = async (
  groupName: string,
  userId: string,
  members: string[]
) => {
  const docRef = await addDoc(collection(db, "groups"), {
    name: groupName,
    createdBy: userId,
    members,
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
    expenses: [],
  });

  return docRef.id;
};

import { doc, setDoc } from "firebase/firestore";

export const addExpense = async (
  groupId: string,
  description: string,
  amount: number,
  paidBy: string,
  splits: Record<string, number>
) => {
  const expenseRef = doc(collection(db, "expenses"));
  await setDoc(expenseRef, {
    groupId,
    description,
    amount,
    paidBy,
    splits,
    createdAt: serverTimestamp(),
  });

  return expenseRef.id;
};

import { getAuth, onAuthStateChanged , GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { getDocs, query, where } from "firebase/firestore";
import { Group } from "@/types/group";

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