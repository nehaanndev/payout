  import { CurrencyCode } from "@/lib/currency_core";
  // Define two interfaces for clarity
export interface NewExpense {
  description: string;
  amount: number;
  paidBy: string;
  createdAt: Date;
  splits: Record<string, number>;
  amountMinor: number;
  splitsMinor: Record<string, number>;
  tags?: string[];
}

  export interface Expense extends NewExpense {
    id: string; // ID is required after retrieval from Firebase
  }

    export interface Member {
      email: string | null; // Optional email field
      firstName: string;   // Add first name field
      id: string; // Unique identifier for the user (to support unauthenticated members)
      authProvider?: 'google' | 'microsoft' | 'facebook' | 'anon' | 'manual'; // Optional for clarity
      paypalMeLink?: string | null;
    };
    
  export interface Group {
    id: string;
    name: string;
    createdBy: string;  //userid
    members: Member[]; 
    expenses: Expense[];
    createdAt: string;
    lastUpdated: string;
    currency: CurrencyCode; 
    tags?: string[];
  }
  
import { User as FirebaseUser } from "firebase/auth";

// Extend Firebase User type to include group_id and group data
export interface UserWithGroup extends FirebaseUser {
  group_id?: string;
  group?: Group;
}
