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
  