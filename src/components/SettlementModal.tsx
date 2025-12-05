import { useEffect, useMemo, useState } from "react";
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
import { Settlement, SettlementMethod } from "@/types/settlement";
import { CurrencyCode, formatMoney, fromMinor } from "@/lib/currency_core";
import { Textarea } from "@/components/ui/textarea";

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  currentUserId: string;
  currency: CurrencyCode;
  onSave: (
    payerId: string,
    payeeId: string,
    amount: number,
    date: Date,
    method: SettlementMethod,
    paymentNote?: string
  ) => Promise<void>;
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
  const [paymentMethod, setPaymentMethod] = useState<SettlementMethod>("cash");
  const [paymentNote, setPaymentNote] = useState("");

  const selectedPayeeMember = useMemo(
    () => members.find((member) => member.id === selectedPayee) ?? null,
    [members, selectedPayee]
  );
  const paypalLink = selectedPayeeMember?.paypalMeLink ?? null;

  // 5️⃣ Whenever payee list or selection changes, reset defaults
  useEffect(() => {
    if (payees.length) {
      setSelectedPayee(payees[0].id);
      setAmount(fromMinor(payees[0].owed, currency).toFixed(2));
      setPaymentNote("");
    } else {
      setSelectedPayee("");
      setAmount("");
      setPaymentNote("");
    }
  }, [payees, currency]);

  useEffect(() => {
    if (!selectedPayee) {
      return;
    }
    const member = members.find((m) => m.id === selectedPayee);
    setPaymentMethod(member?.paypalMeLink ? "paypal" : "cash");
  }, [members, selectedPayee]);

  // 6️⃣ Save handler
  const handleSave = async () => {
    const selectedPayeeData = payees.find(p => p.id === selectedPayee);
    if (!selectedPayeeData) return;

    const payerId = isMarkSettledMode ? selectedPayee : currentUserId;
    const payeeId = isMarkSettledMode ? currentUserId : selectedPayee;
    await onSave(
      payerId,
      payeeId,
      parseFloat(amount),
      new Date(date),
      paymentMethod,
      paymentNote.trim() ? paymentNote.trim() : undefined
    );
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

          {/* Method */}
          <div>
            <Label>Payment method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as SettlementMethod)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="zelle">Zelle</SelectItem>
                <SelectItem value="venmo">Venmo</SelectItem>
                <SelectItem value="cash_app">Cash App</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod === "paypal" && paypalLink ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs text-slate-500">
                {selectedPayeeMember?.firstName ?? "This member"} shared a PayPal.Me link.
              </p>
              <Button
                variant="outline"
                className="justify-start border-slate-300 text-slate-700 hover:bg-slate-100"
                onClick={() => window.open(paypalLink, "_blank", "noopener")}
              >
                Open PayPal to pay
              </Button>
            </div>
          ) : null}

          {paymentMethod === "zelle" && selectedPayeeMember?.zelleId ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs text-slate-500">
                Send Zelle payment to:
              </p>
              <div className="font-mono text-sm font-medium select-all">
                {selectedPayeeMember.zelleId}
              </div>
            </div>
          ) : null}

          {paymentMethod === "venmo" && selectedPayeeMember?.venmoId ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs text-slate-500">
                Send Venmo payment to:
              </p>
              <div className="font-mono text-sm font-medium select-all">
                {selectedPayeeMember.venmoId}
              </div>
            </div>
          ) : null}

          {paymentMethod === "cash_app" && selectedPayeeMember?.cashAppId ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs text-slate-500">
                Send Cash App payment to:
              </p>
              <div className="font-mono text-sm font-medium select-all">
                {selectedPayeeMember.cashAppId}
              </div>
            </div>
          ) : null}

          {/* Date */}
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={paymentNote}
              onChange={(event) => setPaymentNote(event.target.value)}
              placeholder="Add context (e.g. Sent via cash or reference number)"
              rows={2}
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
