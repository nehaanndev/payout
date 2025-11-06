export type SettlementMethod = "paypal" | "zelle" | "cash" | "venmo" | "other";
export type SettlementStatus = "pending" | "confirmed";

export interface Settlement {
  id: string;
  payerId: string;
  payeeId: string;
  amount: number;
  createdAt: string;
  method?: SettlementMethod;
  status?: SettlementStatus;
  createdBy?: string;
  paymentNote?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
}

export interface SettlementDefaults {
    payeeId: string;       // the member you owe money to
    payeeName: string;     // their display name
    defaultAmount: number; // how much you owe them
  }
  
