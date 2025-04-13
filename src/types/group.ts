// Define two interfaces for clarity
export interface NewExpense {
  description: string;
  amount: number;
  paidBy: string;
  createdAt: Date;
  splits: Record<string, number>;
}

export interface Expense extends NewExpense {
  id: string; // ID is required after retrieval from Firebase
}

  export interface Member {
    email: string;
    firstName: string;   // Add first name field
    userId: string; // Unique identifier for the user (to support unauthenticated members)
  }
  
  export interface Group {
    id: string;
    name: string;
    createdBy: string;
    members: Member[]; 
    expenses: Expense[];
    createdAt: string;
    lastUpdated: string;
  }
  
import { User as FirebaseUser } from "firebase/auth";

// Extend Firebase User type to include group_id and group data
export interface UserWithGroup extends FirebaseUser {
  group_id?: string;
  group?: Group;
}
