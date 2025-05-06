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
    <div className="space-y-8">
      {groups.map(group => {
        const expenses = expensesByGroup[group.id] ?? [];
        const settlements = settlementsByGroup[group.id] ?? [];

        const rawBalances = calculateRawBalances(group.members, expenses);
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
        const totalOwe = plan.owes.reduce((sum, o) => sum + o.amount, 0);
        const totalGotten = plan.receives.reduce((sum, r) => sum + r.amount, 0);

        const yourPayments = settlements.filter(
          s => s.payeeId === fullUserId
        );

        return (
          <Card
            key={group.id}
            className="overflow-hidden rounded-2xl shadow-xl cursor-pointer hover:shadow-2xl transition"
            onClick={() => onSelectGroup(group)}
          >
            {/* Gradient Header for group title */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white flex items-center justify-between">
                <span>{group.name}</span>
                <span className="text-sm text-indigo-200">
                  {group.members.length} members
                </span>
              </h3>
            </div>

            <CardContent className="bg-white px-6 py-5 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Total spent:{' '}
                  <span className="font-semibold text-gray-900">
                    ${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-indigo-600"
                    onClick={e => {
                      e.stopPropagation();
                      onShareGroup(group);
                    }}
                    aria-label="Share group"
                  >
                    <Share2 className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-indigo-600"
                    onClick={e => {
                      e.stopPropagation();
                      onEditGroup(group);
                    }}
                    aria-label="Edit group"
                  >
                    <Edit2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Debt Status */}
              <div className="space-y-2">
                {totalGotten > 0 ? (
                  <p className="text-sm text-green-600 font-medium">
                    You are owed <span className="font-semibold">${totalGotten.toFixed(2)}</span>
                  </p>
                ) : totalOwe > 0 ? (
                  <>
                    <h4 className="text-sm font-medium text-red-600">You owe:</h4>
                    {plan.owes.map(({ to, amount }) => {
                      const otherName =
                        group.members.find(m => m.id === to)?.firstName ?? to;
                      return (
                        <p key={to} className="text-sm text-red-600">
                          You &rarr; {otherName}:{' '}
                          <span className="font-semibold">${amount.toFixed(2)}</span>
                        </p>
                      );
                    })}
                  </>
                ) : (
                  <p className="text-sm text-green-700 font-medium">
                    You are all settled 🎉
                  </p>
                )}
              </div>

              {/* Your Payments */}
              {yourPayments.length > 0 && (
                <div className="pt-3 border-t border-gray-100 space-y-1">
                  <h4 className="text-sm font-medium text-gray-700">
                    Your payments:
                  </h4>
                  {yourPayments.map(s => {
                    const paidTo =
                      group.members.find(
                        m => m.id === s.payeeId
                      )?.firstName ?? s.payeeId;
                    return (
                      <p key={s.id} className="text-sm text-gray-600">
                        You paid <span className="font-semibold">{paidTo}</span>{' '}
                        <span className="text-gray-900 font-semibold">${s.amount.toFixed(2)}</span> on{' '}
                        {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Settle Button */}
              {totalOwe > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-indigo-600 hover:bg-indigo-50"
                    onClick={() => onSettleClick(group, totalOwe)}
                  >
                    Pay Your Debt
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
