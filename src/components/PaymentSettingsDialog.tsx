"use client";

import { useEffect, useMemo, useState } from "react";

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

type PaymentSettingsDialogMode = "prompt" | "settings";

type PaymentSettingsDialogProps = {
  open: boolean;
  mode: PaymentSettingsDialogMode;
  initialLink?: string | null;
  initialSuppressPrompt?: boolean;
  onClose: () => void;
  onSave: (payload: {
    paypalMeLink: string | null;
    suppressPaypalPrompt: boolean;
  }) => Promise<void> | void;
  isNight?: boolean;
};

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
    title: "Add your PayPal link",
    description:
      "Drop in your PayPal.Me link so friends can pay you without hunting for details.",
  },
  settings: {
    title: "Payment settings",
    description:
      "Update the PayPal.Me link used when others settle balances with you.",
  },
};

export function PaymentSettingsDialog({
  open,
  mode,
  initialLink = null,
  initialSuppressPrompt = false,
  onClose,
  onSave,
  isNight = false,
}: PaymentSettingsDialogProps) {
  const [paypalLink, setPaypalLink] = useState(initialLink ?? "");
  const [suppressPrompt, setSuppressPrompt] = useState(initialSuppressPrompt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPaypalLink(initialLink ?? "");
    setSuppressPrompt(initialSuppressPrompt);
    setError(null);
    setSaving(false);
  }, [open, initialLink, initialSuppressPrompt]);

  const heading = useMemo(() => MODE_CONTENT[mode], [mode]);

  const handleSave = async () => {
    const normalized = normalizeLink(paypalLink);
    if (normalized && !isValidPayPalLink(normalized)) {
      setError("Enter a valid PayPal.Me link, like https://paypal.me/yourname");
      return;
    }

    try {
      setSaving(true);
      await onSave({
        paypalMeLink: normalized ? normalized : null,
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

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="paypal-link" className={cn(isNight ? "text-slate-200" : "")}>PayPal.Me link</Label>
            <Input
              id="paypal-link"
              placeholder="https://paypal.me/yourname"
              value={paypalLink}
              onChange={(event) => setPaypalLink(event.target.value)}
              autoComplete="url"
              className={theme.input(isNight)}
            />
            <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>
              Anything pasted here will appear when friends settle with you.
            </p>
            <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>
              Need to create one?{" "}
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
                Follow PayPal&apos;s PayPal.Me setup guide
              </a>
              .
            </p>
            {error ? (
              <p className={cn("text-sm font-medium", isNight ? "text-rose-400" : "text-rose-600")}>{error}</p>
            ) : null}
          </div>

          <div className={cn(
            "flex items-start gap-3 rounded-2xl border p-3",
            isNight
              ? "border-white/15 bg-slate-800/60"
              : "border-slate-200 bg-slate-50/70"
          )}>
            <Checkbox
              id="disable-paypal-prompts"
              checked={suppressPrompt}
              onCheckedChange={(checked) =>
                setSuppressPrompt(Boolean(checked))
              }
            />
            <div className="space-y-1">
              <Label
                htmlFor="disable-paypal-prompts"
                className={cn("text-sm font-medium", isNight ? "text-slate-200" : "text-slate-800")}
              >
                Don&apos;t prompt me for this again
              </Label>
              <p className={cn("text-xs", isNight ? "text-slate-400" : "text-slate-500")}>
                You can always return here from the app menu to update your link.
              </p>
            </div>
          </div>
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
