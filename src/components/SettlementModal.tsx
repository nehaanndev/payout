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
import { CurrencyCode, formatMoney, fromMinor, toMinor } from "@/lib/currency_core";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, Smartphone, CreditCard, Banknote, CircleDollarSign, HelpCircle, Check, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onConfirmSettlement?: (settlement: Settlement) => Promise<void>;
  onRejectSettlement?: (settlementId: string) => Promise<void>;
  onUndoSettlement?: (settlementId: string) => Promise<void>;
  isMarkSettledMode?: boolean;
}

// Payment method metadata with icons and display info
const PAYMENT_METHOD_INFO: Record<SettlementMethod, {
  label: string;
  icon: typeof Wallet;
  color: string;
  bgColor: string;
}> = {
  paypal: { label: "PayPal", icon: Wallet, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/50" },
  venmo: { label: "Venmo", icon: Smartphone, color: "text-sky-600", bgColor: "bg-sky-50 dark:bg-sky-950/50" },
  zelle: { label: "Zelle", icon: CreditCard, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/50" },
  cash_app: { label: "Cash App", icon: CircleDollarSign, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/50" },
  cash: { label: "Cash", icon: Banknote, color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/50" },
  other: { label: "Other", icon: HelpCircle, color: "text-slate-600", bgColor: "bg-slate-50 dark:bg-slate-800" },
};

// Get configured payment methods for a member
function getConfiguredMethods(member: Member | null): SettlementMethod[] {
  if (!member) return [];
  const methods: SettlementMethod[] = [];
  if (member.paypalMeLink) methods.push("paypal");
  if (member.venmoId) methods.push("venmo");
  if (member.zelleId) methods.push("zelle");
  if (member.cashAppId) methods.push("cash_app");
  // Cash and other are always available as fallback
  methods.push("cash", "other");
  return methods;
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
  onConfirmSettlement,
  onRejectSettlement,
  onUndoSettlement,
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const selectedPayeeMember = useMemo(
    () => members.find((member) => member.id === selectedPayee) ?? null,
    [members, selectedPayee]
  );

  // Get configured methods for selected payee
  const configuredMethods = useMemo(
    () => getConfiguredMethods(selectedPayeeMember),
    [selectedPayeeMember]
  );

  // Calculate partial payment info
  const selectedPayeeData = useMemo(
    () => payees.find(p => p.id === selectedPayee),
    [payees, selectedPayee]
  );

  const owedAmount = selectedPayeeData?.owed ?? 0;
  const enteredAmountMinor = toMinor(parseFloat(amount) || 0, currency);
  const isPartialPayment = enteredAmountMinor > 0 && enteredAmountMinor < owedAmount;
  const remainingAfterPayment = owedAmount - enteredAmountMinor;

  // 5️⃣ Update defaults when payee list structure changes (e.g. mode switch)
  // We use JSON.stringify to only trigger when the actual content changes, not just the array reference
  const payeesJson = JSON.stringify(payees);
  useEffect(() => {
    if (payees.length === 0) {
      setSelectedPayee("");
      setAmount("");
      setPaymentNote("");
      return;
    }

    // Only reset if the currently selected payee is no longer valid
    const currentStillValid = payees.some(p => p.id === selectedPayee);
    if (!selectedPayee || !currentStillValid) {
      const first = payees[0];
      setSelectedPayee(first.id);
      setAmount(fromMinor(first.owed, currency).toFixed(2));
      setPaymentNote("");
    }
  }, [payeesJson, currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePayeeChange = (value: string) => {
    setSelectedPayee(value);
    const payee = payees.find(p => p.id === value);
    if (payee) {
      setAmount(fromMinor(payee.owed, currency).toFixed(2));
      setPaymentNote("");
    }
  };

  // Auto-select best payment method based on payee's configured methods
  useEffect(() => {
    if (!selectedPayee) {
      return;
    }
    const member = members.find((m) => m.id === selectedPayee);
    if (!member) {
      setPaymentMethod("cash");
      return;
    }
    // Prefer digital methods in order: PayPal, Venmo, Zelle, Cash App, then Cash
    if (member.paypalMeLink) setPaymentMethod("paypal");
    else if (member.venmoId) setPaymentMethod("venmo");
    else if (member.zelleId) setPaymentMethod("zelle");
    else if (member.cashAppId) setPaymentMethod("cash_app");
    else setPaymentMethod("cash");
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

  // Get payment details for selected method
  const getPaymentDetails = () => {
    if (!selectedPayeeMember) return null;

    switch (paymentMethod) {
      case "paypal":
        return selectedPayeeMember.paypalMeLink ? {
          label: "PayPal.Me link",
          value: selectedPayeeMember.paypalMeLink,
          action: () => window.open(selectedPayeeMember.paypalMeLink!, "_blank", "noopener"),
          actionLabel: "Open PayPal"
        } : null;
      case "venmo":
        return selectedPayeeMember.venmoId ? {
          label: "Venmo ID",
          value: selectedPayeeMember.venmoId,
        } : null;
      case "zelle":
        return selectedPayeeMember.zelleId ? {
          label: "Zelle (Email/Phone)",
          value: selectedPayeeMember.zelleId,
        } : null;
      case "cash_app":
        return selectedPayeeMember.cashAppId ? {
          label: "Cash App",
          value: selectedPayeeMember.cashAppId,
        } : null;
      default:
        return null;
    }
  };

  const paymentDetails = getPaymentDetails();

  // Find pending settlements to display
  const pendingApprovals = useMemo(() => {
    return settlements.filter(
      s => s.status === 'pending' && s.payeeId === currentUserId
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [settlements, currentUserId]);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{isMarkSettledMode ? 'Mark as settled in' : 'Pay up in'}</span>
            <Badge variant="secondary">{groupName}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Pending Approvals Section */}
          {pendingApprovals.length > 0 && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <AlertCircle className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Pending Approvals</h3>
              </div>
              <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80">
                These payments have been marked as sent. Confirm them to update balances.
              </p>
              <div className="space-y-2">
                {pendingApprovals.map(settlement => {
                  const payerName = members.find(m => m.id === settlement.payerId)?.firstName ?? 'Unknown';
                  return (
                    <div key={settlement.id} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg p-3 border border-indigo-100 dark:border-indigo-900 shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {payerName} sent {formatMoney(toMinor(settlement.amount, currency), currency)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(settlement.createdAt).toLocaleDateString()}
                          {settlement.method && ` via ${PAYMENT_METHOD_INFO[settlement.method]?.label || settlement.method}`}
                        </p>
                        {settlement.paymentNote && (
                          <p className="text-xs text-slate-500 italic mt-0.5">&quot;{settlement.paymentNote}&quot;</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[80px]"
                        disabled={confirmingId === settlement.id}
                        onClick={async () => {
                          if (onConfirmSettlement) {
                            setConfirmingId(settlement.id);
                            try {
                              await onConfirmSettlement(settlement);
                            } finally {
                              setConfirmingId(null);
                            }
                          }
                        }}
                      >
                        {confirmingId === settlement.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Approve"
                        )}
                      </Button>
                      {onRejectSettlement && (
                        <div className="ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                            onClick={() => onRejectSettlement(settlement.id)}
                          >
                            Mark not received
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirmed Approvals Section (Undo) */}
          {onUndoSettlement && (
            (() => {
              const confirmedByYou = settlements.filter(
                s => s.status === 'confirmed' && s.payeeId === currentUserId
              ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

              if (confirmedByYou.length === 0) return null;

              return (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <Check className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">Confirmed Payments</h3>
                  </div>
                  <div className="space-y-2">
                    {confirmedByYou.map(settlement => {
                      const payerName = members.find(m => m.id === settlement.payerId)?.firstName ?? 'Unknown';
                      return (
                        <div key={settlement.id} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg p-3 border border-emerald-100 dark:border-emerald-900 shadow-sm">
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {payerName} sent {formatMoney(toMinor(settlement.amount, currency), currency)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(settlement.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                            onClick={() => onUndoSettlement(settlement.id)}
                          >
                            Undo
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )}

          <div className="space-y-4">
            {/* Payee dropdown */}
            <div>
              <Label>{isMarkSettledMode ? 'Who did you settle with?' : 'Who do you owe?'}</Label>
              <Select value={selectedPayee} onValueChange={handlePayeeChange}>
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

            {/* Payee Accepts Section */}
            {selectedPayeeMember && configuredMethods.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isMarkSettledMode
                    ? `How did ${selectedPayeeMember.firstName} pay you?`
                    : `${selectedPayeeMember.firstName} accepts:`}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {configuredMethods.map((method) => {
                    const info = PAYMENT_METHOD_INFO[method];
                    const Icon = info.icon;
                    const isSelected = paymentMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                          "border hover:scale-[1.02]",
                          isSelected
                            ? `${info.bgColor} ${info.color} border-current ring-1 ring-current/20`
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {info.label}
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Amount with partial payment indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Amount</Label>
                {isPartialPayment && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Partial payment
                  </span>
                )}
              </div>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={owedAmount > 0 ? `Full amount: ${formatMoney(owedAmount, currency)}` : ""}
              />
              {isPartialPayment && remainingAfterPayment > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <span>
                    Paying {formatMoney(enteredAmountMinor, currency)} of {formatMoney(owedAmount, currency)}
                  </span>
                  <span className="font-medium text-amber-700 dark:text-amber-300">
                    {formatMoney(remainingAfterPayment, currency)} remaining
                  </span>
                </div>
              )}
            </div>

            {/* Payment details for selected method */}
            {paymentDetails && (
              <div className={cn(
                "space-y-2 rounded-xl border p-3",
                PAYMENT_METHOD_INFO[paymentMethod].bgColor,
                "border-slate-200 dark:border-slate-700"
              )}>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {paymentDetails.label}:
                </p>
                <div className="font-mono text-sm font-medium select-all break-all">
                  {paymentDetails.value}
                </div>
                {paymentDetails.action && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={paymentDetails.action}
                  >
                    {paymentDetails.actionLabel}
                  </Button>
                )}
              </div>
            )}

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
            {isMarkSettledMode
              ? 'Mark received'
              : isPartialPayment
                ? `Pay ${formatMoney(enteredAmountMinor, currency)}`
                : 'Record payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

