"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { theme } from "@/lib/theme";
import { SettlementMethod } from "@/types/settlement";
import { Wallet, Smartphone, CreditCard, CircleDollarSign, Check, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

type PaymentSettingsDialogMode = "prompt" | "settings";

type PaymentSettingsDialogProps = {
  open: boolean;
  mode: PaymentSettingsDialogMode;
  initialLink?: string | null;
  initialSuppressPrompt?: boolean;
  initialPreferredMethod?: SettlementMethod | null;
  initialZelleId?: string | null;
  initialVenmoId?: string | null;
  initialCashAppId?: string | null;
  onClose: () => void;
  onSave: (payload: {
    paypalMeLink: string | null;
    zelleId: string | null;
    venmoId: string | null;
    cashAppId: string | null;
    preferredPaymentMethod: SettlementMethod | null;
    suppressPaypalPrompt: boolean;
  }) => Promise<void> | void;
  isNight?: boolean;
};

// Payment method configuration
const PAYMENT_METHODS: {
  id: SettlementMethod;
  label: string;
  icon: typeof Wallet;
  placeholder: string;
  description: string;
  recommended?: boolean;
  recommendedReason?: string;
}[] = [
    {
      id: "paypal",
      label: "PayPal",
      icon: Wallet,
      placeholder: "https://paypal.me/yourname",
      description: "Your PayPal.Me link",
      recommended: true,
      recommendedReason: "Free & easy to set up",
    },
    {
      id: "venmo",
      label: "Venmo",
      icon: Smartphone,
      placeholder: "@username",
      description: "Your Venmo username",
    },
    {
      id: "zelle",
      label: "Zelle",
      icon: CreditCard,
      placeholder: "email@example.com",
      description: "Email or phone number",
    },
    {
      id: "cash_app",
      label: "Cash App",
      icon: CircleDollarSign,
      placeholder: "$username",
      description: "Your $cashtag",
    },
  ];

const normalizeLink = (value: string) => {
  let trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed.replace(/^\/+/, "")}`;
  }
  return trimmed;
};

const isValidPayPalLink = (value: string) =>
  /paypal\.me\/[\w-]+/i.test(value.trim());

const MODE_CONTENT: Record<
  PaymentSettingsDialogMode,
  { title: string; description: string }
> = {
  prompt: {
    title: "How would you like to get paid?",
    description:
      "Set up your preferred payment method so friends can pay you easily.",
  },
  settings: {
    title: "Payment methods",
    description:
      "Manage how you receive payments from your Split groups.",
  },
};

export function PaymentSettingsDialog({
  open,
  mode,
  initialLink = null,
  initialSuppressPrompt = false,
  initialPreferredMethod = null,
  initialZelleId = null,
  initialVenmoId = null,
  initialCashAppId = null,
  onClose,
  onSave,
  isNight = false,
}: PaymentSettingsDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<SettlementMethod | null>(initialPreferredMethod ?? "paypal");
  const [paypalLink, setPaypalLink] = useState(initialLink ?? "");
  const [zelleId, setZelleId] = useState(initialZelleId ?? "");
  const [venmoId, setVenmoId] = useState(initialVenmoId ?? "");
  const [cashAppId, setCashAppId] = useState(initialCashAppId ?? "");
  const [suppressPrompt, setSuppressPrompt] = useState(initialSuppressPrompt);
  const [showMoreMethods, setShowMoreMethods] = useState(mode === "settings");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedMethod(initialPreferredMethod ?? "paypal");
    setPaypalLink(initialLink ?? "");
    setZelleId(initialZelleId ?? "");
    setVenmoId(initialVenmoId ?? "");
    setCashAppId(initialCashAppId ?? "");
    setSuppressPrompt(initialSuppressPrompt);
    setShowMoreMethods(mode === "settings");
    setError(null);
    setSaving(false);
  }, [open, initialLink, initialSuppressPrompt, initialPreferredMethod, initialZelleId, initialVenmoId, initialCashAppId, mode]);

  const getValueForMethod = (methodId: SettlementMethod): string => {
    switch (methodId) {
      case "paypal": return paypalLink;
      case "zelle": return zelleId;
      case "venmo": return venmoId;
      case "cash_app": return cashAppId;
      default: return "";
    }
  };

  const setValueForMethod = (methodId: SettlementMethod, value: string) => {
    switch (methodId) {
      case "paypal": setPaypalLink(value); break;
      case "zelle": setZelleId(value); break;
      case "venmo": setVenmoId(value); break;
      case "cash_app": setCashAppId(value); break;
    }
  };

  const handleSave = async () => {
    // Validate PayPal link if provided
    const normalizedPaypal = normalizeLink(paypalLink);
    if (normalizedPaypal && !isValidPayPalLink(normalizedPaypal)) {
      setError("Enter a valid PayPal.Me link, like https://paypal.me/yourname");
      return;
    }

    try {
      setSaving(true);
      await onSave({
        paypalMeLink: normalizedPaypal || null,
        zelleId: zelleId.trim() || null,
        venmoId: venmoId.trim() || null,
        cashAppId: cashAppId.trim() || null,
        preferredPaymentMethod: selectedMethod,
        suppressPaypalPrompt: suppressPrompt,
      });
      setSaving(false);
      onClose();
    } catch (cause) {
      console.error("Failed to save payment settings", cause);
      setSaving(false);
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn't save your changes. Please try again."
      );
    }
  };

  const heading = MODE_CONTENT[mode];

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : null)}>
      <DialogContent className={cn(
        "max-w-lg rounded-3xl border shadow-2xl backdrop-blur",
        isNight
          ? "border-white/15 bg-slate-900/95 shadow-slate-900/50"
          : "border-slate-200 bg-white/95 shadow-slate-900/10"
      )}>
        <DialogHeader className="space-y-2">
          <DialogTitle className={cn("text-xl font-semibold", isNight ? "text-white" : "text-slate-900")}>
            {heading.title}
          </DialogTitle>
          <DialogDescription className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-600")}>
            {heading.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Payment Method Selection */}
          <div className="space-y-3">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;
              const value = getValueForMethod(method.id);
              const hasValue = value.trim().length > 0;

              return (
                <div
                  key={method.id}
                  className={cn(
                    "rounded-xl border transition-all",
                    isSelected
                      ? isNight
                        ? "border-emerald-500/50 bg-emerald-950/30"
                        : "border-emerald-500 bg-emerald-50/50"
                      : isNight
                        ? "border-white/10 bg-slate-800/40 hover:border-white/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  {/* Method Header */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-3"
                    onClick={() => setSelectedMethod(method.id)}
                  >
                    <div className={cn(
                      "flex items-center justify-center h-10 w-10 rounded-lg",
                      isSelected
                        ? "bg-emerald-500 text-white"
                        : isNight
                          ? "bg-slate-700 text-slate-300"
                          : "bg-slate-100 text-slate-600"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium",
                          isNight ? "text-white" : "text-slate-900"
                        )}>
                          {method.label}
                        </span>
                        {method.recommended && (
                          <span className={cn(
                            "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                            isNight
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-amber-100 text-amber-700"
                          )}>
                            <Sparkles className="h-3 w-3" />
                            {method.recommendedReason}
                          </span>
                        )}
                        {hasValue && !isSelected && (
                          <Check className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                      <span className={cn(
                        "text-xs",
                        isNight ? "text-slate-400" : "text-slate-500"
                      )}>
                        {method.description}
                      </span>
                    </div>
                    <div className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                      isSelected
                        ? "border-emerald-500 bg-emerald-500"
                        : isNight
                          ? "border-slate-600"
                          : "border-slate-300"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </button>

                  {/* Input Field - shown when selected */}
                  {isSelected && (
                    <div className="px-3 pb-3">
                      <Input
                        placeholder={method.placeholder}
                        value={value}
                        onChange={(e) => setValueForMethod(method.id, e.target.value)}
                        className={theme.input(isNight)}
                      />
                      {method.id === "paypal" && (
                        <p className={cn("text-xs mt-2", isNight ? "text-slate-400" : "text-slate-500")}>
                          Don&apos;t have one?{" "}
                          <a
                            href="https://www.paypal.com/paypalme/"
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "font-medium underline underline-offset-2",
                              isNight
                                ? "text-emerald-400 hover:text-emerald-300"
                                : "text-emerald-600 hover:text-emerald-500"
                            )}
                          >
                            Create a free PayPal.Me link
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add More Methods Toggle */}
          {mode === "prompt" && (
            <button
              type="button"
              onClick={() => setShowMoreMethods(!showMoreMethods)}
              className={cn(
                "flex items-center gap-2 text-sm font-medium",
                isNight ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              )}
            >
              {showMoreMethods ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showMoreMethods ? "Hide additional methods" : "Add more payment methods"}
            </button>
          )}

          {/* Additional Methods Inputs */}
          {showMoreMethods && (
            <div className={cn(
              "space-y-4 p-4 rounded-xl border",
              isNight
                ? "border-white/10 bg-slate-800/30"
                : "border-slate-200 bg-slate-50/50"
            )}>
              <p className={cn("text-xs font-medium", isNight ? "text-slate-400" : "text-slate-500")}>
                Configure additional methods (optional):
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {PAYMENT_METHODS.filter(m => m.id !== selectedMethod).map((method) => (
                  <div key={method.id} className="space-y-1.5">
                    <Label className={cn("text-xs", isNight ? "text-slate-300" : "text-slate-600")}>
                      {method.label}
                    </Label>
                    <Input
                      placeholder={method.placeholder}
                      value={getValueForMethod(method.id)}
                      onChange={(e) => setValueForMethod(method.id, e.target.value)}
                      className={theme.input(isNight)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Don't prompt again checkbox */}
          <div className={cn(
            "flex items-start gap-3 rounded-xl border p-3",
            isNight
              ? "border-white/15 bg-slate-800/60"
              : "border-slate-200 bg-slate-50/70"
          )}>
            <Checkbox
              id="disable-prompts"
              checked={suppressPrompt}
              onCheckedChange={(checked) =>
                setSuppressPrompt(Boolean(checked))
              }
            />
            <div className="space-y-1">
              <Label
                htmlFor="disable-prompts"
                className={cn("text-sm font-medium", isNight ? "text-slate-200" : "text-slate-800")}
              >
                Don&apos;t prompt me for this again
              </Label>
              <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>
                You can always update your payment methods from Settings.
              </p>
            </div>
          </div>

          {error ? (
            <p className={cn("text-sm font-medium", isNight ? "text-rose-400" : "text-rose-600")}>{error}</p>
          ) : null}
        </div>

        <DialogFooter className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="min-w-[6.5rem]"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentSettingsDialog;

