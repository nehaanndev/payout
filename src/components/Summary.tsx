import React from 'react';
import { Share2, Edit2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  calculateRawBalances,
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
  fullUserName: string;
  onSettleClick: (group: Group, totalOwe: number) => void;
  onSelectGroup: (group: Group) => void;
  onShareGroup: (group: Group) => void;
  onEditGroup: (group: Group) => void;
}

export default function Summary({
    groups,
    expensesByGroup,
    settlementsByGroup,
    fullUserId,
    fullUserName,
    onSettleClick,
    onSelectGroup,
    onShareGroup,
    onEditGroup,
  }: SummaryProps) {
  return (
    <>
      {groups.map(group => {
        const expenses = expensesByGroup[group.id] ?? [];
        const settlements = settlementsByGroup[group.id] ?? [];

        const rawBalances = calculateRawBalances(group.members, expenses);
        const openBalances = calculateOpenBalances(
          group.members,
          expenses,
          settlements
        );
        const moneyOwedOrGottenPlan = getSettlementPlan(group.members, openBalances)[fullUserId] || { owes: [], receives: [] };
        const totalOwe = moneyOwedOrGottenPlan.owes.reduce((sum, o) => sum + o.amount, 0);
        const totalGotten = moneyOwedOrGottenPlan.receives.reduce((sum, r) => sum + r.amount, 0);
        

        console.log('fullUserId', fullUserId);
        console.log('rawBalances', rawBalances);
        console.log('openBalances', openBalances);
        console.log('moneyOwedOrGottenPlan', moneyOwedOrGottenPlan);
        console.log('totalOwe', totalOwe);
        console.log('totalGotten', totalGotten);

        // 2. Your past payments:
        const yourPayments = settlements.filter(
          s => s.payeeId === fullUserId
        );

        return (
          <Card key={group.id} className="mt-6 cursor-pointer hover:bg-slate-50" onClick={() => onSelectGroup(group)} >
            <CardHeader>
              <CardTitle className="flex justify-between">
              <div className="flex items-center gap-2">
          <span className="font-medium">{group.name}</span>
          <span className="text-sm text-gray-500">
            {group.members.length} members
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={e => {
              e.stopPropagation();
              onShareGroup(group);
            }}
            aria-label="Share group"
          >
          <Share2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={e => {
              e.stopPropagation();
              onEditGroup(group);
            }}
            aria-label="Edit group"
          >
            <Edit2 className="h-4 w-4" />
         </Button>
        </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Total spent:{' '}
                <b>
                  $
                  {expenses
                    .reduce((s, e) => s + e.amount, 0)
                    .toFixed(2)}
                </b>
              </p>

              {/* Your debts */}
              
              <div className="space-y-1">
                {totalGotten > 0 ? (
                  // Case A: you’re owed money
                  <p className="text-sm text-green-600">
                    You are owed ${totalGotten.toFixed(2)}
                  </p>
                ) : totalOwe > 0 ? (
                  // Case B: you owe others
                  <>
                    <h4 className="text-sm font-medium">You owe:</h4>
                    {moneyOwedOrGottenPlan.owes.map(({ to, amount }) => {
                      const otherName =
                        group.members.find(m => m.id === to)?.firstName ?? to;
                      return (
                        <p key={to} className="text-sm text-red-600">
                          You → {otherName}: ${amount.toFixed(2)}
                        </p>
                      );
                    })}
                  </>
                ) : (
                  // Case C: perfectly settled
                  <p className="text-sm text-green-700">You are all settled 🎉</p>
                )}
              </div>


              {/* Your payments */}
              {yourPayments.length > 0 && (
                <div className="mt-2 space-y-1">
                  <h4 className="text-sm font-medium">
                    Your payments:
                  </h4>
                  {yourPayments.map(s => {
                    const paidTo =
                      group.members.find(
                        m => m.id === s.payeeId
                      )?.firstName ?? s.payeeId;
                    return (
                      <p
                        key={s.id}
                        className="text-sm text-green-600"
                      >
                        You paid {paidTo} $
                        {s.amount.toFixed(2)} on{' '}
                        {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Pay button */}
              {totalOwe > 0  && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSettleClick(group, totalOwe)}
                >
                  Pay Your Debt
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
