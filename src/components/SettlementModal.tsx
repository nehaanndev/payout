import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { calculateOpenBalancesMinor, getSettlementPlanMinor } from "@/lib/financeUtils";
import { Member, Expense } from "@/types/group";
import { Settlement } from "@/types/settlement";
import { CurrencyCode, formatMoney, fromMinor } from "@/lib/currency_core";

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  currentUserId: string;
  currency: CurrencyCode;
  onSave: (payerId: string, payeeId: string, amount: number, date: Date) => Promise<void>;
  isMarkSettledMode?: boolean;
}

export default function SettlementModal({
  isOpen,
  onClose,
  groupName,
  members,
  expenses,
  settlements,
  currentUserId,
  currency,
  onSave,
  isMarkSettledMode = false,
}: SettlementModalProps) {
  // 1️⃣ Compute open balances including past settlements using minor units
  const openBalances = calculateOpenBalancesMinor(members, expenses, settlements, currency);

  // 2️⃣ Get the minimal‐transfer plan for each user, then pick currentUser's slice
  const plan =
    getSettlementPlanMinor(members, openBalances)[currentUserId] || {
      owes: [],
      receives: [],
    };

  // 3️⃣ Build the payee list based on mode
  const payees = isMarkSettledMode 
    ? plan.receives.map(({ from, amount }) => ({
        id: from,
        name: members.find(m => m.id === from)?.firstName ?? from,
        owed: amount,
        type: 'owed' as const,
      }))
    : plan.owes.map(({ to, amount }) => ({
        id: to,
        name: members.find(m => m.id === to)?.firstName ?? to,
        owed: amount,
        type: 'owe' as const,
      }));

  // 4️⃣ Local state
  const [selectedPayee, setSelectedPayee] = useState<string>(
    payees[0]?.id || ""
  );
  const [amount, setAmount] = useState<string>(
    payees[0] ? fromMinor(payees[0].owed, currency).toFixed(2) : ""
  );
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // 5️⃣ Whenever payee list or selection changes, reset defaults
  useEffect(() => {
    if (payees.length) {
      setSelectedPayee(payees[0].id);
      setAmount(fromMinor(payees[0].owed, currency).toFixed(2));
    } else {
      setSelectedPayee("");
      setAmount("");
    }
  }, [payees, currency]);

  // 6️⃣ Save handler
  const handleSave = async () => {
    const selectedPayeeData = payees.find(p => p.id === selectedPayee);
    if (!selectedPayeeData) return;
    
    if (isMarkSettledMode) {
      // Mark as settled mode: they owe you money, so they're the payer
      await onSave(currentUserId, selectedPayee, parseFloat(amount), new Date(date));
    } else {
      // Normal mode: you owe them money, so you're the payer
      await onSave(selectedPayee, currentUserId, parseFloat(amount), new Date(date));
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{isMarkSettledMode ? 'Mark as settled in' : 'Pay up in'}</span>
            <Badge variant="secondary">{groupName}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payee dropdown */}
          <div>
            <Label>{isMarkSettledMode ? 'Who did you settle with?' : 'Who do you owe?'}</Label>
            <Select value={selectedPayee} onValueChange={setSelectedPayee}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a person" />
              </SelectTrigger>
              <SelectContent>
                {payees.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.owed, currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount (editable) */}
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          {/* Date */}
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primaryDark"
            disabled={!selectedPayee || !amount}
            onClick={handleSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
