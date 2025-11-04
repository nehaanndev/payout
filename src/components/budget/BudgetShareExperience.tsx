"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ExternalLink, RefreshCcw } from "lucide-react";

import {
  fetchBudgetDocument,
  fetchBudgetMonthSnapshot,
  listBudgetMonthKeys,
} from "@/lib/budgetService";
import {
  BudgetCustomCategory,
  BudgetDocument,
  BudgetLedgerEntry,
  BudgetMonth,
} from "@/types/budget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const DEFAULT_CATEGORIES: Array<{
  id: string;
  value: string;
  label: string;
  emoji?: string | null;
}> = [
  { id: "dining", value: "Dining", label: "Dining", emoji: "🍔" },
  { id: "groceries", value: "Groceries", label: "Groceries", emoji: "🛒" },
  { id: "travel", value: "Travel", label: "Travel", emoji: "🚗" },
  { id: "utilities", value: "Utilities", label: "Utilities", emoji: "💡" },
  { id: "rent", value: "Rent", label: "Rent", emoji: "🏠" },
  { id: "misc", value: "Misc", label: "Misc", emoji: "💳" },
];

type CategoryDescriptor = {
  value: string;
  label: string;
  emoji?: string | null;
};

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

const sortMonthKeys = (keys: Iterable<string>) =>
  Array.from(new Set(keys)).sort(
    (a, b) =>
      new Date(`${b}-01`).getTime() - new Date(`${a}-01`).getTime()
  );

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");
  const parsed = new Date(
    Number(year),
    Number.parseInt(month, 10) - 1,
    1
  );
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
};

const parseLedgerDate = (value?: string | null) => {
  if (!value) {
    return new Date();
  }
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return new Date();
  }
  return new Date(year, month - 1, day);
};

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const buildCategoryLookup = (
  customCategories: BudgetCustomCategory[] | undefined
) => {
  const map = new Map<string, CategoryDescriptor>();
  for (const category of DEFAULT_CATEGORIES) {
    map.set(category.value.toLowerCase(), {
      value: category.value,
      label: category.label,
      emoji: category.emoji,
    });
  }
  if (Array.isArray(customCategories)) {
    for (const category of customCategories) {
      const value = category.value?.trim();
      if (!value) {
        continue;
      }
      const lower = value.toLowerCase();
      if (map.has(lower)) {
        continue;
      }
      map.set(lower, {
        value,
        label: category.label || value,
        emoji: category.emoji ?? null,
      });
    }
  }
  return map;
};

const groupEntriesByDay = (entries: BudgetLedgerEntry[]) => {
  const grouped = new Map<
    string,
    {
      date: Date;
      entries: BudgetLedgerEntry[];
    }
  >();
  for (const entry of entries) {
    const date = parseLedgerDate(entry.date);
    const iso = [
      String(date.getFullYear()).padStart(4, "0"),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const existing = grouped.get(iso);
    if (existing) {
      existing.entries.push(entry);
    } else {
      grouped.set(iso, { date, entries: [entry] });
    }
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([iso, payload]) => ({
      iso,
      label: formatDayLabel(payload.date),
      entries: payload.entries
        .slice()
        .sort(
          (left, right) =>
            parseLedgerDate(right.date).getTime() -
            parseLedgerDate(left.date).getTime()
        ),
    }));
};

const computeCategorySummaries = (
  entries: BudgetLedgerEntry[],
  categories: Map<string, CategoryDescriptor>
) => {
  const map = new Map<
    string,
    {
      value: string;
      label: string;
      emoji?: string | null;
      total: number;
      count: number;
    }
  >();
  for (const entry of entries) {
    const key = (entry.category ?? "Uncategorized").toLowerCase();
    const descriptor =
      categories.get(key) ?? {
        value: entry.category ?? "Uncategorized",
        label: entry.category ?? "Uncategorized",
        emoji: null,
      };
    const existing = map.get(key);
    if (existing) {
      existing.total += entry.amount ?? 0;
      existing.count += 1;
    } else {
      map.set(key, {
        value: descriptor.value,
        label: descriptor.label,
        emoji: descriptor.emoji,
        total: entry.amount ?? 0,
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

type ShareExperienceProps = {
  shareCode: string;
  initialMonth?: string;
};

const BudgetShareExperience = ({ shareCode, initialMonth }: ShareExperienceProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [budget, setBudget] = useState<BudgetDocument | null>(null);
  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthData, setMonthData] = useState<BudgetMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthLoading, setMonthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const [doc, keys] = await Promise.all([
          fetchBudgetDocument(shareCode),
          listBudgetMonthKeys(shareCode),
        ]);

        if (cancelled) {
          return;
        }

        if (!doc) {
          setError("We couldn’t find that shared budget.");
          setBudget(null);
          setMonthKeys([]);
          setSelectedMonth(null);
          setMonthData(null);
          return;
        }

        const sortedKeys = sortMonthKeys(keys);
        setBudget(doc);
        setMonthKeys(sortedKeys);

        const paramMonth =
          initialMonth && sortedKeys.includes(initialMonth)
            ? initialMonth
            : null;
        const fallbackMonth = paramMonth ?? sortedKeys[0] ?? null;
        setSelectedMonth((prev) => prev ?? fallbackMonth);
      } catch (err) {
        console.error("Failed to load shared budget:", err);
        if (!cancelled) {
          setError("We couldn’t open this shared budget.");
          setBudget(null);
          setMonthKeys([]);
          setSelectedMonth(null);
          setMonthData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [initialMonth, shareCode]);

  useEffect(() => {
    if (!shareCode || !selectedMonth) {
      setMonthData(null);
      return;
    }
    let cancelled = false;
    setMonthLoading(true);
    setError(null);

    const loadMonth = async () => {
      try {
        const snapshot = await fetchBudgetMonthSnapshot(
          shareCode,
          selectedMonth
        );
        if (cancelled) {
          return;
        }
        if (!snapshot) {
          setError("This month doesn’t have any shared entries yet.");
          setMonthData(null);
          return;
        }
        setMonthData(snapshot);
      } catch (err) {
        console.error("Failed to load shared month:", err);
        if (!cancelled) {
          setError("We couldn’t load that month.");
          setMonthData(null);
        }
      } finally {
        if (!cancelled) {
          setMonthLoading(false);
        }
      }
    };

    void loadMonth();

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, shareCode]);

  const handleSelectMonth = useCallback(
    (monthKey: string) => {
      setSelectedMonth(monthKey);
      const params = new URLSearchParams(searchParams ?? undefined);
      params.set("month", monthKey);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const refreshData = useCallback(() => {
    setError(null);
    router.refresh();
  }, [router]);

  const categoryLookup = useMemo(
    () => buildCategoryLookup(budget?.customCategories),
    [budget?.customCategories]
  );

  const entries = useMemo<BudgetLedgerEntry[]>(() => {
    if (!monthData?.entries?.length) {
      return [];
    }
    return monthData.entries
      .slice()
      .sort(
        (a, b) =>
          parseLedgerDate(b.date).getTime() - parseLedgerDate(a.date).getTime()
      );
  }, [monthData]);

  const groupedEntries = useMemo(
    () => groupEntriesByDay(entries),
    [entries]
  );

  const totalSpent = useMemo(
    () => entries.reduce((sum, entry) => sum + (entry.amount ?? 0), 0),
    [entries]
  );

  const totalIncome = useMemo(() => {
    if (!monthData?.incomes?.length) {
      return 0;
    }
    return monthData.incomes.reduce(
      (sum, income) => sum + (income.amount ?? 0),
      0
    );
  }, [monthData?.incomes]);

  const recurringFixed = useMemo(() => {
    if (!monthData?.fixeds?.length) {
      return 0;
    }
    return monthData.fixeds
      .filter((item) => item.enabled)
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  }, [monthData?.fixeds]);

  const categorySummaries = useMemo(
    () => computeCategorySummaries(entries, categoryLookup),
    [categoryLookup, entries]
  );

  const monthLabel = selectedMonth ? formatMonthLabel(selectedMonth) : null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !budget) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-md border border-rose-200 bg-white/90 p-6 text-center shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-rose-700">
              Shared budget unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-rose-600">
            <p>{error}</p>
            <Button
              variant="outline"
              onClick={refreshData}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" /> Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card className="border border-slate-200 bg-white/90 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-col gap-2 text-xl font-semibold text-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {budget?.title ?? "Shared Budget"}{" "}
                {monthLabel ? (
                  <span className="text-base font-normal text-slate-500">
                    · {monthLabel}
                  </span>
                ) : null}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <ExternalLink className="h-3.5 w-3.5" />
                Read-only share
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Total spent
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatCurrency(totalSpent)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Monthly income
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatCurrency(totalIncome)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Recurring bills
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatCurrency(recurringFixed)}
                </div>
              </div>
            </div>

            {monthKeys.length > 1 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                  Choose a month to review the ledger snapshot.
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="share-month-select" className="text-xs uppercase tracking-wide text-slate-500">
                    Month
                  </Label>
                  <Select
                    value={selectedMonth ?? undefined}
                    onValueChange={handleSelectMonth}
                  >
                    <SelectTrigger id="share-month-select" className="w-48">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthKeys.map((monthKey) => (
                        <SelectItem key={monthKey} value={monthKey}>
                          {formatMonthLabel(monthKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {categorySummaries.length ? (
          <Card className="border border-slate-200 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-slate-900">
                Category snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categorySummaries.map((summary) => (
                <div
                  key={summary.value.toLowerCase()}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {summary.emoji ?? "🏷️"}
                    </span>
                    <span className="text-sm font-medium text-slate-700">
                      {summary.label}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatCurrency(summary.total)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border border-slate-200 bg-white/95 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Ledger entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthLoading ? (
              <div className="flex w-full items-center justify-center py-10">
                <Spinner size="md" />
              </div>
            ) : error && !entries.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-6 text-sm text-amber-700">
                {error}
              </div>
            ) : groupedEntries.length ? (
              <div className="space-y-4">
                {groupedEntries.map((group) => (
                  <div key={group.iso} className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {group.label}
                    </div>
                    <div className="divide-y rounded-2xl border border-slate-200 bg-white">
                      {group.entries.map((entry) => {
                        const category =
                          categoryLookup.get(entry.category.toLowerCase()) ??
                          null;
                        const tags = Array.isArray(entry.tags)
                          ? entry.tags
                          : [];
                        return (
                          <div
                            key={entry.id}
                            className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                                <span className="mr-1">
                                  {category?.emoji ?? "🏷️"}
                                </span>
                                {category?.label ?? entry.category ?? "—"}
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">
                                  {entry.merchant || "—"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {formatDayLabel(parseLedgerDate(entry.date))}
                                </div>
                                {entry.isOneTime ? (
                                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    One-time
                                  </div>
                                ) : null}
                                {tags.length ? (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {tags.map((tag) => (
                                      <span
                                        key={`${entry.id}-tag-${tag}`}
                                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                      >
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="text-right text-lg font-semibold text-slate-900">
                              {formatCurrency(entry.amount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center text-sm text-slate-500">
                No ledger entries were shared for this month yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BudgetShareExperience;
