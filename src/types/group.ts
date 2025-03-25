export interface Expense {
    id: string;
    description: string;
    amount: number;
    paidBy: string;
    createdAt: string;
    splits: Record<string, number>;
  }

  export interface Member {
    email: string;
    firstName: string;   // Add first name field
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
