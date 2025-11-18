import { Expense } from "@/types/group";
import { FirestoreDataConverter, Timestamp, DocumentData } from "firebase/firestore";

export const firebaseExpenseConverter: FirestoreDataConverter<Expense> = {
  toFirestore(expense: Expense): DocumentData {
    return {
      id: expense.id,
      amount: expense.amount,
      description: expense.description,
      createdAt: Timestamp.fromDate(expense.createdAt),
      paidBy: expense.paidBy,
      splits: expense.splits,
      amountMinor: expense.amountMinor,
      splitsMinor: expense.splitsMinor,
      tags: expense.tags ?? [],
    };
  },
  fromFirestore(snapshot, options): Expense {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      amount: data.amount,
      description: data.description,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
      paidBy: data.paidBy,
      splits: data.splits,
      amountMinor: data.amountMinor,
      splitsMinor: data.splitsMinor,
      tags: Array.isArray(data.tags) ? data.tags : [],
    };
  },
};
