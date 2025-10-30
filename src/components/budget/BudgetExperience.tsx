"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Receipt,
  Trash2,
  Wallet,
  X,
  Upload,
} from "lucide-react";
import { User, onAuthStateChanged } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBudgetDocument,
  ensureMemberOnBudget,
  fetchBudgetDocument,
  fetchBudgetMonth,
  listBudgetMonthKeys,
  getMonthKey,
  saveBudgetMonth,
  saveBudgetMetadata,
} from "@/lib/budgetService";
import { auth } from "@/lib/firebase";
import { generateId } from "@/lib/id";
import {
  BudgetDocument,
  BudgetCategoryRule,
  BudgetCustomCategory,
  BudgetFixedExpense,
  BudgetIncome,
  BudgetLedgerEntry,
  BudgetMember,
  BudgetMonth,
  BudgetGoal,
} from "@/types/budget";

type Mode = "wizard" | "ledger";

type WizardStep = 0 | 1 | 2 | 3 | 4;

type BudgetState = {
  incomes: BudgetIncome[];
  fixeds: BudgetFixedExpense[];
  entries: BudgetLedgerEntry[];
  customCategories: BudgetCustomCategory[];
  categoryRules: BudgetCategoryRule[];
  savingsTarget: number;
  goals: BudgetGoal[];
};

type LedgerEntryDraft = {
  amount: number;
  category: string;
  merchant?: string;
  date?: string;
  isOneTime?: boolean;
  tags?: string[];
};

type CategoryOption = {
  id: string;
  value: string;
  label: string;
  emoji?: string | null;
  isDefault?: boolean;
  memberId?: string | null;
  createdAt?: string;
};

type CategoryRuleOperator = BudgetCategoryRule["operator"];

type CategoryRuleInput = {
  pattern: string;
  operator: CategoryRuleOperator;
  categoryValue: string;
};

type CategorySummary = {
  value: string;
  label: string;
  emoji?: string | null;
  total: number;
  recurringTotal: number;
  oneTimeTotal: number;
};

type NextMonthTarget = {
  value: string;
  label: string;
  emoji?: string | null;
  suggestedAmount: number;
};

type GoalProjection = {
  goal: BudgetGoal;
  normalized: BudgetGoal;
  remainingAmount: number;
  monthsToGoal: number | null;
  projectedCompletionDate: string | null;
};

type PaceStats = {
  daysOnPace: number;
  currentStreak: number;
  bestStreak: number;
  evaluationEndDay: number;
  daysInMonth: number;
  onPaceToday: boolean;
  projectedMonthlySpend: number;
};

const ruleMatches = (
  rule: BudgetCategoryRule,
  merchant: string | null | undefined
) => {
  if (!merchant) {
    return false;
  }
  const merchantLower = merchant.toLowerCase();
  const pattern = rule.pattern.toLowerCase();
  switch (rule.operator) {
    case "equals":
      return merchantLower === pattern;
    case "starts_with":
      return merchantLower.startsWith(pattern);
    default:
      return merchantLower.includes(pattern);
  }
};

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

const parseMonthKey = (monthKey: string | null | undefined) => {
  if (!monthKey) {
    return null;
  }
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return null;
  }
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return { year, monthIndex, daysInMonth };
};

const formatDateParts = (date: Date, useUTC = false) => {
  const year = useUTC ? date.getUTCFullYear() : date.getFullYear();
  const monthIndex = useUTC ? date.getUTCMonth() : date.getMonth();
  const day = useUTC ? date.getUTCDate() : date.getDate();

  return [
    String(year).padStart(4, "0"),
    String(monthIndex + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
};

const formatDateInput = (date: Date) => formatDateParts(date);

const DEFAULT_CATEGORIES: CategoryOption[] = [
  { id: "dining", value: "Dining", label: "Dining", emoji: "🍔", isDefault: true },
  { id: "groceries", value: "Groceries", label: "Groceries", emoji: "🛒", isDefault: true },
  { id: "travel", value: "Travel", label: "Travel", emoji: "🚗", isDefault: true },
  { id: "utilities", value: "Utilities", label: "Utilities", emoji: "💡", isDefault: true },
  { id: "rent", value: "Rent", label: "Rent", emoji: "🏠", isDefault: true },
  { id: "misc", value: "Misc", label: "Misc", emoji: "💳", isDefault: true },
];

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  Dining: [
    "dining",
    "restaurant",
    "restaurants",
    "food",
    "food & drink",
    "eatery",
    "meal",
    "meals",
    "cafe",
    "coffee",
    "bar",
  ],
  Groceries: ["groceries", "supermarket", "grocery", "market", "food store"],
  Travel: ["travel", "transportation", "uber", "lyft", "taxi", "ride", "gas"],
  Utilities: [
    "utilities",
    "electric",
    "electricity",
    "gas bill",
    "water",
    "internet",
    "phone",
    "cell",
  ],
  Rent: ["rent", "mortgage", "housing", "lease"],
  Misc: ["misc", "other", "uncategorized", "fees", "service"],
};

const normaliseCategory = (
  raw: string | null | undefined,
  categories: CategoryOption[]
): string => {
  if (!raw) {
    return "Misc";
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return "Misc";
  }
  const lower = trimmed.toLowerCase();

  const directMatch = categories.find(
    (category) => category.value.toLowerCase() === lower
  );
  if (directMatch) {
    return directMatch.value;
  }

  for (const [canonical, terms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (terms.some((term) => lower.includes(term))) {
      return canonical;
    }
  }

  const defaultMatch = DEFAULT_CATEGORIES.find(
    (category) => category.value.toLowerCase() === lower
  );
  return defaultMatch?.value ?? trimmed;
};

const SUPPORTED_IMPORT_EXTENSIONS = [".csv", ".tsv", ".xlsx", ".xls"];
const NO_DATE_COLUMN_VALUE = "__no_date_column__";
const NO_TAG_COLUMN_VALUE = "__no_tag_column__";

const guessHeader = (headers: string[], keywords: string[]) => {
  const lower = headers.map((header) => header.toLowerCase());
  for (const keyword of keywords) {
    const index = lower.findIndex((value) => value.includes(keyword));
    if (index !== -1) {
      return headers[index];
    }
  }
  return "";
};

const parseSpreadsheetFile = async (
  file: File
): Promise<{ headers: string[]; rows: string[][] }> => {
  const extension = file.name.toLowerCase();
  const XLSX = await import("xlsx");
  let workbook;
  if (extension.endsWith(".csv") || extension.endsWith(".tsv")) {
    const text = await file.text();
    workbook = XLSX.read(text, { type: "string", raw: false });
  } else if (SUPPORTED_IMPORT_EXTENSIONS.some((ext) => extension.endsWith(ext))) {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array", raw: false });
  } else {
    throw new Error("Unsupported file type. Upload a CSV or Excel file.");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("No worksheets found in the uploaded file.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
  }) as Array<Array<string | number | null | undefined>>;

  if (!rows.length) {
    throw new Error("The uploaded file appears to be empty.");
  }

  const headerRow = rows[0] ?? [];
  const headers = headerRow.map((cell, index) => {
    if (cell === null || cell === undefined || String(cell).trim() === "") {
      return `Column ${index + 1}`;
    }
    return String(cell).trim();
  });

  const dataRows = rows
    .slice(1)
    .map((row) =>
      headers.map((_, index) => {
        const value = row?.[index];
        if (value === null || value === undefined) {
          return "";
        }
        return String(value).trim();
      })
    )
    .filter((row) => row.some((value) => value !== ""));

  return { headers, rows: dataRows };
};

const coerceAmount = (value: unknown): number => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return Number.NaN;
  }
  let normalised = value.trim();
  if (!normalised) {
    return Number.NaN;
  }
  const negativeMatch = normalised.match(/^\((.*)\)$/);
  if (negativeMatch) {
    normalised = `-${negativeMatch[1]}`;
  }
  normalised = normalised.replace(/[^\d,.\-]/g, "");
  if (!normalised) {
    return Number.NaN;
  }
  if (normalised.includes(",") && !normalised.includes(".")) {
    normalised = normalised.replace(",", ".");
  } else {
    normalised = normalised.replace(/,/g, "");
  }
  const parsed = parseFloat(normalised);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const coerceDateInput = (value: unknown): string | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(excelEpoch.getTime())) {
      return formatDateParts(excelEpoch, true);
    }
  }
  const asString = String(value).trim();
  if (!asString) {
    return undefined;
  }
  const hasExplicitTimezone =
    /[Tt]/.test(asString) && (asString.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(asString));
  const ymdMatch = asString.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const [, yearStr, monthStr, dayStr] = ymdMatch;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return [
        String(year).padStart(4, "0"),
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0"),
      ].join("-");
    }
  }
  const parsed = new Date(asString);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateParts(parsed, hasExplicitTimezone);
  }
  return undefined;
};

const normalizeDraftDate = (value: string | undefined | null): Date => {
  if (!value) {
    return new Date();
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, yearStr, monthStr, dayStr] = match;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day)
    ) {
      return new Date(year, month - 1, day);
    }
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const hasExplicitTimezone =
      /[Tt]/.test(value) &&
      (value.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(value));
    if (hasExplicitTimezone) {
      return new Date(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate()
      );
    }
    return parsed;
  }
  return new Date();
};

const sortLedgerEntries = (entries: BudgetLedgerEntry[]) =>
  entries
    .slice()
    .sort(
      (a, b) =>
        normalizeDraftDate(b.date).getTime() -
        normalizeDraftDate(a.date).getTime()
    );

const normaliseTags = (
  tags: Array<string | null | undefined>
): string[] => {
  const map = new Map<string, string>();
  for (const tag of tags) {
    if (!tag) continue;
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!map.has(key)) {
      map.set(key, trimmed);
    }
  }
  return Array.from(map.values());
};

const formatGoalCompletionDate = (iso: string | null): string | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
};

const normalizeGoalRecord = (goal: BudgetGoal): BudgetGoal => {
  const targetAmount = Math.max(0, Number(goal.targetAmount) || 0);
  const currentBalance = Number(goal.currentBalance) || 0;
  const monthlyContribution = Math.max(
    0,
    Number(goal.monthlyContribution) || 0
  );
  const name = goal.name?.trim?.() ?? goal.name ?? "";
  return {
    ...goal,
    name,
    targetAmount,
    currentBalance: Math.min(Math.max(0, currentBalance), targetAmount),
    monthlyContribution,
  };
};

const currency = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

const defaultState = (): BudgetState => ({
  incomes: [{ id: generateId(), source: "Salary", amount: 5200 }],
  fixeds: [
    {
      id: generateId(),
      name: "Rent/Mortgage",
      amount: 1850,
      enabled: true,
    },
    { id: generateId(), name: "Car Payment", amount: 350, enabled: true },
    { id: generateId(), name: "Utilities", amount: 150, enabled: true },
    { id: generateId(), name: "Insurance", amount: 120, enabled: false },
    { id: generateId(), name: "Credit Card", amount: 480, enabled: true },
  ],
  entries: sortLedgerEntries([
    {
      id: generateId(),
      amount: 28,
      category: "Dining",
      merchant: "Starbucks",
      date: new Date().toISOString(),
      tags: ["Morning"],
    },
    {
      id: generateId(),
      amount: 120,
      category: "Groceries",
      merchant: "Grocery Outlet",
      date: new Date().toISOString(),
      tags: ["Weekly"],
    },
  ]),
  customCategories: [],
  categoryRules: [],
  savingsTarget: 0,
  goals: [],
});

const isClient = () => typeof window !== "undefined";

const getLocalMember = (): BudgetMember => {
  if (!isClient()) {
    return { id: "guest", email: null, name: "Guest User" };
  }
  const stored = window.localStorage.getItem("toodl_budget_member");
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as BudgetMember;
      if (parsed.id) {
        return parsed;
      }
    } catch {
      // ignore bad data
    }
  }
  const member = {
    id: `anon-${generateId()}`,
    email: null,
    name: "Guest User",
  };
  window.localStorage.setItem("toodl_budget_member", JSON.stringify(member));
  return member;
};

const BudgetExperience = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<BudgetMember | null>(null);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("wizard");
  const [step, setStep] = useState<WizardStep>(0);
  const [state, setState] = useState<BudgetState>(defaultState);
  const [budgetDoc, setBudgetDoc] = useState<BudgetDocument | null>(null);
  const [monthMeta, setMonthMeta] = useState<Pick<
    BudgetMonth,
    "id" | "createdAt" | "updatedAt" | "initializedFrom"
  > | null>(null);
  const hasHydrated = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [invalidBudget, setInvalidBudget] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [activeMonthKey, setActiveMonthKey] = useState<string>(() =>
    getMonthKey()
  );
  const initialMonthFromUrl = useRef<string | null>(null);
  const lastUrlMonthRef = useRef<string | null>(null);
  const lastUrlStateRef = useRef<{ id: string | null; month: string | null }>(
    {
      id: null,
      month: null,
    }
  );
  const lastHydrated = useRef<{ budgetId: string | null; month: string | null }>(
    {
      budgetId: null,
      month: null,
    }
  );

  const availableCategories = useMemo(() => {
    const seen = new Set<string>();
    const combined: CategoryOption[] = [];

    for (const option of DEFAULT_CATEGORIES) {
      const key = option.value.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(option);
      }
    }

    for (const category of state.customCategories) {
      const value = category.value.trim();
      if (!value) {
        continue;
      }
      const key = value.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      combined.push({
        id: category.id,
        value,
        label: category.label || value,
        emoji: category.emoji ?? null,
        memberId: category.memberId ?? null,
        createdAt: category.createdAt,
      });
    }

    return combined;
  }, [state.customCategories]);


  const memberRules = useMemo(() => {
    return state.categoryRules
      .filter((rule) => {
        if (!rule.memberId) {
          return true;
        }
        return rule.memberId === member?.id;
      })
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [member?.id, state.categoryRules]);

  const applyCategoryRulesToDraft = useCallback(
    (draft: LedgerEntryDraft): LedgerEntryDraft => {
      if (!memberRules.length) {
        return draft;
      }
      for (const rule of memberRules) {
        if (ruleMatches(rule, draft.merchant)) {
          return { ...draft, category: rule.categoryValue };
        }
      }
      return draft;
    },
    [memberRules]
  );

  const applyCategoryRulesToEntry = useCallback(
    (entry: BudgetLedgerEntry): BudgetLedgerEntry => {
      const normalizedEntry: BudgetLedgerEntry = {
        ...entry,
        isOneTime: Boolean(entry.isOneTime),
        tags: normaliseTags(Array.isArray(entry.tags) ? entry.tags : []),
      };
      if (!memberRules.length) {
        return normalizedEntry;
      }
      for (const rule of memberRules) {
        if (ruleMatches(rule, entry.merchant)) {
          return {
            ...normalizedEntry,
            category: normaliseCategory(rule.categoryValue, availableCategories),
          };
        }
      }
      return normalizedEntry;
    },
    [availableCategories, memberRules]
  );

  const deriveStateFromMonth = useCallback(
    (month: BudgetMonth, doc: BudgetDocument | null): BudgetState => ({
      incomes: month.incomes.length ? month.incomes : defaultState().incomes,
      fixeds: month.fixeds.length ? month.fixeds : defaultState().fixeds,
      entries: sortLedgerEntries(
        (month.entries ?? []).map(applyCategoryRulesToEntry)
      ),
      customCategories: doc?.customCategories ? [...doc.customCategories] : [],
      categoryRules: doc?.categoryRules ? [...doc.categoryRules] : [],
      savingsTarget: month.savingsTarget ?? 0,
      goals: doc?.goals ? doc.goals.map(normalizeGoalRecord) : [],
    }),
    [applyCategoryRulesToEntry]
  );

  const categorySummaries = useMemo(() => {
    if (!state.entries.length) {
      return [];
    }
    const aggregates = new Map<
      string,
      {
        value: string;
        total: number;
        oneTimeTotal: number;
        recurringTotal: number;
      }
    >();
    for (const entry of state.entries) {
      const value = entry.category || "Uncategorized";
      const normalized = value.toLowerCase();
      const amount = Number(entry.amount) || 0;
      const existing =
        aggregates.get(normalized) ??
        {
          value,
          total: 0,
          oneTimeTotal: 0,
          recurringTotal: 0,
        };
      existing.value = value;
      existing.total += amount;
      if (entry.isOneTime) {
        existing.oneTimeTotal += amount;
      } else {
        existing.recurringTotal += amount;
      }
      aggregates.set(normalized, existing);
    }
    return Array.from(aggregates.values())
      .map((summary) => {
        const match = availableCategories.find(
          (category) =>
            category.value.toLowerCase() === summary.value.toLowerCase()
        );
        return {
          value: summary.value,
          total: summary.total,
          oneTimeTotal: summary.oneTimeTotal,
          recurringTotal: summary.recurringTotal,
          label: match?.label ?? summary.value,
          emoji: match?.emoji ?? null,
        } satisfies CategorySummary;
      })
      .sort((a, b) => {
        if (b.recurringTotal === a.recurringTotal) {
          return b.total - a.total;
        }
        return b.recurringTotal - a.recurringTotal;
      });
  }, [availableCategories, state.entries]);

  const availableTags = useMemo(
    () =>
      normaliseTags(
        state.entries.flatMap((entry) =>
          Array.isArray(entry.tags) ? entry.tags : []
        )
      ),
    [state.entries]
  );

  const nextMonthTargets = useMemo<NextMonthTarget[]>(() => {
    if (!categorySummaries.length) {
      return [];
    }
    return categorySummaries
      .filter((summary) => summary.recurringTotal > 0)
      .map((summary) => ({
        value: summary.value,
        label: summary.label,
        emoji: summary.emoji ?? null,
        suggestedAmount: summary.recurringTotal,
      }));
  }, [categorySummaries]);

  const goalContributionTotal = useMemo(
    () =>
      state.goals.reduce(
        (sum, goal) => sum + (Number(goal.monthlyContribution) || 0),
        0
      ),
    [state.goals]
  );

  const goalProjections = useMemo<GoalProjection[]>(() => {
    const baseDate = new Date();
    return state.goals.map((goal) => {
      const normalized = normalizeGoalRecord(goal);
      const remainingAmount = Math.max(
        0,
        normalized.targetAmount - normalized.currentBalance
      );
      let monthsToGoal: number | null = null;
      let projectedCompletionDate: string | null = null;
      if (remainingAmount === 0) {
        monthsToGoal = 0;
        projectedCompletionDate = baseDate.toISOString();
      } else if (normalized.monthlyContribution > 0) {
        monthsToGoal = Math.max(
          0,
          Math.ceil(remainingAmount / normalized.monthlyContribution)
        );
        const projected = new Date(
          baseDate.getFullYear(),
          baseDate.getMonth() + (monthsToGoal || 0),
          1
        );
        projectedCompletionDate = projected.toISOString();
      }
      return {
        goal,
        normalized,
        remainingAmount,
        monthsToGoal,
        projectedCompletionDate,
      };
    });
  }, [state.goals]);

  const upsertCustomCategory = useCallback(
    (label: string, emoji?: string | null): CategoryOption | null => {
      const trimmed = label.trim();
      if (!trimmed) {
        return null;
      }
      const normalizedValue = trimmed.replace(/\s+/g, " ");
      const lower = normalizedValue.toLowerCase();

      const defaultMatch = DEFAULT_CATEGORIES.find(
        (category) => category.value.toLowerCase() === lower
      );
      if (defaultMatch) {
        return defaultMatch;
      }

      const existing = state.customCategories.find(
        (category) => category.value.toLowerCase() === lower
      );
      if (existing) {
        if (emoji !== undefined && emoji !== existing.emoji) {
          setState((prev) => ({
            ...prev,
            customCategories: prev.customCategories.map((category) =>
              category.id === existing.id
                ? { ...category, emoji: emoji ?? null }
                : category
            ),
          }));
        }
        return {
          id: existing.id,
          value: existing.value,
          label: existing.label || existing.value,
          emoji: emoji ?? existing.emoji ?? null,
          memberId: existing.memberId ?? null,
          createdAt: existing.createdAt,
        };
      }

      const newCategory: BudgetCustomCategory = {
        id: generateId(),
        value: normalizedValue,
        label: normalizedValue,
        emoji: emoji ?? null,
        memberId: member?.id ?? null,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        customCategories: [...prev.customCategories, newCategory],
      }));

      return {
        id: newCategory.id,
        value: newCategory.value,
        label: newCategory.label,
        emoji: newCategory.emoji,
        memberId: newCategory.memberId,
        createdAt: newCategory.createdAt,
      };
    },
    [member?.id, state.customCategories]
  );

  const assignCategoryToEntry = useCallback(
    (entryId: string, categoryValue: string) => {
      const normalized = normaliseCategory(categoryValue, availableCategories);
      setState((prev) => ({
        ...prev,
        entries: prev.entries.map((entry) =>
          entry.id === entryId ? { ...entry, category: normalized } : entry
        ),
      }));
    },
    [availableCategories]
  );

  const setEntryOneTime = useCallback((entryId: string, isOneTime: boolean) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === entryId ? { ...entry, isOneTime } : entry
      ),
    }));
  }, []);

  const updateEntryTags = useCallback((entryId: string, tags: string[]) => {
    const normalised = normaliseTags(tags);
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === entryId ? { ...entry, tags: normalised } : entry
      ),
    }));
  }, []);

  const createCategoryRule = useCallback(
    ({ categoryValue, operator, pattern }: CategoryRuleInput): BudgetCategoryRule | null => {
      const normalizedPattern = pattern.trim().toLowerCase();
      if (!normalizedPattern) {
        return null;
      }
      const normalizedCategory = normaliseCategory(
        categoryValue,
        availableCategories
      );

      const existing = state.categoryRules.find(
        (rule) =>
          rule.memberId === (member?.id ?? null) &&
          rule.operator === operator &&
          rule.pattern.toLowerCase() === normalizedPattern
      );

      if (existing) {
        if (existing.categoryValue !== normalizedCategory) {
          const updatedRule: BudgetCategoryRule = {
            ...existing,
            categoryValue: normalizedCategory,
          };
          setState((prev) => ({
            ...prev,
            categoryRules: prev.categoryRules.map((rule) =>
              rule.id === existing.id ? updatedRule : rule
            ),
            entries: prev.entries.map((entry) =>
              ruleMatches(updatedRule, entry.merchant)
                ? { ...entry, category: normalizedCategory }
                : entry
            ),
          }));
          return updatedRule;
        }
        return existing;
      }

      const newRule: BudgetCategoryRule = {
        id: generateId(),
        memberId: member?.id ?? null,
        operator,
        pattern: normalizedPattern,
        categoryValue: normalizedCategory,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        categoryRules: [...prev.categoryRules, newRule],
        entries: prev.entries.map((entry) =>
          ruleMatches(newRule, entry.merchant)
            ? { ...entry, category: normalizedCategory }
            : entry
        ),
      }));

      return newRule;
    },
    [availableCategories, member?.id, state.categoryRules]
  );

  const createGoal = useCallback(
    (input: {
      name: string;
      targetAmount: number;
      currentBalance?: number;
      monthlyContribution?: number;
    }): BudgetGoal | null => {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        return null;
      }
      const nowIso = new Date().toISOString();
      const goal: BudgetGoal = normalizeGoalRecord({
        id: generateId(),
        name: trimmedName,
        targetAmount: Number(input.targetAmount) || 0,
        currentBalance: Number(input.currentBalance) || 0,
        monthlyContribution: Number(input.monthlyContribution) || 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      setState((prev) => ({
        ...prev,
        goals: [...prev.goals, goal],
      }));
      return goal;
    },
    []
  );

  const updateGoal = useCallback(
    (goalId: string, patch: Partial<BudgetGoal>) => {
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        goals: prev.goals.map((goal) => {
          if (goal.id !== goalId) {
            return goal;
          }
          const nextName =
            patch.name !== undefined ? patch.name.trim() : goal.name;
          return normalizeGoalRecord({
            ...goal,
            ...patch,
            name: nextName,
            updatedAt: nowIso,
          });
        }),
      }));
    },
    []
  );

  const deleteGoal = useCallback((goalId: string) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.filter((goal) => goal.id !== goalId),
    }));
  }, []);

  // Track auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  // Resolve member identity (signed-in user or local guest)
  useEffect(() => {
    if (user) {
      setMember({
        id: user.uid,
        name: user.displayName ?? "Signed User",
        email: user.email ?? null,
      });
    } else {
      setMember(getLocalMember());
    }
  }, [user]);

  // Sync budget id & month from search params.
  useEffect(() => {
    const param = searchParams.get("budget_id");
    if (param && param !== budgetId) {
      setBudgetId(param);
    }
    const monthParam = searchParams.get("month");
    if (monthParam) {
      initialMonthFromUrl.current = monthParam;
      if (monthParam !== lastUrlMonthRef.current) {
        lastUrlMonthRef.current = monthParam;
        if (monthParam !== activeMonthKey) {
          lastHydrated.current = { budgetId: param ?? budgetId, month: monthParam };
          setActiveMonthKey(monthParam);
        }
      }
    }
    lastUrlStateRef.current = {
      id: param ?? null,
      month: monthParam ?? null,
    };
  }, [activeMonthKey, budgetId, searchParams]);

  const persistBudgetToUrl = useCallback(
    (id: string, month: string) => {
      if (
        lastUrlStateRef.current.id === id &&
        lastUrlStateRef.current.month === month
      ) {
        return;
      }
      lastUrlStateRef.current = { id, month };
      const params = new URLSearchParams();
      params.set("budget_id", id);
      params.set("month", month);
      router.replace(`/budget?${params.toString()}`);
    },
    [router]
  );

  const handleSelectMonth = useCallback(
    async (nextMonthKey: string) => {
      if (!budgetId || nextMonthKey === activeMonthKey) {
        return;
      }
      setLoading(true);
      try {
        const month = await fetchBudgetMonth(budgetId, nextMonthKey);
        hasHydrated.current = false;
        setState(
          deriveStateFromMonth(
            { ...month, savingsTarget: month.savingsTarget ?? 0 },
            budgetDoc
          )
        );
        setMonthMeta({
          id: month.id,
          createdAt: month.createdAt,
          updatedAt: month.updatedAt,
          initializedFrom: month.initializedFrom ?? null,
        });
        setLastSavedAt(month.updatedAt);
        setActiveMonthKey(nextMonthKey);
        setCategoryFilter(null);
        setTagFilter(null);
        setAvailableMonths((prev) => sortMonthKeys([...prev, nextMonthKey]));
        persistBudgetToUrl(budgetId, nextMonthKey);
        lastHydrated.current = { budgetId, month: nextMonthKey };
        lastUrlMonthRef.current = nextMonthKey;
        lastUrlStateRef.current = { id: budgetId, month: nextMonthKey };
      } catch (error) {
        console.error("Failed to switch month:", error);
      } finally {
        setLoading(false);
      }
    },
    [activeMonthKey, budgetDoc, budgetId, deriveStateFromMonth, persistBudgetToUrl]
  );

  const hydrateBudget = useCallback(
    async (
      id: string,
      activeMember: BudgetMember,
      preferredMonth?: string | null
    ) => {
      setLoading(true);
      setInvalidBudget(false);
      try {
        const doc = await fetchBudgetDocument(id);
        if (!doc) {
          setInvalidBudget(true);
          setLoading(false);
          return;
        }

        await ensureMemberOnBudget(id, activeMember);
        let monthKeys = sortMonthKeys(await listBudgetMonthKeys(id));
        const targetMonthKey = preferredMonth || getMonthKey();
        if (!monthKeys.includes(targetMonthKey)) {
          monthKeys = sortMonthKeys([...monthKeys, targetMonthKey]);
        }
        const month = await fetchBudgetMonth(id, targetMonthKey);
        hasHydrated.current = false;
        setBudgetDoc(doc);
        setAvailableMonths(monthKeys);
        setActiveMonthKey(targetMonthKey);
        setState(deriveStateFromMonth(month, doc));
        setCategoryFilter(null);
        setTagFilter(null);
        setMonthMeta({
          id: month.id,
          createdAt: month.createdAt,
          updatedAt: month.updatedAt,
          initializedFrom: month.initializedFrom ?? null,
        });
        setLastSavedAt(month.updatedAt);
        setMode(month.entries.length ? "ledger" : "wizard");
        persistBudgetToUrl(id, targetMonthKey);
        lastHydrated.current = { budgetId: id, month: targetMonthKey };
      } catch (error) {
        console.error("Failed to load budget:", error);
        setInvalidBudget(true);
      } finally {
        setLoading(false);
      }
    },
    [deriveStateFromMonth, persistBudgetToUrl]
  );

  // Initialize budget if not specified.
  useEffect(() => {
    const bootstrap = async () => {
      if (!member) {
        return;
      }
      const preferredMonth = initialMonthFromUrl.current ?? activeMonthKey;

      if (
        budgetId &&
        lastHydrated.current.budgetId === budgetId &&
        lastHydrated.current.month === preferredMonth
      ) {
        return;
      }

      if (budgetId) {
        await hydrateBudget(budgetId, member, preferredMonth);
        initialMonthFromUrl.current = null;
        lastUrlMonthRef.current = preferredMonth ?? lastUrlMonthRef.current;
        lastUrlStateRef.current = { id: budgetId, month: preferredMonth ?? null };
        return;
      }

      // No budget id: create a fresh budget bound to this member.
      const newBudgetId = await createBudgetDocument(member);
      const initialMonth = getMonthKey();
      setBudgetId(newBudgetId);
      setActiveMonthKey(initialMonth);
      initialMonthFromUrl.current = initialMonth;
      persistBudgetToUrl(newBudgetId, initialMonth);
      await hydrateBudget(newBudgetId, member, initialMonth);
      initialMonthFromUrl.current = null;
    };

    bootstrap().catch((error) => {
      console.error("Failed to prepare budget:", error);
      setInvalidBudget(true);
      setLoading(false);
    });
  }, [activeMonthKey, budgetId, hydrateBudget, member, persistBudgetToUrl]);

  // Save changes whenever state updates.
  useEffect(() => {
    if (!budgetId || !monthMeta) {
      return;
    }
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }
    const updatedAt = new Date().toISOString();
    const monthPayload: BudgetMonth = {
      id: monthMeta.id,
      month: monthMeta.id,
      incomes: state.incomes,
      fixeds: state.fixeds,
      entries: state.entries,
      savingsTarget: state.savingsTarget,
      createdAt: monthMeta.createdAt,
      updatedAt,
      initializedFrom: monthMeta.initializedFrom ?? null,
    };
    const metadataPayload = {
      customCategories: state.customCategories,
      categoryRules: state.categoryRules,
      goals: state.goals,
      updatedAt,
    };

    let cancelled = false;
    setSaving(true);
    const timeout = setTimeout(() => {
      Promise.all([
        saveBudgetMonth(budgetId, monthPayload),
        saveBudgetMetadata(budgetId, metadataPayload),
      ])
        .then(() => {
          if (!cancelled) {
            setSaving(false);
            setLastSavedAt(updatedAt);
            setBudgetDoc((prev) =>
              prev
                ? {
                    ...prev,
                    customCategories: metadataPayload.customCategories,
                    categoryRules: metadataPayload.categoryRules,
                    goals: metadataPayload.goals,
                    updatedAt,
                  }
                : prev
            );
          }
        })
        .catch((error) => {
          console.error("Failed to save budget changes:", error);
          if (!cancelled) {
            setSaving(false);
          }
        });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    budgetId,
    monthMeta,
    state.entries,
    state.fixeds,
    state.incomes,
    state.customCategories,
    state.categoryRules,
    state.savingsTarget,
    state.goals,
  ]);

  const totalIncome = useMemo(
    () => state.incomes.reduce((sum, income) => sum + (income.amount || 0), 0),
    [state.incomes]
  );

  const totalFixed = useMemo(
    () =>
      state.fixeds
        .filter((item) => item.enabled)
        .reduce((sum, fixed) => sum + (fixed.amount || 0), 0),
    [state.fixeds]
  );

  const savingsTarget = state.savingsTarget || 0;
  const goalAllocationDelta = savingsTarget - goalContributionTotal;
  const flexBudget = Math.max(0, totalIncome - totalFixed - savingsTarget);

  const paceStats = useMemo<PaceStats>(() => {
    const monthDetails = parseMonthKey(activeMonthKey);
    if (!monthDetails) {
      return {
        daysOnPace: 0,
        currentStreak: 0,
        bestStreak: 0,
        evaluationEndDay: 0,
        daysInMonth: 0,
        onPaceToday: true,
        projectedMonthlySpend: 0,
      };
    }
    const { year, monthIndex, daysInMonth } = monthDetails;
    const today = new Date();
    const firstOfMonth = new Date(year, monthIndex, 1);
    let evaluationEndDay = daysInMonth;
    if (today.getFullYear() === year && today.getMonth() === monthIndex) {
      evaluationEndDay = today.getDate();
    } else if (today < firstOfMonth) {
      evaluationEndDay = 0;
    }

    const dailyTotals = new Array(daysInMonth).fill(0);
    state.entries.forEach((entry) => {
      const entryDate = normalizeDraftDate(entry.date);
      if (
        entryDate.getFullYear() === year &&
        entryDate.getMonth() === monthIndex
      ) {
        const day = entryDate.getDate();
        if (day >= 1 && day <= daysInMonth) {
          dailyTotals[day - 1] += entry.amount;
        }
      }
    });

    let cumulative = 0;
    let daysOnPace = 0;
    let runningStreak = 0;
    let bestStreak = 0;
    let currentStreak = 0;
    let onPaceToday = true;

    for (let day = 1; day <= evaluationEndDay; day++) {
      cumulative += dailyTotals[day - 1];
      const allowed = flexBudget * (day / daysInMonth);
      const onPace = cumulative <= allowed + 0.01;

      if (onPace) {
        daysOnPace += 1;
        runningStreak += 1;
        if (runningStreak > bestStreak) {
          bestStreak = runningStreak;
        }
      } else {
        runningStreak = 0;
      }

      if (day === evaluationEndDay) {
        onPaceToday = onPace;
        currentStreak = runningStreak;
      }
    }

    const averageDailySpend = evaluationEndDay > 0 ? cumulative / evaluationEndDay : 0;
    const projectedMonthlySpend = averageDailySpend * daysInMonth;

    return {
      daysOnPace,
      currentStreak,
      bestStreak: Math.max(bestStreak, currentStreak),
      evaluationEndDay,
      daysInMonth,
      onPaceToday,
      projectedMonthlySpend,
    };
  }, [activeMonthKey, flexBudget, state.entries]);

  const monthSpend = useMemo(
    () =>
      state.entries.reduce(
        (sum, entry) => sum + (Number(entry.amount) || 0),
        0
      ),
    [state.entries]
  );

  const recurringSpend = useMemo(
    () =>
      state.entries.reduce(
        (sum, entry) =>
          sum + (entry.isOneTime ? 0 : Number(entry.amount) || 0),
        0
      ),
    [state.entries]
  );

  const oneTimeSpend = useMemo(
    () => monthSpend - recurringSpend,
    [monthSpend, recurringSpend]
  );

  const remaining = Math.max(0, flexBudget - monthSpend);
  const progressPct =
    flexBudget === 0
      ? 0
      : Math.min(100, Math.round((monthSpend / flexBudget) * 100));

  const updateIncome = (idx: number, patch: Partial<BudgetIncome>) => {
    setState((prev) => {
      const next = [...prev.incomes];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, incomes: next };
    });
  };

  const removeIncome = (id: string) => {
    setState((prev) => ({
      ...prev,
      incomes: prev.incomes.filter((income) => income.id !== id),
    }));
  };

  const addIncome = () => {
    setState((prev) => ({
      ...prev,
      incomes: [
        ...prev.incomes,
        { id: generateId(), source: "", amount: 0 },
      ],
    }));
  };

  const updateFixed = (idx: number, patch: Partial<BudgetFixedExpense>) => {
    setState((prev) => {
      const next = [...prev.fixeds];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, fixeds: next };
    });
  };

  const removeFixed = (id: string) => {
    setState((prev) => ({
      ...prev,
      fixeds: prev.fixeds.filter((fixed) => fixed.id !== id),
    }));
  };

  const addFixed = () => {
    setState((prev) => ({
      ...prev,
      fixeds: [
        ...prev.fixeds,
        { id: generateId(), name: "", amount: 0, enabled: true },
      ],
    }));
  };

  const createEntryFromDraft = useCallback(
    (draft: LedgerEntryDraft): BudgetLedgerEntry | null => {
      const adjusted = applyCategoryRulesToDraft(draft);
      const amount = Number(adjusted.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }
      const source = adjusted.merchant?.trim();
      const safeDate = normalizeDraftDate(adjusted.date);
      const categoryValue = normaliseCategory(
        adjusted.category,
        availableCategories
      );
      const tags = normaliseTags(
        Array.isArray(adjusted.tags) ? adjusted.tags : []
      );
      return {
        id: generateId(),
        amount,
        category: categoryValue,
        merchant: source ? source : undefined,
        date: safeDate.toISOString(),
        isOneTime: Boolean(adjusted.isOneTime),
        tags,
      };
    },
    [applyCategoryRulesToDraft, availableCategories]
  );

  const handleAddEntry = (draft: LedgerEntryDraft) => {
    const entry = createEntryFromDraft(draft);
    if (!entry) {
      return;
    }
    setState((prev) => ({
      ...prev,
      entries: sortLedgerEntries([entry, ...prev.entries]),
    }));
    setMode("ledger");
  };

  const updateSavingsTarget = (value: number) => {
    setState((prev) => ({
      ...prev,
      savingsTarget: Math.max(0, value),
    }));
  };

  const handleImportEntries = useCallback(
    async (drafts: LedgerEntryDraft[]) => {
      if (!budgetId) {
        return;
      }

      const grouped = drafts.reduce<Map<string, LedgerEntryDraft[]>>(
        (acc, draft) => {
          const monthKey = draft.date
            ? getMonthKey(new Date(draft.date))
            : activeMonthKey;
          const list = acc.get(monthKey) ?? [];
          list.push(draft);
          acc.set(monthKey, list);
          return acc;
        },
        new Map()
      );

      if (!grouped.size) {
        return;
      }

      const nowIso = new Date().toISOString();
      const monthKeysInImport: string[] = [];

      for (const [monthKey, monthDrafts] of grouped.entries()) {
        const entriesToAppend = monthDrafts
          .map(createEntryFromDraft)
          .filter((entry): entry is BudgetLedgerEntry => Boolean(entry));

        if (!entriesToAppend.length) {
          continue;
        }

        const existingMonth = await fetchBudgetMonth(budgetId, monthKey);
        const mergedEntries = sortLedgerEntries(
          [...entriesToAppend, ...(existingMonth.entries ?? [])].map(
            applyCategoryRulesToEntry
          )
        );

        const payload: BudgetMonth = {
          ...existingMonth,
          entries: mergedEntries,
          updatedAt: nowIso,
          savingsTarget: existingMonth.savingsTarget ?? state.savingsTarget,
        };

        await saveBudgetMonth(budgetId, payload);

        if (monthKey === activeMonthKey) {
          setState(deriveStateFromMonth(payload, budgetDoc));
          setMonthMeta({
            id: payload.id,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
            initializedFrom: payload.initializedFrom ?? null,
          });
          setLastSavedAt(payload.updatedAt);
          setCategoryFilter(null);
          setTagFilter(null);
          setMode("ledger");
          lastHydrated.current = { budgetId, month: monthKey };
        } else {
          monthKeysInImport.push(monthKey);
        }
      }

      if (monthKeysInImport.length) {
        setAvailableMonths((prev) =>
          sortMonthKeys([...prev, ...monthKeysInImport])
        );
      }

      // Ensure currently active month remains in the URL metadata after import
      if (budgetId && activeMonthKey) {
        persistBudgetToUrl(budgetId, activeMonthKey);
      }
    },
    [
      activeMonthKey,
      applyCategoryRulesToEntry,
      budgetDoc,
      budgetId,
      createEntryFromDraft,
      deriveStateFromMonth,
      persistBudgetToUrl,
      state.savingsTarget,
    ]
  );

  const handleDeleteAllEntries = useCallback(async () => {
    if (!budgetId || !activeMonthKey) {
      return;
    }
    setLoading(true);
    try {
      const month = await fetchBudgetMonth(budgetId, activeMonthKey);
      const payload: BudgetMonth = {
        ...month,
        entries: [],
        updatedAt: new Date().toISOString(),
        savingsTarget: month.savingsTarget ?? state.savingsTarget,
      };
      await saveBudgetMonth(budgetId, payload);
      setState(deriveStateFromMonth(payload, budgetDoc));
      setMonthMeta({
        id: payload.id,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
        initializedFrom: payload.initializedFrom ?? null,
      });
      setLastSavedAt(payload.updatedAt);
      setCategoryFilter(null);
      setTagFilter(null);
      lastHydrated.current = { budgetId, month: activeMonthKey };
    } catch (error) {
      console.error("Failed to delete entries:", error);
    } finally {
      setLoading(false);
    }
  }, [activeMonthKey, budgetDoc, budgetId, deriveStateFromMonth, state.savingsTarget]);

  const handleRemoveEntry = (entryId: string) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.filter((entry) => entry.id !== entryId),
    }));
  };

  if (loading || !member) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
          <Spinner size="lg" />
          <span>Loading your budget...</span>
        </div>
      </div>
    );
  }

  if (invalidBudget) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-2xl font-semibold">Budget not found</h2>
        <p className="max-w-md text-sm text-slate-500">
          The link you followed might be incorrect or the budget was removed.
          Start a fresh budget to continue.
        </p>
        <Button
          onClick={async () => {
            if (!member) return;
            const newBudgetId = await createBudgetDocument(member);
            const initialMonth = getMonthKey();
            setBudgetId(newBudgetId);
            setActiveMonthKey(initialMonth);
            persistBudgetToUrl(newBudgetId, initialMonth);
            await hydrateBudget(newBudgetId, member, initialMonth);
          }}
        >
          Create new budget
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Header
          onSwitch={() => setMode(mode === "wizard" ? "ledger" : "wizard")}
          mode={mode}
          saving={saving}
          lastSavedAt={lastSavedAt}
          shareLink={
            budgetId && isClient()
              ? `${window.location.origin}/budget?budget_id=${budgetId}&month=${activeMonthKey}`
              : null
          }
        />
        {mode === "ledger" && availableMonths.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Label className="text-slate-600">Month</Label>
              <Select
                value={activeMonthKey}
                onValueChange={(value) => {
                  void handleSelectMonth(value);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select a month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((monthKey) => (
                    <SelectItem key={monthKey} value={monthKey}>
                      {formatMonthLabel(monthKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {mode === "wizard" ? (
          <Wizard
            step={step}
            setStep={setStep}
            incomes={state.incomes}
            updateIncome={updateIncome}
            removeIncome={removeIncome}
            addIncome={addIncome}
            fixeds={state.fixeds}
            updateFixed={updateFixed}
            removeFixed={removeFixed}
            addFixed={addFixed}
            totalIncome={totalIncome}
            totalFixed={totalFixed}
            savingsTarget={state.savingsTarget}
            setSavingsTarget={updateSavingsTarget}
            flexBudget={flexBudget}
            goalProjections={goalProjections}
            goalContributionTotal={goalContributionTotal}
            goalAllocationDelta={goalAllocationDelta}
            onCreateGoal={createGoal}
            onUpdateGoal={updateGoal}
            onDeleteGoal={deleteGoal}
            onFinish={() => setMode("ledger")}
          />
        ) : (
          <Ledger
            entries={state.entries}
            categories={availableCategories}
            availableTags={availableTags}
            categorySummaries={categorySummaries}
            categoryFilter={categoryFilter}
            tagFilter={tagFilter}
            flexBudget={flexBudget}
            monthSpend={monthSpend}
            recurringSpend={recurringSpend}
            oneTimeSpend={oneTimeSpend}
            nextMonthTargets={nextMonthTargets}
            remaining={remaining}
            progressPct={progressPct}
            onAddEntry={handleAddEntry}
            onRemoveEntry={handleRemoveEntry}
            onImportEntries={handleImportEntries}
            onAssignCategory={assignCategoryToEntry}
            onCreateCategory={upsertCustomCategory}
            onCreateRule={createCategoryRule}
            onSelectCategory={setCategoryFilter}
            onSelectTag={setTagFilter}
            onClearFilters={() => {
              setCategoryFilter(null);
              setTagFilter(null);
            }}
            onDeleteAllEntries={handleDeleteAllEntries}
            savingsTarget={state.savingsTarget}
            goalProjections={goalProjections}
            goalContributionTotal={goalContributionTotal}
            goalAllocationDelta={goalAllocationDelta}
            onToggleOneTime={setEntryOneTime}
            onUpdateTags={updateEntryTags}
            onOpenWizard={() => setMode("wizard")}
            paceStats={paceStats}
          />
        )}
      </div>
    </div>
  );
};

export default BudgetExperience;

function Header({
  onSwitch,
  mode,
  saving,
  lastSavedAt,
  shareLink,
}: {
  onSwitch: () => void;
  mode: Mode;
  saving: boolean;
  lastSavedAt: string | null;
  shareLink: string | null;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Toodl — Money that moves fast
          </h1>
          <div className="text-xs text-slate-500">
            {saving
              ? "Saving..."
              : lastSavedAt
              ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Ready when you are"}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {shareLink && (
          <Button
            variant="outline"
            onClick={() => {
              if (!shareLink) return;
              navigator.clipboard
                .writeText(shareLink)
                .catch(() => console.warn("Failed to copy share link"));
            }}
          >
            Copy share link
          </Button>
        )}
        <Button variant="secondary" onClick={onSwitch}>
          {mode === "wizard" ? "Go to Ledger" : "Run Budget Wizard"}
        </Button>
      </div>
    </div>
  );
}

function Wizard({
  step,
  setStep,
  incomes,
  updateIncome,
  removeIncome,
  addIncome,
  fixeds,
  updateFixed,
  removeFixed,
  addFixed,
  totalIncome,
  totalFixed,
  savingsTarget,
  setSavingsTarget,
  flexBudget,
  goalProjections,
  goalContributionTotal,
  goalAllocationDelta,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onFinish,
}: {
  step: WizardStep;
  setStep: (next: WizardStep) => void;
  incomes: BudgetIncome[];
  updateIncome: (index: number, patch: Partial<BudgetIncome>) => void;
  removeIncome: (id: string) => void;
  addIncome: () => void;
  fixeds: BudgetFixedExpense[];
  updateFixed: (index: number, patch: Partial<BudgetFixedExpense>) => void;
  removeFixed: (id: string) => void;
  addFixed: () => void;
  totalIncome: number;
  totalFixed: number;
  savingsTarget: number;
  setSavingsTarget: (value: number) => void;
  flexBudget: number;
  goalProjections: GoalProjection[];
  goalContributionTotal: number;
  goalAllocationDelta: number;
  onCreateGoal: (input: {
    name: string;
    targetAmount: number;
    currentBalance?: number;
    monthlyContribution?: number;
  }) => BudgetGoal | null;
  onUpdateGoal: (goalId: string, patch: Partial<BudgetGoal>) => void;
  onDeleteGoal: (goalId: string) => void;
  onFinish: () => void;
}) {
  const progress = ((step + 1) / 5) * 100;
  const remainingAfterBills = Math.max(0, totalIncome - totalFixed);
  const projectedLeftover = Math.max(0, flexBudget);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>Budget Wizard</span>
          <div className="w-40">
            <Progress value={progress} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Income sources</h3>
              <p className="text-sm text-slate-500">
                Add the money you expect this month.
              </p>
            </div>
            <div className="space-y-3">
              {incomes.map((income, idx) => (
                <div
                  key={income.id}
                  className="grid grid-cols-12 items-center gap-3"
                >
                  <div className="col-span-5">
                    <Label className="sr-only">Source</Label>
                    <Input
                      value={income.source}
                      onChange={(event) =>
                        updateIncome(idx, { source: event.target.value })
                      }
                      placeholder="Salary / Freelance"
                    />
                  </div>
                  <div className="col-span-5">
                    <Label className="sr-only">Amount</Label>
                    <Input
                      type="number"
                      min={0}
                      value={income.amount}
                      onChange={(event) =>
                        updateIncome(idx, {
                          amount: Number(event.target.value),
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeIncome(income.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={addIncome}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Add source
              </Button>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              Total income:{" "}
              <span className="font-semibold">{currency(totalIncome)}</span>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(1)}
                className="gap-1"
                disabled={!incomes.length}
              >
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Recurring bills</h3>
              <p className="text-sm text-slate-500">
                Toggle what applies and set amounts.
              </p>
            </div>
            <div className="space-y-3">
              {fixeds.map((fixed, idx) => (
                <div
                  key={fixed.id}
                  className="grid grid-cols-12 items-center gap-3"
                >
                  <div className="col-span-1 flex justify-center">
                    <Checkbox
                      checked={fixed.enabled}
                      onCheckedChange={(value) =>
                        updateFixed(idx, { enabled: Boolean(value) })
                      }
                    />
                  </div>
                  <div className="col-span-6">
                    <Input
                      value={fixed.name}
                      onChange={(event) =>
                        updateFixed(idx, { name: event.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      min={0}
                      value={fixed.amount}
                      onChange={(event) =>
                        updateFixed(idx, {
                          amount: Number(event.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFixed(fixed.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={addFixed}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Add bill
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
              <span>Fixed costs:</span>
              <span className="font-semibold">{currency(totalFixed)}</span>
            </div>
            <p className="text-sm text-slate-500">
              That leaves {currency(remainingAfterBills)} before savings.
            </p>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep(0)}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(2)} className="gap-1">
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Target savings</h3>
              <p className="text-sm text-slate-500">
                Set how much you want to save before spending.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="savings-target-input">Monthly savings goal</Label>
              <Input
                id="savings-target-input"
                type="number"
                min={0}
                value={savingsTarget}
                onChange={(event) =>
                  setSavingsTarget(Number(event.target.value) || 0)
                }
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
              <span>Total savings target:</span>
              <span className="font-semibold">
                {currency(Math.max(0, savingsTarget))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="gap-1">
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Goals & payoff plan</h3>
              <p className="text-sm text-slate-500">
                Direct your monthly savings toward goals and forecast when you will finish them.
              </p>
            </div>
            <SavingsGoalPlanner
              goalProjections={goalProjections}
              savingsTarget={savingsTarget}
              goalContributionTotal={goalContributionTotal}
              goalAllocationDelta={goalAllocationDelta}
              onCreateGoal={onCreateGoal}
              onUpdateGoal={onUpdateGoal}
              onDeleteGoal={onDeleteGoal}
            />
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(4)} className="gap-1">
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6">
              <div className="text-sm text-slate-600">
                Based on what you entered
              </div>
              <div className="mt-2 text-2xl font-semibold">
                You have {currency(flexBudget)} to spend this month
              </div>
              <div className="mt-1 text-sm text-slate-500">
                After bills and savings, this is your flexible budget.
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Total income</span>
                  <span className="font-semibold">{currency(totalIncome)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fixed costs</span>
                  <span className="font-semibold">- {currency(totalFixed)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Savings target</span>
                  <span className="font-semibold">- {currency(Math.max(0, savingsTarget))}</span>
                </div>
                <hr className="border-slate-200" />
                <div className="flex items-center justify-between text-base font-semibold text-emerald-700">
                  <span>Flexible spending</span>
                  <span>{currency(projectedLeftover)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep(3)}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={onFinish}>Finish & view ledger</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Ledger({
  entries,
  categories,
  availableTags,
  categorySummaries,
  categoryFilter,
  tagFilter,
  flexBudget,
  monthSpend,
  recurringSpend,
  oneTimeSpend,
  nextMonthTargets,
  remaining,
  progressPct,
  onAddEntry,
  onRemoveEntry,
  onImportEntries,
  onAssignCategory,
  onCreateCategory,
  onCreateRule,
  onSelectCategory,
  onSelectTag,
  onClearFilters,
  onDeleteAllEntries,
  savingsTarget,
  goalProjections,
  goalContributionTotal,
  goalAllocationDelta,
  onToggleOneTime,
  onUpdateTags,
  onOpenWizard,
  paceStats,
}: {
  entries: BudgetLedgerEntry[];
  categories: CategoryOption[];
  availableTags: string[];
  categorySummaries: CategorySummary[];
  categoryFilter: string | null;
  tagFilter: string | null;
  flexBudget: number;
  monthSpend: number;
  recurringSpend: number;
  oneTimeSpend: number;
  nextMonthTargets: NextMonthTarget[];
  remaining: number;
  progressPct: number;
  onAddEntry: (entry: LedgerEntryDraft) => void;
  onRemoveEntry: (id: string) => void;
  onImportEntries: (entries: LedgerEntryDraft[]) => Promise<void> | void;
  onAssignCategory: (entryId: string, categoryValue: string) => void;
  onCreateCategory: (label: string, emoji?: string | null) => CategoryOption | null;
  onCreateRule: (input: CategoryRuleInput) => BudgetCategoryRule | null;
  onSelectCategory: (categoryValue: string) => void;
  onSelectTag: (tagValue: string) => void;
  onClearFilters: () => void;
  onDeleteAllEntries: () => Promise<void> | void;
  savingsTarget: number;
  goalProjections: GoalProjection[];
  goalContributionTotal: number;
  goalAllocationDelta: number;
  onToggleOneTime: (entryId: string, isOneTime: boolean) => void;
  onUpdateTags: (entryId: string, tags: string[]) => void;
  onOpenWizard: () => void;
  paceStats: PaceStats;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [categoryEditorEntry, setCategoryEditorEntry] =
    useState<BudgetLedgerEntry | null>(null);
  const [tagEditorEntry, setTagEditorEntry] =
    useState<BudgetLedgerEntry | null>(null);
  const [showSpendDetails, setShowSpendDetails] = useState(false);

  const {
    daysOnPace,
    currentStreak,
    bestStreak,
    evaluationEndDay,
    daysInMonth,
    onPaceToday,
    projectedMonthlySpend,
  } = paceStats;

  const normalizedCategoryFilter = useMemo(
    () => categoryFilter?.toLowerCase() ?? null,
    [categoryFilter]
  );

  const normalizedTagFilter = useMemo(
    () => tagFilter?.toLowerCase() ?? null,
    [tagFilter]
  );

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesCategory = normalizedCategoryFilter
        ? entry.category.toLowerCase() === normalizedCategoryFilter
        : true;
      const tagList = Array.isArray(entry.tags) ? entry.tags : [];
      const matchesTag = normalizedTagFilter
        ? tagList.some((tag) => tag.toLowerCase() === normalizedTagFilter)
        : true;
      return matchesCategory && matchesTag;
    });
  }, [entries, normalizedCategoryFilter, normalizedTagFilter]);

  const hasDetailMetrics =
    recurringSpend > 0 || oneTimeSpend > 0 || savingsTarget > 0;

  const topColor =
    progressPct < 60 ? "bg-emerald-100" : progressPct < 90 ? "bg-amber-100" : "bg-rose-100";

  return (
    <div className="space-y-4">
      <Card className="border-slate-200">
        <CardContent className={`rounded-xl p-4 md:p-6 ${topColor}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm text-slate-600">Budget remaining</div>
              <div className="text-3xl font-semibold">
                {currency(remaining)}{" "}
                <span className="text-base font-normal text-slate-500">
                  / {currency(flexBudget)}
                </span>
              </div>
            </div>
            <div className="min-w-[220px]">
              <Progress value={progressPct} />
              <div className="mt-1 text-xs text-slate-500">
                Spent {currency(monthSpend)} ({progressPct}%)
              </div>
              {evaluationEndDay > 0 && evaluationEndDay < daysInMonth && (
                <div className="text-xs text-slate-500">
                  Projected spend: {currency(projectedMonthlySpend)}
                </div>
              )}
              {hasDetailMetrics && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setShowSpendDetails((prev) => !prev)}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
                    aria-expanded={showSpendDetails}
                  >
                    {showSpendDetails ? "Hide spend details" : "Show spend details"}
                    {showSpendDetails ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  {showSpendDetails && (
                    <div className="mt-1 space-y-1 text-xs text-slate-500">
                      <div>Recurring spend: {currency(recurringSpend)}</div>
                      {oneTimeSpend > 0 && (
                        <div>One-time this month: {currency(oneTimeSpend)}</div>
                      )}
                      <div>Savings goal: {currency(Math.max(0, savingsTarget))}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {evaluationEndDay > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 shadow-sm">
                <span className="text-lg">📅</span>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Days on pace
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {daysOnPace} / {evaluationEndDay}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 shadow-sm">
                <span className="text-lg">🔥</span>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Current streak
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {currentStreak} day{currentStreak === 1 ? "" : "s"}
                    <span className="ml-2 text-xs text-slate-500">
                      Best {bestStreak}
                    </span>
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 shadow-sm",
                  onPaceToday
                    ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border border-rose-300 bg-rose-50 text-rose-700"
                )}
              >
                <span className="text-lg">
                  {onPaceToday ? "🎯" : "⚠️"}
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wide">
                    {onPaceToday ? "On pace" : "Above pace"}
                  </div>
                  <div className="text-xs">
                    {onPaceToday
                      ? "Nice work! Keep protecting the streak."
                      : "Spend a little less tomorrow to recover."}
                  </div>
                </div>
              </div>
            </div>
          )}
          {categorySummaries.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categorySummaries.map((summary) => {
                const normalizedValue = summary.value.toLowerCase();
                const categoryMatch = categories.find(
                  (category) => category.value.toLowerCase() === normalizedValue
                );
                const isActive =
                  categoryFilter &&
                  normalizedValue === categoryFilter.toLowerCase();
                const representativeEntry = entries.find(
                  (entry) => entry.category.toLowerCase() === normalizedValue
                );
                const hasRecurring = summary.recurringTotal > 0;
                const hasOneTime = summary.oneTimeTotal > 0;
                const handlePillClick = () => onSelectCategory(summary.value);
                const handleIconClick = (
                  event: React.MouseEvent<HTMLSpanElement>
                ) => {
                  if (categoryMatch) {
                    return;
                  }
                  event.stopPropagation();
                  if (representativeEntry) {
                    setCategoryEditorEntry(representativeEntry);
                  }
                };
                return (
                  <button
                    key={normalizedValue}
                    type="button"
                    onClick={handlePillClick}
                    className={cn(
                      "flex items-center justify-between rounded-full border border-slate-200 px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "bg-white/60 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        role="button"
                        tabIndex={0}
                        className="text-base focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                        aria-label="Reassign category"
                        onClick={handleIconClick}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            handleIconClick(
                              event as unknown as React.MouseEvent<HTMLSpanElement>
                            );
                          }
                        }}
                      >
                        {summary.emoji ?? "🏷️"}
                      </span>
                      <span className="font-medium">{summary.label}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-semibold">
                        {currency(
                          hasRecurring ? summary.recurringTotal : summary.total
                        )}
                      </span>
                      {hasOneTime ? (
                        <span className="text-xs text-slate-500">
                          +{currency(summary.oneTimeTotal)} one-time
                        </span>
                      ) : hasRecurring ? (
                        <span className="text-xs text-slate-400">Recurring</span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          All one-time
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <NextMonthPlanner
        recurringSpend={recurringSpend}
        oneTimeSpend={oneTimeSpend}
        nextMonthTargets={nextMonthTargets}
        onSelectCategory={onSelectCategory}
      />

      <GoalSummaryCard
        goalProjections={goalProjections}
        savingsTarget={savingsTarget}
        goalContributionTotal={goalContributionTotal}
        goalAllocationDelta={goalAllocationDelta}
        onOpenWizard={onOpenWizard}
      />

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Ledger</span>
            <div className="flex items-center gap-2">
              {availableTags.length > 0 && (
                <Select
                  value={tagFilter ?? undefined}
                  onValueChange={(value) => onSelectTag(value)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Filter tags" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag.toLowerCase()} value={tag}>
                        #{tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(categoryFilter || tagFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearFilters}
                  className="gap-1"
                >
                  Clear filters
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete all expenses for this month? This cannot be undone."
                    )
                  ) {
                    void onDeleteAllEntries();
                  }
                }}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" /> Delete all
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowImport(true)}
              >
                <Upload className="h-4 w-4" />
                Import CSV/Excel
              </Button>
              <Sheet open={showAdd} onOpenChange={setShowAdd}>
                <SheetTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Add expense
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[75vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Quick add expense</SheetTitle>
                  </SheetHeader>
                  <QuickAdd
                    categories={categories}
                    onSave={(entry) => {
                      onAddEntry(entry);
                      setShowAdd(false);
                    }}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EntryList
            entries={visibleEntries}
            categories={categories}
            onDelete={onRemoveEntry}
            onEditCategory={(entry) => setCategoryEditorEntry(entry)}
            onToggleOneTime={onToggleOneTime}
            onEditTags={(entry) => setTagEditorEntry(entry)}
            onUpdateTags={onUpdateTags}
          />
        </CardContent>
        <ImportExpenses
          open={showImport}
          onOpenChange={setShowImport}
          onImport={async (drafts) => {
            await onImportEntries(drafts);
            setShowImport(false);
          }}
        />
      </Card>
      <CategoryEditorDialog
        entry={categoryEditorEntry}
        open={Boolean(categoryEditorEntry)}
        categories={categories}
        onAssignCategory={onAssignCategory}
        onCreateCategory={onCreateCategory}
        onCreateRule={onCreateRule}
        onClose={() => setCategoryEditorEntry(null)}
      />
      <TagEditorDialog
        entry={tagEditorEntry}
        open={Boolean(tagEditorEntry)}
        availableTags={availableTags}
        onSave={(entryId, tags) => {
          onUpdateTags(entryId, tags);
        }}
        onClose={() => setTagEditorEntry(null)}
      />
    </div>
  );
}

function EntryList({
  entries,
  categories,
  onDelete,
  onEditCategory,
  onToggleOneTime,
  onEditTags,
  onUpdateTags,
}: {
  entries: BudgetLedgerEntry[];
  categories: CategoryOption[];
  onDelete: (id: string) => void;
  onEditCategory: (entry: BudgetLedgerEntry) => void;
  onToggleOneTime: (entryId: string, isOneTime: boolean) => void;
  onEditTags: (entry: BudgetLedgerEntry) => void;
  onUpdateTags: (entryId: string, tags: string[]) => void;
}) {
  const categoryLookup = useMemo(() => {
    const map = new Map<string, CategoryOption>();
    categories.forEach((category) => {
      map.set(category.value.toLowerCase(), category);
    });
    return map;
  }, [categories]);

  const groupedByDay = entries.reduce<
    Map<
      string,
      {
        date: Date;
        entries: BudgetLedgerEntry[];
      }
    >
  >((acc, entry) => {
    const date = normalizeDraftDate(entry.date);
    const isoDay = formatDateParts(date);
    const existing = acc.get(isoDay);
    if (existing) {
      existing.entries.push(entry);
    } else {
      acc.set(isoDay, { date, entries: [entry] });
    }
    return acc;
  }, new Map());

  const orderedGroups = Array.from(groupedByDay.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([isoDay, { date, entries: groupEntries }]) => ({
      isoDay,
      label: date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      entries: groupEntries
        .slice()
        .sort(
          (left, right) =>
            normalizeDraftDate(right.date).getTime() -
            normalizeDraftDate(left.date).getTime()
        ),
    }));

  if (!orderedGroups.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 p-12 text-center text-sm text-slate-500">
        No entries yet — add your first purchase to start tracking.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orderedGroups.map((group) => (
        <div key={group.isoDay} className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {group.label}
          </div>
          <div className="divide-y rounded-xl border">
            {group.entries.map((entry) => {
              const normalized = normalizeDraftDate(entry.date);
              const categoryInfo =
                categoryLookup.get(entry.category.toLowerCase()) ?? null;
              const categoryEmoji =
                categoryInfo?.emoji && categoryInfo.emoji.trim()
                  ? categoryInfo.emoji
                  : "🏷️";
              const categoryLabel = categoryInfo?.label ?? entry.category;
              const isOneTime = Boolean(entry.isOneTime);
              const tags = Array.isArray(entry.tags) ? entry.tags : [];
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onEditCategory(entry)}
                      className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    >
                      <span>{categoryEmoji}</span>
                      {categoryLabel}
                    </button>
                    <div>
                      <div className="font-medium">
                        {entry.merchant || "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {normalized.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {isOneTime && (
                        <div className="text-xs font-medium text-amber-600">
                          One-time expense
                        </div>
                      )}
                      {tags.length > 0 ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {tags.map((tag) => (
                            <button
                              key={`${entry.id}-tag-${tag.toLowerCase()}`}
                              type="button"
                              onClick={() => {
                                const nextTags = tags.filter(
                                  (value) => value.toLowerCase() !== tag.toLowerCase()
                                );
                                onUpdateTags(entry.id, nextTags);
                              }}
                              className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                              aria-label={`Remove tag ${tag}`}
                            >
                              #{tag}
                              <X className="h-3 w-3" />
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => onEditTags(entry)}
                            className="text-[10px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                          >
                            Manage tags
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEditTags(entry)}
                          className="mt-1 text-[10px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                        >
                          Add tags
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleOneTime(entry.id, !isOneTime)}
                      aria-pressed={isOneTime}
                      className={cn(
                        "rounded-full border px-2 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2",
                        isOneTime
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {isOneTime ? "One-time" : "Mark one-time"}
                    </button>
                    <div className="font-semibold">
                      {currency(entry.amount)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const RULE_OPERATOR_OPTIONS: Array<{
  value: CategoryRuleOperator;
  label: string;
}> = [
  { value: "contains", label: "Description contains" },
  { value: "starts_with", label: "Description starts with" },
  { value: "equals", label: "Description equals" },
];

function CategoryEditorDialog({
  entry,
  open,
  categories,
  onAssignCategory,
  onCreateCategory,
  onCreateRule,
  onClose,
}: {
  entry: BudgetLedgerEntry | null;
  open: boolean;
  categories: CategoryOption[];
  onAssignCategory: (entryId: string, categoryValue: string) => void;
  onCreateCategory: (label: string, emoji?: string | null) => CategoryOption | null;
  onCreateRule: (input: CategoryRuleInput) => BudgetCategoryRule | null;
  onClose: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("");
  const [rememberRule, setRememberRule] = useState(false);
  const [ruleOperator, setRuleOperator] =
    useState<CategoryRuleOperator>("contains");
  const [rulePattern, setRulePattern] = useState("");
  const [error, setError] = useState<string | null>(null);

  const effectiveCategories = useMemo(() => {
    if (!entry?.category) {
      return categories;
    }
    const lower = entry.category.toLowerCase();
    const exists = categories.some(
      (category) => category.value.toLowerCase() === lower
    );
    if (exists) {
      return categories;
    }
    return [
      ...categories,
      {
        id: `existing-${entry.id}`,
        value: entry.category,
        label: entry.category,
        emoji: null,
      },
    ];
  }, [categories, entry]);

  useEffect(() => {
    if (open && entry) {
      const match = effectiveCategories.find(
        (category) =>
          category.value.toLowerCase() === entry.category.toLowerCase()
      );
      setSelectedCategory(match?.value ?? entry.category ?? "");
      setRulePattern(entry.merchant ?? "");
    } else {
      setSelectedCategory("");
      setRulePattern("");
    }
    setShowNewCategory(false);
    setNewCategoryName("");
    setNewCategoryEmoji("");
    setRememberRule(false);
    setRuleOperator("contains");
    setError(null);
  }, [effectiveCategories, entry, open]);

  const handleCreateCategory = () => {
    const label = newCategoryName.trim();
    if (!label) {
      setError("Enter a category name.");
      return;
    }
    const created = onCreateCategory(label, newCategoryEmoji || null);
    if (!created) {
      setError("We couldn't add that category. Try a different name.");
      return;
    }
    setSelectedCategory(created.value);
    setShowNewCategory(false);
    setNewCategoryName("");
    setNewCategoryEmoji("");
    setError(null);
  };

  const handleSave = () => {
    if (!entry) {
      onClose();
      return;
    }
    const categoryValue = selectedCategory.trim();
    if (!categoryValue) {
      setError("Pick a category before saving.");
      return;
    }

    const trimmedPattern = rulePattern.trim();
    if (rememberRule && !trimmedPattern) {
      setError("Enter text to match for the rule.");
      return;
    }

    onAssignCategory(entry.id, categoryValue);

    if (rememberRule && trimmedPattern) {
      onCreateRule({
        categoryValue,
        operator: ruleOperator,
        pattern: trimmedPattern,
      });
    }

    onClose();
  };

  const canSave =
    Boolean(entry) &&
    Boolean(selectedCategory) &&
    (!rememberRule || rulePattern.trim().length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust category</DialogTitle>
          <DialogDescription>
            Choose a different category for this expense or remember a new rule
            for similar imports.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ledger-category-select">Category</Label>
            <Select
              value={selectedCategory || undefined}
              onValueChange={(value) => {
                setSelectedCategory(value);
                setError(null);
              }}
            >
              <SelectTrigger id="ledger-category-select">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {effectiveCategories.map((category) => (
                  <SelectItem key={category.id} value={category.value}>
                    {category.emoji ? `${category.emoji} ` : ""}
                    {category.label}
                    {category.memberId ? " • Yours" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowNewCategory((previous) => !previous);
                setError(null);
              }}
            >
              {showNewCategory ? "Cancel new category" : "Create new category"}
            </Button>
            {showNewCategory && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="space-y-1">
                  <Label htmlFor="new-category-name">Category name</Label>
                  <Input
                    id="new-category-name"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="Pet Care, Home, etc."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-category-emoji">
                    Emoji (optional)
                  </Label>
                  <Input
                    id="new-category-emoji"
                    value={newCategoryEmoji}
                    onChange={(event) => setNewCategoryEmoji(event.target.value)}
                    placeholder="🐾"
                    maxLength={2}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={handleCreateCategory}>
                    Add category
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember-category-rule"
                checked={rememberRule}
                onCheckedChange={(value) => setRememberRule(Boolean(value))}
              />
              <Label
                htmlFor="remember-category-rule"
                className="text-sm font-medium"
              >
                Auto-categorize similar expenses
              </Label>
            </div>
            {rememberRule && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="rule-operator">Matching logic</Label>
                  <Select
                    value={ruleOperator}
                    onValueChange={(value: CategoryRuleOperator) =>
                      setRuleOperator(value)
                    }
                  >
                    <SelectTrigger id="rule-operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_OPERATOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-pattern">Text to match</Label>
                  <Input
                    id="rule-pattern"
                    value={rulePattern}
                    onChange={(event) => setRulePattern(event.target.value)}
                    placeholder={entry?.merchant || "Merchant or description"}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Rules check the description/merchant field on imports you
                  run.
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="mt-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NextMonthPlanner({
  nextMonthTargets,
  recurringSpend,
  oneTimeSpend,
  onSelectCategory,
}: {
  nextMonthTargets: NextMonthTarget[];
  recurringSpend: number;
  oneTimeSpend: number;
  onSelectCategory: (categoryValue: string) => void;
}) {
  const hasTargets = nextMonthTargets.length > 0;
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Next month plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span>
            Recurring baseline:{" "}
            <span className="font-semibold text-slate-900">
              {currency(recurringSpend)}
            </span>
          </span>
          {oneTimeSpend > 0 ? (
            <span>
              Potential savings from one-time spend:{" "}
              <span className="font-semibold text-emerald-600">
                {currency(oneTimeSpend)}
              </span>
            </span>
          ) : (
            <span>No one-time spend recorded this month.</span>
          )}
        </div>
        {hasTargets ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {nextMonthTargets.map((target) => (
              <button
                key={target.value.toLowerCase()}
                type="button"
                onClick={() => onSelectCategory(target.value)}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                <div className="flex items-center gap-2">
                  <span>{target.emoji ?? "🏷️"}</span>
                  <span className="font-medium text-slate-700">
                    {target.label}
                  </span>
                </div>
                <span className="font-semibold text-slate-900">
                  {currency(target.suggestedAmount)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            Add a few expenses and mark one-time purchases to see tailored
            targets for next month.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoalSummaryCard({
  goalProjections,
  savingsTarget,
  goalContributionTotal,
  goalAllocationDelta,
  onOpenWizard,
}: {
  goalProjections: GoalProjection[];
  savingsTarget: number;
  goalContributionTotal: number;
  goalAllocationDelta: number;
  onOpenWizard: () => void;
}) {
  const hasGoals = goalProjections.length > 0;
  const topGoals = goalProjections.slice(0, 2);
  const remainingSavings = Math.max(0, goalAllocationDelta);
  const overAllocation = goalAllocationDelta < 0;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">
            Goals snapshot
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onOpenWizard}>
            Edit in wizard
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            overAllocation
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          <div>
            Allocating
            <span className="ml-1 font-semibold">
              {currency(goalContributionTotal)}
            </span>
            of
            <span className="ml-1 font-semibold">
              {currency(Math.max(0, savingsTarget))}
            </span>
            planned savings.
          </div>
          {remainingSavings > 0 && !overAllocation && (
            <div>Unassigned savings available: {currency(remainingSavings)}</div>
          )}
          {overAllocation && (
            <div>
              Over-allocated by {currency(Math.abs(goalAllocationDelta))}. Adjust a goal next.
            </div>
          )}
          {!overAllocation && remainingSavings === 0 && (
            <div>Every saved dollar is spoken for. Nicely balanced!</div>
          )}
        </div>

        {hasGoals ? (
          <div className="space-y-3">
            {topGoals.map((projection) => {
              const { normalized, remainingAmount, monthsToGoal } = projection;
              const formattedDate = formatGoalCompletionDate(
                projection.projectedCompletionDate
              );
              const timelineMessage =
                remainingAmount === 0
                  ? "Completed!"
                  : monthsToGoal === null
                  ? "Set a contribution to project finish date."
                  : formattedDate
                  ? `≈${monthsToGoal} months (by ${formattedDate})`
                  : `≈${monthsToGoal} months`;
              return (
                <div
                  key={projection.goal.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-700">
                      {normalized.name || "Untitled goal"}
                    </div>
                    <div className="text-slate-500">
                      Need {currency(remainingAmount)}
                    </div>
                  </div>
                  <div className="text-right text-slate-500">{timelineMessage}</div>
                </div>
              );
            })}
            {goalProjections.length > topGoals.length && (
              <div className="text-xs text-slate-500">
                +{goalProjections.length - topGoals.length} more goal
                {goalProjections.length - topGoals.length === 1 ? "" : "s"} tracked.
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Add a payoff or savings goal in the wizard to see projections here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SavingsGoalPlanner({
  goalProjections,
  savingsTarget,
  goalContributionTotal,
  goalAllocationDelta,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
}: {
  goalProjections: GoalProjection[];
  savingsTarget: number;
  goalContributionTotal: number;
  goalAllocationDelta: number;
  onCreateGoal: (input: {
    name: string;
    targetAmount: number;
    currentBalance?: number;
    monthlyContribution?: number;
  }) => BudgetGoal | null;
  onUpdateGoal: (goalId: string, patch: Partial<BudgetGoal>) => void;
  onDeleteGoal: (goalId: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [balance, setBalance] = useState("");
  const [contribution, setContribution] = useState("");
  const [error, setError] = useState<string | null>(null);

  const allocationPositive = goalAllocationDelta >= 0;
  const allocationMagnitude = Math.abs(goalAllocationDelta);

  const resetForm = () => {
    setName("");
    setTarget("");
    setBalance("");
    setContribution("");
    setError(null);
  };

  const handleCreateGoal = () => {
    const trimmed = name.trim();
    const targetAmount = Math.max(0, Number(target) || 0);
    const currentBalance = Math.max(0, Number(balance) || 0);
    const monthlyContribution = Math.max(0, Number(contribution) || 0);

    if (!trimmed) {
      setError("Add a name so you recognize the goal later.");
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError("Set a target amount above zero.");
      return;
    }
    if (currentBalance > targetAmount) {
      setError("Current balance can't be above the target.");
      return;
    }

    const created = onCreateGoal({
      name: trimmed,
      targetAmount,
      currentBalance,
      monthlyContribution,
    });
    if (!created) {
      setError("We couldn't create that goal. Try different details.");
      return;
    }
    resetForm();
    setShowForm(false);
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Savings goals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            allocationPositive
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          <div>
            Allocated{" "}
            <span className="font-semibold">
              {currency(goalContributionTotal)}
            </span>{" "}
            of your {currency(Math.max(0, savingsTarget))} monthly savings goal.
          </div>
          {allocationMagnitude > 0 ? (
            <div>
              {allocationPositive
                ? `Unallocated savings remaining: ${currency(
                    allocationMagnitude
                  )}`
                : `Over-allocated by ${currency(
                    allocationMagnitude
                  )} — adjust a goal below.`}
            </div>
          ) : (
            <div>Every dollar of savings is assigned to a goal.</div>
          )}
        </div>

        {goalProjections.length ? (
          <div className="space-y-4">
            {goalProjections.map((projection) => {
              const { goal, normalized, remainingAmount, monthsToGoal } =
                projection;
              const formattedDate = formatGoalCompletionDate(
                projection.projectedCompletionDate
              );
              const timeline =
                remainingAmount === 0
                  ? "Goal complete! 🎉"
                  : monthsToGoal === null
                  ? "Add a monthly contribution to project the finish date."
                  : `~${monthsToGoal} month${
                      monthsToGoal === 1 ? "" : "s"
                    }${formattedDate ? ` (by ${formattedDate})` : ""}`;
              return (
                <div
                  key={goal.id}
                  className="space-y-3 rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor={`goal-name-${goal.id}`}>
                          Goal name
                        </Label>
                        <Input
                          id={`goal-name-${goal.id}`}
                          value={normalized.name}
                          onChange={(event) =>
                            onUpdateGoal(goal.id, {
                              name: event.target.value,
                            })
                          }
                          placeholder="Debt payoff, travel fund…"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label htmlFor={`goal-target-${goal.id}`}>
                            Target amount
                          </Label>
                          <Input
                            id={`goal-target-${goal.id}`}
                            type="number"
                            min={0}
                            value={normalized.targetAmount}
                            onChange={(event) =>
                              onUpdateGoal(goal.id, {
                                targetAmount: Number(event.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`goal-balance-${goal.id}`}>
                            Current balance
                          </Label>
                          <Input
                            id={`goal-balance-${goal.id}`}
                            type="number"
                            min={0}
                            value={normalized.currentBalance}
                            onChange={(event) =>
                              onUpdateGoal(goal.id, {
                                currentBalance: Number(event.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`goal-monthly-${goal.id}`}>
                            Monthly contribution
                          </Label>
                          <Input
                            id={`goal-monthly-${goal.id}`}
                            type="number"
                            min={0}
                            value={normalized.monthlyContribution}
                            onChange={(event) =>
                              onUpdateGoal(goal.id, {
                                monthlyContribution:
                                  Number(event.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteGoal(goal.id)}
                      aria-label="Delete goal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                      Remaining {currency(remainingAmount)}
                    </span>
                    <span
                      className={cn(
                        "text-slate-500",
                        remainingAmount === 0 && "text-emerald-600 font-medium"
                      )}
                    >
                      {timeline}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            Create a goal to start directing savings toward what matters most.
          </div>
        )}

        <div className="space-y-3">
          <Button
            variant={showForm ? "outline" : "secondary"}
            onClick={() => {
              setShowForm((prev) => !prev);
              setError(null);
            }}
            className="w-full sm:w-auto"
          >
            {showForm ? "Cancel" : "Add goal"}
          </Button>
          {showForm && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="new-goal-name">Goal name</Label>
                  <Input
                    id="new-goal-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Pay off credit card"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-goal-target">Target amount</Label>
                  <Input
                    id="new-goal-target"
                    type="number"
                    min={0}
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    placeholder="30000"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-goal-balance">Current balance</Label>
                  <Input
                    id="new-goal-balance"
                    type="number"
                    min={0}
                    value={balance}
                    onChange={(event) => setBalance(event.target.value)}
                    placeholder="5000"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-goal-monthly">Monthly contribution</Label>
                  <Input
                    id="new-goal-monthly"
                    type="number"
                    min={0}
                    value={contribution}
                    onChange={(event) => setContribution(event.target.value)}
                    placeholder="600"
                  />
                </div>
              </div>
              {error && (
                <div className="text-sm text-rose-600" role="alert">
                  {error}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleCreateGoal}>Save goal</Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TagEditorDialog({
  entry,
  open,
  availableTags,
  onSave,
  onClose,
}: {
  entry: BudgetLedgerEntry | null;
  open: boolean;
  availableTags: string[];
  onSave: (entryId: string, tags: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [draftTag, setDraftTag] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && entry) {
      setSelected(
        normaliseTags(Array.isArray(entry.tags) ? entry.tags : [])
      );
      setDraftTag("");
      setError(null);
    } else if (!open) {
      setSelected([]);
      setDraftTag("");
      setError(null);
    }
  }, [entry, open]);

  const handleAddDraftTag = () => {
    const next = draftTag.trim();
    if (!next) {
      setError("Enter a tag before adding.");
      return;
    }
    const updated = normaliseTags([...selected, next]);
    setSelected(updated);
    setDraftTag("");
    setError(null);
  };

  const handleToggleTag = (tag: string) => {
    const exists = selected.some(
      (value) => value.toLowerCase() === tag.toLowerCase()
    );
    if (exists) {
      setSelected((prev) =>
        prev.filter((value) => value.toLowerCase() !== tag.toLowerCase())
      );
    } else {
      setSelected((prev) => normaliseTags([...prev, tag]));
    }
  };

  const handleSave = () => {
    if (!entry) {
      onClose();
      return;
    }
    onSave(entry.id, selected);
    onClose();
  };

  const remainingSuggestions = availableTags.filter(
    (tag) =>
      !selected.some((value) => value.toLowerCase() === tag.toLowerCase())
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit tags</DialogTitle>
          <DialogDescription>
            Organize this expense with short keywords like
            <span className="ml-1 font-semibold text-slate-700">#groceries</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Tags</Label>
            {selected.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.map((tag) => (
                  <button
                    key={tag.toLowerCase()}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                No tags yet. Add a few below to slice expenses later.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="draft-tag-input">Add tag</Label>
            <div className="flex gap-2">
              <Input
                id="draft-tag-input"
                value={draftTag}
                onChange={(event) => setDraftTag(event.target.value)}
                placeholder="Travel, Work Lunch…"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddDraftTag();
                  }
                }}
              />
              <Button type="button" onClick={handleAddDraftTag}>
                Add
              </Button>
            </div>
            {error && (
              <p className="text-xs text-rose-600" role="alert">
                {error}
              </p>
            )}
          </div>

          {remainingSuggestions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Suggestions
              </div>
              <div className="flex flex-wrap gap-2">
                {remainingSuggestions.map((tag) => (
                  <button
                    key={`suggestion-${tag.toLowerCase()}`}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save tags
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportExpenses({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (entries: LedgerEntryDraft[]) => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<{
    amount: string;
    description: string;
    category: string;
    date: string;
    tags: string;
  }>({
    amount: "",
    description: "",
    category: "",
    date: "",
    tags: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({
      amount: "",
      description: "",
      category: "",
      date: "",
      tags: "",
    });
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const applyGuesses = (availableHeaders: string[]) => {
    const amountGuess =
      guessHeader(availableHeaders, ["amount", "debit", "credit", "total"]) ||
      availableHeaders[0] ||
      "";
    const descriptionGuess =
      guessHeader(availableHeaders, ["description", "merchant", "detail", "memo"]) ||
      availableHeaders[1] ||
      "";
    const categoryGuess =
      guessHeader(availableHeaders, ["category", "type", "group"]) ||
      availableHeaders[2] ||
      "";
    const dateGuess = guessHeader(availableHeaders, ["date", "posted", "transaction"]);
    const tagsGuess =
      guessHeader(availableHeaders, ["tag", "label", "keyword"]) || "";
    setMapping({
      amount: amountGuess,
      description: descriptionGuess,
      category: categoryGuess,
      date: dateGuess,
      tags: tagsGuess,
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { headers: detectedHeaders, rows: detectedRows } = await parseSpreadsheetFile(
        file
      );
      if (!detectedHeaders.length) {
        throw new Error("We couldn't find column headers in that file.");
      }
      setHeaders(detectedHeaders);
      setRows(detectedRows);
      setFileName(file.name);
      applyGuesses(detectedHeaders);
    } catch (err) {
      console.error("Failed to parse import file:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We had trouble reading that file. Try a different format."
      );
      setHeaders([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!headers.length || !rows.length) {
      setError("Upload a CSV or Excel file before importing.");
      return;
    }
    if (!mapping.amount || !mapping.description || !mapping.category) {
      setError("Map amount, description, and category before importing.");
      return;
    }
    setLoading(true);
    const amountIndex = headers.indexOf(mapping.amount);
    const descriptionIndex = headers.indexOf(mapping.description);
    const categoryIndex = headers.indexOf(mapping.category);
    const dateIndex =
      mapping.date && mapping.date !== NO_DATE_COLUMN_VALUE
        ? headers.indexOf(mapping.date)
        : -1;
    const tagsIndex =
      mapping.tags && mapping.tags !== NO_TAG_COLUMN_VALUE
        ? headers.indexOf(mapping.tags)
        : -1;

    if (amountIndex === -1 || descriptionIndex === -1 || categoryIndex === -1) {
      setError("Your column selections are no longer available. Re-select them.");
      return;
    }

    const drafts = rows.reduce<LedgerEntryDraft[]>((acc, row) => {
      const amount = coerceAmount(row[amountIndex]);
      if (!Number.isFinite(amount) || amount === 0) {
        return acc;
      }
      const rawCategory = row[categoryIndex] ?? "";
      const category = rawCategory.trim();
      const description = descriptionIndex >= 0 ? row[descriptionIndex] : "";
      const dateRaw = dateIndex >= 0 ? row[dateIndex] : undefined;
      const normalizedDate = coerceDateInput(dateRaw);

      const draft: LedgerEntryDraft = {
        amount,
        category,
      };
      if (description) {
        draft.merchant = description;
      }
      if (normalizedDate) {
        draft.date = normalizedDate;
      }
      if (tagsIndex >= 0) {
        const rawTags = row[tagsIndex] ?? "";
        const parsedTags = normaliseTags(
          rawTags
            .split(/[;,|]/)
            .map((tag) => tag.trim())
        );
        if (parsedTags.length) {
          draft.tags = parsedTags;
        }
      }
      acc.push(draft);
      return acc;
    }, []);

    if (!drafts.length) {
      setError("No rows were importable. Check your column mapping.");
      setLoading(false);
      return;
    }

    try {
      await onImport(drafts);
      onOpenChange(false);
      resetState();
    } catch (err) {
      console.error("Failed to import entries:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while importing."
      );
    } finally {
      setLoading(false);
    }
  };

  const previewRows = rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-w-[calc(100vw-2rem)] w-full max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Import expenses from CSV or Excel</DialogTitle>
          <DialogDescription>
            Map your spreadsheet columns to amounts, descriptions, and categories. We’ll
            fold related category synonyms into the closest Toodl bucket.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1 min-h-0">
          <div className="space-y-4 pb-2">
            <div className="space-y-2">
              <Label>Spreadsheet file</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.xls,.xlsx"
                onChange={handleFileChange}
              />
              <p className="text-xs text-slate-500">
                Accepted formats: CSV, TSV, or Excel (.xls/.xlsx). We’ll use the first sheet.
              </p>
              {fileName && (
                <p className="text-xs text-slate-500">
                  Loaded <span className="font-medium">{fileName}</span> with{" "}
                  {rows.length.toLocaleString()} rows.
                </p>
              )}
            </div>

            {headers.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-700">Column mapping</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Amount</Label>
                    <Select
                      value={mapping.amount}
                      onValueChange={(value) => setMapping((prev) => ({ ...prev, amount: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select amount column" />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Select
                      value={mapping.description}
                      onValueChange={(value) =>
                        setMapping((prev) => ({ ...prev, description: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select description column" />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select
                      value={mapping.category}
                      onValueChange={(value) =>
                        setMapping((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category column" />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Date (optional)</Label>
                    <Select
                      value={mapping.date === "" ? undefined : mapping.date}
                      onValueChange={(value) =>
                        setMapping((prev) => ({
                          ...prev,
                          date: value === NO_DATE_COLUMN_VALUE ? NO_DATE_COLUMN_VALUE : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select date column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DATE_COLUMN_VALUE}>No date column</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Tags (optional)</Label>
                    <Select
                      value={mapping.tags === "" ? NO_TAG_COLUMN_VALUE : mapping.tags}
                      onValueChange={(value) =>
                        setMapping((prev) => ({
                          ...prev,
                          tags: value === NO_TAG_COLUMN_VALUE ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tags column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TAG_COLUMN_VALUE}>No tags column</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Provide comma-separated tags per row if available.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {previewRows.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-700">Preview</h4>
                <div className="max-h-64 max-w-full overflow-auto rounded-lg border">
                  <table className="min-w-max text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        {headers.map((header) => (
                          <th key={header} className="px-3 py-2 font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-slate-100">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">
                  Showing the first {previewRows.length} rows. All rows will be imported.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {error}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleImport();
            }}
            disabled={loading || !headers.length}
          >
            {loading ? "Processing…" : "Import transactions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickAdd({
  categories,
  onSave,
}: {
  categories: CategoryOption[];
  onSave: (entry: LedgerEntryDraft) => void;
}) {
  const [amountStr, setAmountStr] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [dateStr, setDateStr] = useState(() => formatDateInput(new Date()));
  const [isOneTime, setIsOneTime] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  const amount = Number(amountStr || 0);

  useEffect(() => {
    if (!category && categories.length) {
      setCategory(categories[0].value);
    }
  }, [category, categories]);

  const handleSave = () => {
    if (!amount || !category) {
      return;
    }
    onSave({
      amount,
      category,
      merchant: merchant || undefined,
      date: dateStr,
      isOneTime,
      tags: normaliseTags(
        tagsInput
          .split(",")
          .map((tag) => tag.trim())
      ),
    });
    setAmountStr("");
    setCategory(categories[0]?.value ?? null);
    setMerchant("");
    setDateStr(formatDateInput(new Date()));
    setIsOneTime(false);
    setTagsInput("");
  };

  return (
    <div className="mx-auto mt-4 max-w-md space-y-6">
      <div className="space-y-2">
        <Label>Amount</Label>
        <Input
          inputMode="decimal"
          placeholder="$0.00"
          value={amountStr}
          onChange={(event) => setAmountStr(event.target.value)}
          className="text-lg"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="quick-add-one-time"
          checked={isOneTime}
          onCheckedChange={(value) => setIsOneTime(Boolean(value))}
        />
        <Label htmlFor="quick-add-one-time" className="text-sm">
          Mark as one-time expense
        </Label>
      </div>

      <div className="space-y-2">
        <Label>Date</Label>
        <Input
          type="date"
          value={dateStr}
          onChange={(event) => setDateStr(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        {categories.length ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => {
              const selected = category === item.value;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={`rounded-full border px-3 py-2 text-sm transition ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {item.emoji && (
                    <span className="mr-1" aria-hidden>
                      {item.emoji}
                    </span>
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Add a category from the ledger view to get started.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tags (optional)</Label>
        <Input
          placeholder="groceries, travel, work"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
        />
        <p className="text-xs text-slate-500">
          Separate tags with commas. Use them later to filter expenses.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Merchant (optional)</Label>
        <Input
          placeholder="Starbucks, Target…"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
        />
        <div className="flex items-center gap-3 pt-1">
          <Dialog open={showCamera} onOpenChange={setShowCamera}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Camera className="h-4 w-4" /> Add receipt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Receipt capture (mock)</DialogTitle>
              </DialogHeader>
              <div className="text-sm text-slate-500">
                Plug your actual OCR flow here. You can auto-fill
                amount/category from the receipt.
              </div>
              <div className="rounded-lg border p-6 text-center text-slate-400">
                <Receipt className="mx-auto h-10 w-10" />
                <div className="mt-2 text-sm">
                  Camera preview / file dropzone
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!amount || !category}
          className="gap-1"
        >
          Save <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
