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
      <DialogContent className="max-w-lg rounded-3xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-900/10 backdrop-blur">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-semibold text-slate-900">
            {heading.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            {heading.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="paypal-link">PayPal.Me link</Label>
            <Input
              id="paypal-link"
              placeholder="https://paypal.me/yourname"
              value={paypalLink}
              onChange={(event) => setPaypalLink(event.target.value)}
              autoComplete="url"
            />
            <p className="text-xs text-slate-500">
              Anything pasted here will appear when friends settle with you.
            </p>
            {error ? (
              <p className="text-sm font-medium text-rose-600">{error}</p>
            ) : null}
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
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
                className="text-sm font-medium text-slate-800"
              >
                Don’t prompt me for this again
              </Label>
              <p className="text-xs text-slate-500">
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
