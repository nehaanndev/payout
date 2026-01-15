import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, Edit2, Share2, Trash2, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  calculateOpenBalancesMinor,
  getSettlementPlanMinor,
} from "@/lib/financeUtils";
import { Settlement } from "@/types/settlement";
import { Expense, Group } from "@/types/group";
import { getGroupCurrency, formatMoneyWithMinor } from "@/lib/currency";
import { CurrencyCode, formatMoney, toMinor } from "@/lib/currency_core";

interface SummaryProps {
  groups: Group[];
  expensesByGroup: Record<string, Expense[]>;
  settlementsByGroup: Record<string, Settlement[]>;
  fullUserId: string;
  onSettleClick: (group: Group) => void;
  onMarkSettledClick: (group: Group) => void;
  onSelectGroup: (group: Group) => void;
  onShareGroup: (group: Group) => void;
  onEditGroup: (group: Group) => void;
  onDeleteGroup: (group: Group) => void;
  onCreateGroup: () => void;
  isNight?: boolean;
}

const memberLabel = (count: number) =>
  `${count} ${count === 1 ? "member" : "members"}`;

const statusBadge = (
  totalOwe: number,
  totalGotten: number,
  isPendingSettlement: boolean,
  currency: CurrencyCode
) => {
  if (isPendingSettlement) {
    return (
      <Badge variant="outline" className="border-indigo-300/70 text-indigo-700 bg-indigo-50/50 dark:border-indigo-700 dark:text-indigo-300 dark:bg-indigo-950/30">
        <Clock className="w-3 h-3 mr-1" />
        Settlement Pending
      </Badge>
    );
  }
  if (totalOwe > 0) {
    return (
      <Badge variant="outline" className="border-amber-300/70 text-amber-700 dark:border-amber-700 dark:text-amber-400">
        You owe {formatMoney(totalOwe, currency)}
      </Badge>
    );
  }
  if (totalGotten > 0) {
    return (
      <Badge variant="outline" className="border-emerald-300/70 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
        You’re owed {formatMoney(totalGotten, currency)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400">
      All settled 🎉
    </Badge>
  );
};

type GroupSummary = {
  group: Group;
  expenses: Expense[];
  settlements: Settlement[];
  currency: CurrencyCode;
  totalSpentMajor: number;
  totalSpentMinor: number;
  totalOwe: number;
  totalGotten: number;
  // pendingSent is the amount the user has sent but is not yet confirmed (minor units)
  pendingSent: number;
  // isPendingSettlement is true if the user owes money BUT has enough pending payments to cover it
  isPendingSettlement: boolean;
  status: "owed" | "owe" | "settled" | "pending_settlement";
};

export default function Summary({
  groups,
  expensesByGroup,
  settlementsByGroup,
  fullUserId,
  onSettleClick,
  onMarkSettledClick,
  onSelectGroup,
  onShareGroup,
  onEditGroup,
  onDeleteGroup,
  onCreateGroup,
  isNight = false,
}: SummaryProps) {
  const groupSummaries = useMemo<GroupSummary[]>(() => {
    return groups.map((group) => {
      const expenses = expensesByGroup[group.id] ?? [];
      const settlements = settlementsByGroup[group.id] ?? [];
      const currency = getGroupCurrency(group);

      const openBalances = calculateOpenBalancesMinor(
        group.members,
        expenses,
        settlements,
        currency
      );
      const plan =
        getSettlementPlanMinor(group.members, openBalances)[fullUserId] || {
          owes: [],
          receives: [],
        };

      const totalOwe = plan.owes.reduce((sum, entry) => sum + entry.amount, 0);
      const totalGotten = plan.receives.reduce(
        (sum, entry) => sum + entry.amount,
        0
      );

      // Calculate pending payments sent by current user
      const pendingSent = settlements
        .filter(s => s.payerId === fullUserId && s.status === 'pending')
        .reduce((sum, s) => sum + toMinor(s.amount, currency), 0);

      const effectiveOwe = Math.max(0, totalOwe - pendingSent);
      const isPendingSettlement = totalOwe > 0 && effectiveOwe === 0;

      const totalSpentMajor = expenses.reduce(
        (sum, expense) => sum + expense.amount,
        0
      );
      const totalSpentMinor = expenses.reduce(
        (sum, expense) => sum + (expense.amountMinor ?? 0),
        0
      );

      let status: "owed" | "owe" | "settled" | "pending_settlement";
      if (totalGotten > 0) status = "owed";
      else if (isPendingSettlement) status = "pending_settlement";
      else if (totalOwe > 0) status = "owe";
      else status = "settled";

      return {
        group,
        expenses,
        settlements,
        currency,
        totalSpentMajor,
        totalSpentMinor,
        totalOwe,
        totalGotten,
        pendingSent,
        isPendingSettlement,
        status,
      };
    });
  }, [groups, expensesByGroup, settlementsByGroup, fullUserId]);

  const sortedSummaries = useMemo(() => {
    const statusPriority: Record<GroupSummary["status"], number> = {
      owed: 0,
      owe: 1,
      pending_settlement: 2,
      settled: 3,
    };
    return [...groupSummaries].sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      if (a.status === "owed") {
        return b.totalGotten - a.totalGotten;
      }
      if (a.status === "owe") {
        return b.totalOwe - a.totalOwe;
      }
      return a.group.name.localeCompare(b.group.name);
    });
  }, [groupSummaries]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const summaryIds = useMemo(
    () => sortedSummaries.map(({ group }) => group.id).join("|"),
    [sortedSummaries]
  );

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;
      for (const summary of sortedSummaries) {
        if (summary.group.id in prev) {
          next[summary.group.id] = prev[summary.group.id];
        } else {
          // Expand if meaningful activity (owe, owed, or pending)
          next[summary.group.id] = summary.status !== "settled";
          changed = true;
        }
      }
      for (const key of Object.keys(prev)) {
        if (!sortedSummaries.some(({ group }) => group.id === key)) {
          changed = true;
        }
      }
      if (!changed) {
        return prev;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryIds]);

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !(prev[groupId] ?? false),
    }));
  };

  if (sortedSummaries.length === 0) {
    return (
      <Card className="rounded-3xl border border-slate-200 bg-white/95 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            You don’t have any groups yet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <p>Spin up your first tab to start splitting expenses with friends.</p>
          <Button
            onClick={onCreateGroup}
            variant="outline"
            className={cn(
              "text-sm font-semibold",
              isNight
                ? "bg-violet-500/90 text-slate-900 hover:bg-violet-400 border-transparent"
                : "border-violet-200 text-violet-700 hover:bg-violet-50"
            )}
          >
            Create a group
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Your groups
          </h2>
          <p className="text-sm text-slate-500">
            Track balances, share tabs, and jump back into expenses.
          </p>
        </div>
        <Button
          onClick={onCreateGroup}
          variant="outline"
          className={cn(
            "text-sm font-semibold",
            isNight
              ? "bg-violet-500/90 text-slate-900 hover:bg-violet-400 border-transparent"
              : "border-violet-200 text-violet-700 hover:bg-violet-50"
          )}
        >
          New group
        </Button>
      </div>

      <div className="space-y-4">
        {sortedSummaries.map((summary) => {
          const { group, currency, totalSpentMajor, totalSpentMinor, totalOwe, totalGotten, settlements, isPendingSettlement } = summary;
          const expanded = expandedGroups[group.id] ?? false;
          const statusSummary =
            totalGotten > 0
              ? `Money owed to you: ${formatMoney(totalGotten, currency)}`
              : isPendingSettlement
                ? `Settlement pending approval`
                : totalOwe > 0
                  ? `You owe: ${formatMoney(totalOwe, currency)}`
                  : "Everything’s settled";

          return (
            <Card
              key={group.id}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-sm transition hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => toggleGroupExpansion(group.id)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <div>
                  <p className="text-base font-semibold text-slate-900">{group.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Ping if there are incoming pending settlements for me */}
                  {settlements.some(s => s.status === 'pending' && s.payeeId === fullUserId) && (
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </span>
                  )}
                  {statusBadge(totalOwe, totalGotten, isPendingSettlement, currency)}
                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {expanded ? (
                <CardContent className="space-y-6 border-t border-slate-100 px-6 py-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600">{memberLabel(group.members.length)}</p>
                      <p className="text-xs text-slate-500">{statusSummary}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-600 hover:text-slate-900"
                        onClick={() => onEditGroup(group)}
                      >
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-600 hover:text-slate-900"
                        onClick={() => onShareGroup(group)}
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        Share
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          "text-sm font-semibold",
                          isNight
                            ? "bg-emerald-500/90 text-slate-900 hover:bg-emerald-400 border-transparent"
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        )}
                        onClick={() => onSelectGroup(group)}
                      >
                        Open group
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn("text-red-500 hover:text-red-700 hover:bg-red-50")}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
                            onDeleteGroup(group);
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-3">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Total spent
                      </p>
                      <p className="text-xl font-semibold text-slate-900">
                        {formatMoneyWithMinor(totalSpentMajor, totalSpentMinor, currency)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Includes all recorded expenses and receipts.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Your position
                      </p>
                      {totalOwe > 0 && !isPendingSettlement ? (
                        <p className="text-lg font-semibold text-amber-600">
                          You owe {formatMoney(totalOwe, currency)}
                        </p>
                      ) : isPendingSettlement ? (
                        <div className="flex flex-col">
                          <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
                            Settlement Pending
                          </p>
                          <p className="text-xs text-indigo-500/80 dark:text-indigo-400/80">
                            Waiting for approval for {formatMoney(summary.pendingSent, currency)}
                          </p>
                        </div>
                      ) : totalGotten > 0 ? (
                        <p className="text-lg font-semibold text-emerald-600">
                          You’re owed {formatMoney(totalGotten, currency)}
                        </p>
                      ) : (
                        <p className="text-lg font-semibold text-slate-700">Settled up</p>
                      )}

                      {!isPendingSettlement && (
                        <p className="text-xs text-slate-500">
                          Balances account for past settlements in this group.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Quick actions
                      </p>
                      {isPendingSettlement ? (
                        <Button
                          variant="outline"
                          onClick={() => onSettleClick(group)}
                          className="justify-start border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        >
                          View status
                        </Button>
                      ) : totalOwe > 0 ? (
                        <Button
                          onClick={() => onSettleClick(group)}
                          className="justify-start bg-slate-900 text-white hover:bg-slate-800"
                        >
                          Settle up now
                        </Button>
                      ) : totalGotten > 0 ? (
                        <Button
                          variant="outline"
                          className="justify-start border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => onMarkSettledClick(group)}
                        >
                          Mark money received
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="justify-start border-slate-200 text-slate-600 hover:bg-slate-50"
                          onClick={() => onMarkSettledClick(group)}
                        >
                          Record a settlement
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        className="justify-start text-slate-600 hover:text-slate-900"
                        onClick={() => onSelectGroup(group)}
                      >
                        View expense history
                      </Button>
                    </div>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
