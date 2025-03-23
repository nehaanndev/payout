import { db } from "./firebase";
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

import { getDocs, query, where } from "firebase/firestore";

export const getUserGroups = async (userId: string) => {
  const q = query(
    collection(db, "groups"),
    where("members", "array-contains", userId)
  );
  
  const querySnapshot = await getDocs(q);
  const groups = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return groups;
};
