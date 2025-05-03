import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { calculateRawBalances, calculateOpenBalances } from '@/lib/financeUtils';
import { Group, Expense, Member } from '@/types/group';
import { Settlement } from '@/types/settlement';

interface SummaryProps {
  groups: Group[];
  expensesByGroup: Record<string, Expense[]>;
  settlementsByGroup: Record<string, Settlement[]>;   // ← new
  onSettleClick: (g: Group) => void;
}
  
  export default function Summary({ groups, expensesByGroup, settlementsByGroup, onSettleClick }: SummaryProps) {
    if (groups.length === 0) {
      return (
        <Card className="mt-6">
          <CardHeader><CardTitle>No groups yet</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p>You don’t have any groups. Let’s start by creating one!</p>
            <Button variant="primaryDark" onClick={() => onSettleClick({} as Group)}>
              Create Group
            </Button>
          </CardContent>
        </Card>
      );
    }
  
    return (
      <>
        {groups.map(group => {
            const expenses = expensesByGroup[group.id] ?? [];
            const settlements = settlementsByGroup[group.id] ?? [];

            const raw = calculateRawBalances(group.members, expenses);
            const balances = calculateOpenBalances(group.members, expenses, settlements);
            const unsettled = Object.values(balances).some(v => Math.abs(v) > 0.01);

          return (
            <Card key={group.id} className="mt-6">
              <CardHeader>
                <CardTitle className="flex justify-between">
                  {group.name}
                  <span className="text-sm text-gray-500">
                    {group.members.length} members
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  Total spent:{" "}
                  <b>${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}</b>
                </p>

                {unsettled ? (
                  <>
                    <ul className="text-sm">
                      {Object.entries(balances).map(([id, bal]) => {
                        if (Math.abs(bal) < 0.01) return null;
                        const name =
                          group.members.find(m => m.id === id)?.firstName ?? id;
                        return (
                          <li
                            key={id}
                            className={bal < 0 ? "text-red-600" : "text-green-600"}
                          >
                            {name} {bal < 0 ? "owes" : "is owed"} $
                            {Math.abs(bal).toFixed(2)}
                          </li>
                        );
                      })}
                    </ul>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onSettleClick(group);
                      }}
                    >
                      Settle Debts
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-green-700">All settled 🎉</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </>
    );
  }
  