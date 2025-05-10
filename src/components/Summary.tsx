import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Share2, Edit2 } from 'lucide-react';
import Image from "next/image";
import {
  calculateOpenBalances,
  getSettlementPlan
} from '@/lib/financeUtils';
import { Settlement } from '@/types/settlement';
import { Expense, Group } from '@/types/group';

interface SummaryProps {
  groups: Group[];
  expensesByGroup: Record<string, Expense[]>;
  settlementsByGroup: Record<string, Settlement[]>;
  fullUserId: string;
  onSettleClick: (group: Group, totalOwe: number) => void;
  onSelectGroup: (group: Group) => void;
  onShareGroup: (group: Group) => void;
  onEditGroup: (group: Group) => void;
  onCreateGroup: () => void;
}



// ① List your 3–4 background images here:
const BACKGROUNDS = [
  '/images/hero1.png',
  '/images/hero2.png',
  '/images/hero3.png',
];

export default function Summary({
  groups,
  expensesByGroup,
  settlementsByGroup,
  fullUserId,
  onSettleClick,
  onSelectGroup,
  onShareGroup,
  onEditGroup,
  onCreateGroup,
}: SummaryProps) {
  // ⬇︎ Empty‐state when no groups exist
if (groups.length === 0) {
  return (
    <Card className="relative h-64 rounded-2xl overflow-hidden shadow-lg">
      {/* Gradient header */}
      <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <CardTitle className="text-white text-xl font-semibold">
          No groups yet!
        </CardTitle>
      </CardHeader>

      {/* Translucent overlay */}
      <CardContent className="bg-white bg-opacity-80 backdrop-blur-sm p-6 flex flex-col items-center space-y-4">
        <p className="text-black text-lg font-medium">
          You don’t have any groups yet.
        </p>
        <p className="text-gray-600 text-sm text-center">
          Create a group to start tracking expenses with friends.
        </p>
        <Button
          className="bg-primary hover:bg-primary-dark text-white"
          onClick={onCreateGroup}
        >
          Create Your First Group
        </Button>
      </CardContent>
    </Card>
  );
}
  return (
    <div className="space-y-8">
      {groups.map((group, idx) => {
        const bg = BACKGROUNDS[idx % BACKGROUNDS.length];
        const expenses = expensesByGroup[group.id] ?? [];
        const settlements = settlementsByGroup[group.id] ?? [];

        const openBalances = calculateOpenBalances(
          group.members,
          expenses,
          settlements
        );
        const plan =
          getSettlementPlan(group.members, openBalances)[fullUserId] || {
            owes: [],
            receives: [],
          };
        const totalOwe = plan.owes.reduce((s, o) => s + o.amount, 0);
        const totalGotten = plan.receives.reduce((s, r) => s + r.amount, 0);

        return (
          <Card
            key={group.id}
            // ↑ make the card taller
            className="relative h-80 rounded-2xl overflow-hidden shadow-lg cursor-pointer"
            onClick={() => onSelectGroup(group)}
          >
            {/* Background image */}
            <Image
              src={bg}
              alt=""
              fill               // ← enables layout="fill"
              className="absolute inset-0 w-full h-full object-cover"
              priority           // ← optionally flag as high-priority for LCP
            />

            {/* 2️⃣ Purple gradient header */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between
                            bg-gradient-to-r from-indigo-600 to-purple-600
                            px-5 py-3">
              <h3 className="text-white text-xl  font-semibold flex items-center justify-between">

              <span>{group.name}</span>
              
              </h3>
              <div className="flex space-x-2">
              <span className="text-lg text-purple-300 font-sans tracking-tight font-medium">
  {group.members.length} members
</span>
                <Button
                  variant="ghost" size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={e => { e.stopPropagation(); onShareGroup(group); }}
                  aria-label="Share"
                >
                  <Share2 className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={e => { e.stopPropagation(); onEditGroup(group); }}
                  aria-label="Edit"
                >
                  <Edit2 className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* 3️⃣ Bottom‐aligned translucent panel */}
            <div className="absolute inset-x-0 bottom-0 px-6 pb-8">
              <div
                className="bg-white bg-opacity-80 backdrop-blur-sm
                          rounded-lg px-4 py-3 max-w-sm mx-auto
                          flex items-center justify-between space-x-4"
              >
                {/* Left: text block */}
                <div>
                  <p className="text-gray-700">
                    <span className="font-medium">Total spent:</span>{" "}
                    <span className="font-semibold">
                      ${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}
                    </span>
                  </p>

                  {totalGotten > 0 ? (
                    <p className="text-green-600 font-medium">
                      You are owed ${totalGotten.toFixed(2)}
                    </p>
                  ) : totalOwe > 0 ? (
                    <p className="text-red-600 font-medium">
                      You owe ${totalOwe.toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-green-700 font-medium">
                      All settled 🎉
                    </p>
                  )}
                </div>

                {/* Right: slimmer button */}
                {totalOwe > 0 && (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={e => {
                      e.stopPropagation();
                      onSettleClick(group, totalOwe);
                    }}
                  >
                    Pay Debts
                  </Button>
                )}
              </div>
            </div>
            </Card>
        );
      })}
    </div>
  );
}
