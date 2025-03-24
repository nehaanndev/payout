export interface Expense {
    id: string;
    description: string;
    amount: number;
    paidBy: string;
    createdAt: string;
    splits: Record<string, number>;
  }
  
  export interface Group {
    id: string;
    name: string;
    createdBy: string;
    members: string[];
    expenses: Expense[];
    createdAt: string;
    lastUpdated: string;
  }
  