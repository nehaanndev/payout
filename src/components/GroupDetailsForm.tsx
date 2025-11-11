// components/GroupDetailsForm.tsx

import { useState } from "react";
import { Member } from "@/types/group";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CurrencyCode } from "@/lib/currency_core";
import { SUPPORTED_CURRENCIES } from "@/lib/currency_core";

interface GroupDetailsFormProps {
  groupName: string;
  setGroupName: (v: string) => void;
  members: Member[];
  addMember: (name: string, email?: string | null) => void;
  removeMember: (firstName: string) => void;
  canContinue: boolean;
  onNext: () => void;
  onCancel: () => void;
  currentUser: Member | null;
    // NEW
  currency: CurrencyCode | "";                // allow "" while selecting
  setCurrency: (c: CurrencyCode) => void;
}

export default function GroupDetailsForm({
  groupName,
  setGroupName,
  members,
  addMember,
  removeMember,
  canContinue,
  onNext,
  onCancel,
  currentUser,
  // NEW
  currency,
  setCurrency,
}: GroupDetailsFormProps) {
  const [first, setFirst] = useState("");
  const [email, setEmail] = useState("");

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            Group setup
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">Details</h2>
          <p className="text-xs text-slate-500">
            Mirrors the overview cards so the wizard feels cohesive.
          </p>
        </div>
      </CardHeader>

      <CardContent className="px-6 py-8 space-y-6">
        {/* Group Name */}
        <div className="space-y-1">
          <Label className="text-sm font-medium text-slate-700">
            Group Name
          </Label>
          <Input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="Enter a name"
            className="mt-1"
          />
        </div>

        {/* NEW: Currency */}
        <div className="space-y-1">
          <Label className="text-sm font-medium text-slate-700">
            Currency
          </Label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="w-full mt-1 rounded-xl border border-slate-300 bg-white p-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            required
          >
            <option value="">Select currency</option>
            {SUPPORTED_CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.label} ({c.code})
              </option>
            ))}
          </select>
          {/* Optional microcopy to prevent $ confusion */}
          {currency === "MXN" && (
            <p className="text-xs text-slate-500 mt-1">
              Heads-up: both USD and MXN use “$”. We’ll display the code alongside the symbol where space is tight.
            </p>
          )}
        </div>

        {/* Add Myself Shortcut */}
        {currentUser && !members.some(m => m.id === currentUser.id) && (
          <Button
            variant="outline"
            size="sm"
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={() =>
              addMember(currentUser.firstName, currentUser.email)
            }
          >
            + Add myself
          </Button>
        )}

        {/* New Member Inputs */}
        <div className="flex gap-4">
          <div className="flex-1 space-y-1">
            <Label className="text-sm font-medium text-slate-700">
              First Name
            </Label>
            <Input
              value={first}
              onChange={e => setFirst(e.target.value)}
              placeholder="e.g. Alice"
              onKeyDown={e =>
                e.key === "Enter" && addMember(first, email)
              }
              className="mt-1"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-sm font-medium text-slate-700">
              Email (optional)
            </Label>
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. alice@example.com"
              onKeyDown={e =>
                e.key === "Enter" && addMember(first, email)
              }
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              className="bg-slate-900 text-white hover:bg-slate-800"
              disabled={!first}
              onClick={() => {
                addMember(first, email);
                setFirst("");
                setEmail("");
              }}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Member Chips */}
        <div className="flex flex-wrap gap-2">
          {members.map(m => (
            <div
              key={m.id}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1"
            >
              <span className="text-slate-800 text-sm">
                {m.firstName}
              </span>
              <button
                onClick={() => removeMember(m.firstName)}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="bg-slate-900 text-white hover:bg-slate-800"
            disabled={!canContinue}
            onClick={onNext}
          >
            Save & Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
