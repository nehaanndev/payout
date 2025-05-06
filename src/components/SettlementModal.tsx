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
import { calculateOpenBalances, getSettlementPlan } from "@/lib/financeUtils";
import { Member, Expense } from "@/types/group";
import { Settlement } from "@/types/settlement";

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  currentUserId: string;
  onSave: (payeeId: string, amount: number, date: Date) => Promise<void>;
}

export default function SettlementModal({
  isOpen,
  onClose,
  groupName,
  members,
  expenses,
  settlements,
  currentUserId,
  onSave,
}: SettlementModalProps) {
  // 1️⃣ Compute open balances including past settlements
  const openBalances = calculateOpenBalances(members, expenses, settlements);

  // 2️⃣ Get the minimal‐transfer plan for each user, then pick currentUser’s slice
  const plan =
    getSettlementPlan(members, openBalances)[currentUserId] || {
      owes: [],
      receives: [],
    };

  // 3️⃣ Build the payee list from plan.owes
  const payees = plan.owes.map(({ to, amount }) => ({
    id: to,
    name: members.find(m => m.id === to)?.firstName ?? to,
    owed: amount,
  }));

  // 4️⃣ Local state
  const [selectedPayee, setSelectedPayee] = useState<string>(
    payees[0]?.id || ""
  );
  const [amount, setAmount] = useState<string>(
    payees[0]?.owed.toFixed(2) || ""
  );
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // 5️⃣ Whenever payee list or selection changes, reset defaults
  useEffect(() => {
    if (payees.length) {
      setSelectedPayee(payees[0].id);
      setAmount(payees[0].owed.toFixed(2));
    } else {
      setSelectedPayee("");
      setAmount("");
    }
  }, [payees]);

  // 6️⃣ Save handler
  const handleSave = async () => {
    await onSave(selectedPayee, parseFloat(amount), new Date(date));
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Pay up in</span>
            <Badge variant="secondary">{groupName}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payee dropdown */}
          <div>
            <Label>Who do you owe?</Label>
            <Select value={selectedPayee} onValueChange={setSelectedPayee}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a payee" />
              </SelectTrigger>
              <SelectContent>
                {payees.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — ${p.owed.toFixed(2)}
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
