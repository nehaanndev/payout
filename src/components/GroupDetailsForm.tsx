// components/GroupDetailsForm.tsx

import { useState } from "react";
import { Member } from "@/types/group";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card className="rounded-2xl shadow-xl overflow-hidden">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <h2 className="text-2xl font-extrabold text-white">
          Group Details
        </h2>
      </div>

      <CardContent className="bg-white px-6 py-8 space-y-6">
        {/* Group Name */}
        <div className="space-y-1">
          <Label className="text-sm font-medium text-gray-700">
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
          <Label className="text-sm font-medium text-gray-700">
            Currency
          </Label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="w-full mt-1 rounded-md border border-gray-300 p-2"
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
            <p className="text-xs text-gray-500 mt-1">
              Heads-up: both USD and MXN use “$”. We’ll display the code alongside the symbol where space is tight.
            </p>
          )}
        </div>

        {/* Add Myself Shortcut */}
        {currentUser && !members.some(m => m.id === currentUser.id) && (
          <Button
            variant="primaryDark"
            size="sm"
            onClick={() =>
              addMember(currentUser.firstName, currentUser.email)
            }
          >
            + Add Myself
          </Button>
        )}

        {/* New Member Inputs */}
        <div className="flex gap-4">
          <div className="flex-1 space-y-1">
            <Label className="text-sm font-medium text-gray-700">
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
            <Label className="text-sm font-medium text-gray-700">
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
              variant="primaryDark"
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
              className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full"
            >
              <span className="text-gray-800 text-sm">
                {m.firstName}
              </span>
              <button
                onClick={() => removeMember(m.firstName)}
                className="text-gray-500 hover:text-gray-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primaryDark"
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
