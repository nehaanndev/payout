export interface Settlement {
    id: string;
    payerId: string;
    payeeId: string;
    amount: number;
    createdAt: string;
  }

export interface SettlementDefaults {
    payeeId: string;       // the member you owe money to
    payeeName: string;     // their display name
    defaultAmount: number; // how much you owe them
  }
  