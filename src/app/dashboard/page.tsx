"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { BookmarkPlus, ChevronLeft, ChevronRight, ExternalLink, Search, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReflectionsExperience } from "@/components/reflections/ReflectionsExperience";
import { cn } from "@/lib/utils";
import { useToodlTheme } from "@/hooks/useToodlTheme";

import {
  auth,
  provider,
  microsoftProvider,
  facebookProvider,
  signInWithPopup,
} from "@/lib/firebase";
import {
  ensureFlowPlan,
  fetchFlowPlanSnapshot,
  getFlowDateKey,
  saveFlowPlan,
} from "@/lib/flowService";
import { FlowPlan, FlowTask, FlowReflection, FlowCategory } from "@/types/flow";
import { uploadOrbitAttachment, ORBIT_UPLOAD_MAX_BYTES } from "@/lib/orbitStorage";
import { FLOW_MOOD_OPTIONS, getFlowMoodOption } from "@/lib/flowMood";
import { generateId } from "@/lib/id";
import { isMorningHours } from "@/lib/dateUtils";
import {
  getUserGroups,
  getUserGroupsById,
  getExpenses,
  getSettlements,
} from "@/lib/firebaseUtils";
import {
  listBudgetsForMember,
  fetchBudgetMonthSnapshot,
  fetchBudgetMonth,
  getMonthKey as getBudgetMonthKey,
} from "@/lib/budgetService";
import { calculateOpenBalancesMinor, getSettlementPlanMinor } from "@/lib/financeUtils";
import { listSharedLinks } from "@/lib/shareService";
import type { Group, Member, Expense } from "@/types/group";
import type { Settlement } from "@/types/settlement";
import type { BudgetDocument, BudgetMonth, BudgetLedgerEntry } from "@/types/budget";
import {
  CurrencyCode,
  fromMinor,
  FRACTION_DIGITS,

} from "@/lib/currency_core";

import type { SharedLink } from "@/types/share";
import { extractTagsFromText, mergeTagLists } from "@/lib/tagHelpers";
import type {
  DailySummaryPayload,
  InsightVoteDirection,
  OrbitInsightCard,
  WorkTaskHighlight,
  OrbitLearningPlan,
} from "@/types/orbit";
import { OnboardingWizard, type ToodlIntent } from "@/components/onboarding/OnboardingWizard";
import { LearningCarousel } from "@/components/orbit/LearningCarousel";

const THEMES = {
  morning: {
    id: "morning",
    label: "Morning",
    emoji: "☀️",
    gradient: "from-amber-50 via-white to-emerald-50",
    hero: "bg-gradient-to-br from-amber-100/40 via-white to-emerald-100/30",
  },
  night: {
    id: "night",
    label: "Night",
    emoji: "🌙",
    gradient: "from-slate-900 via-slate-800 to-slate-900",
    hero: "bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900",
  },
} as const;

type CurrencySummary = {
  currency: CurrencyCode;
  owed: number;
  owe: number;
  owedGroups: string[];
  oweGroups: string[];
};

type BudgetPulseSummary = {
  title: string;
  monthLabel: string;
  allowance: number;
  spent: number;
  remaining: number;
  streak: number;
  onPace: boolean | null;
  currency: CurrencyCode;
  id: string;
};

const MAX_TIMELINE_ITEMS = 4;
const EMPTY_REFLECTIONS: FlowReflection[] = [];
const FLOW_CATEGORY_LABELS: Record<FlowCategory, string> = {
  work: "Work",
  family: "Family",
  home: "Home & chores",
  wellness: "Wellness",
  play: "Play",
  growth: "Growth",
};

type ProductKey = "orbit" | "flow" | "split" | "pulse";

const PRODUCT_LABELS: Record<ProductKey, string> = {
  orbit: "Orbit",
  flow: "Flow",
  split: "Split",
  pulse: "Pulse",
};

const PRODUCT_BADGES: Record<ProductKey, string> = {
  orbit: "border-indigo-200/80 bg-indigo-50 text-indigo-700",
  flow: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  split: "border-orange-200/80 bg-orange-50 text-orange-700",
  pulse: "border-purple-200/80 bg-purple-50 text-purple-700",
};

type SearchResultItem = {
  id: string;
  product: ProductKey;
  title: string;
  subtitle?: string;
  tags: string[];
  normalizedTags: string[];
  href?: string;
  externalUrl?: string | null;
};

const normaliseTagList = (tags: Array<string | null | undefined>) => {
  const display: string[] = [];
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const raw of tags) {
    if (!raw || typeof raw !== "string") {
      continue;
    }
    const cleaned = raw.replace(/^#/, "").trim();
    if (!cleaned) {
      continue;
    }
    const lower = cleaned.toLowerCase();
    if (seen.has(lower)) {
      continue;
    }
    seen.add(lower);
    display.push(cleaned);
    normalized.push(lower);
  }

  return { display, normalized };
};

const normaliseQueryTokens = (query: string) =>
  query
    .toLowerCase()
    .replace(/#/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const formatBudgetAmount = (value: number, currency: CurrencyCode | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }
  try {
    return Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return value.toFixed(0);
  }
};

const normalizeTaskTitle = (title: string) => title.trim().toLowerCase();


export default function DailyDashboardPage() {
  const hour = new Date().getHours();
  const isMorning = isMorningHours(hour);
  const isSunday = new Date().getDay() === 0;
  const { theme, setTheme, isNight } = useToodlTheme(
    isMorning ? "morning" : "night"
  );
  const defaultMoodId = FLOW_MOOD_OPTIONS[0]?.id ?? "calm";
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [flowPlan, setFlowPlan] = useState<FlowPlan | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [reflectionMood, setReflectionMood] = useState(defaultMoodId);
  const [reflectionNote, setReflectionNote] = useState("");
  const [reflectionPhoto, setReflectionPhoto] = useState<File | null>(null);
  const [reflectionPhotoName, setReflectionPhotoName] = useState<string | null>(null);
  const [reflectionBusy, setReflectionBusy] = useState(false);
  const [reflectionStatus, setReflectionStatus] = useState<string | null>(null);
  const [showReflectionsExperience, setShowReflectionsExperience] = useState(false);
  const [reflectionStreakDays, setReflectionStreakDays] = useState(0);
  const [lastReflectionAt, setLastReflectionAt] = useState<string | null>(null);
  const [reflectionStreakLoading, setReflectionStreakLoading] = useState(true);

  const [splitTotals, setSplitTotals] = useState<CurrencySummary[]>([]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [budgetPulse, setBudgetPulse] = useState<BudgetPulseSummary | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [orbitShares, setOrbitShares] = useState<SharedLink[]>([]);
  const [orbitSharesLoading, setOrbitSharesLoading] = useState(false);
  const [orbitSharesError, setOrbitSharesError] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummaryPayload | null>(null);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false);
  const [insightVotes, setInsightVotes] = useState<Record<string, InsightVoteDirection>>({});
  const [insightMessages, setInsightMessages] = useState<Record<string, string>>({});
  const [savingInsightId, setSavingInsightId] = useState<string | null>(null);
  const [splitSources, setSplitSources] = useState<Array<{ group: Group; expenses: Expense[] }>>([]);
  const [budgetEntries, setBudgetEntries] = useState<BudgetLedgerEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [anchorAddState, setAnchorAddState] = useState<Record<string, "adding" | "added">>({});
  const [activePlans, setActivePlans] = useState<OrbitLearningPlan[]>([]);

  // Onboarding / Intent State
  const [intent, setIntent] = useState<ToodlIntent | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardChecked, setWizardChecked] = useState(false);

  const shouldShow = useCallback((feature: "split" | "pulse" | "flow" | "orbit") => {
    if (!intent) return false;
    if (intent === "all") return true;
    return intent === feature;
  }, [intent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("toodl_intent") as ToodlIntent | null;
    if (stored) {
      setIntent(stored);
    } else {
      setShowWizard(true);
    }
    setWizardChecked(true);
  }, []);

  const handleWizardComplete = (selected: ToodlIntent) => {
    setIntent(selected);
    setShowWizard(false);
    window.localStorage.setItem("toodl_intent", selected);
  };

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const persistFlowPlan = useCallback(
    async (nextPlan: FlowPlan) => {
      if (!user) {
        return;
      }
      try {
        await saveFlowPlan(user.uid, nextPlan);
      } catch (error) {
        console.error("Failed to save Flow plan", error);
        setFlowError("We couldn't save your Flow reflection. Try again in a moment.");
      }
    },
    [user]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      setUser(current);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setAnchorAddState({});
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setOrbitShares([]);
      setOrbitSharesError(null);
      return;
    }
    let cancelled = false;
    setOrbitSharesLoading(true);
    setOrbitSharesError(null);
    listSharedLinks(user.uid)
      .then((shares) => {
        if (!cancelled) {
          setOrbitShares(shares);
        }
      })
      .catch((error) => {
        console.error("Failed to load Orbit saves", error);
        if (!cancelled) {
          setOrbitShares([]);
          setOrbitSharesError("We couldn't load your Orbit saves.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOrbitSharesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);


  // Load personalized daily summary in the morning
  useEffect(() => {
    if (!user?.uid || !isMorning) {
      setDailySummary(null);
      setDailySummaryLoading(false);
      setInsightVotes({});
      setInsightMessages({});
      return;
    }
    let cancelled = false;
    setDailySummaryLoading(true);

    const loadDailySummary = async () => {
      try {
        const response = await fetch(`/api/orbit/daily-summary?userId=${user.uid}`);
        if (!response.ok) {
          if (!cancelled) {
            setDailySummary(null);
            setDailySummaryLoading(false);
            setInsightVotes({});
            setInsightMessages({});
          }
          return;
        }

        const data = await response.json();
        if (data.message || data.error || !data.overview) {
          if (!cancelled) {
            setDailySummary(null);
            setDailySummaryLoading(false);
            setInsightVotes({});
            setInsightMessages({});
          }
          return;
        }

        if (!cancelled) {
          setDailySummary(data as DailySummaryPayload);
          setInsightVotes({});
          setInsightMessages({});
        }
      } catch (error) {
        console.error("Failed to load daily summary", error);
        if (!cancelled) {
          setDailySummary(null);
          setInsightVotes({});
          setInsightMessages({});
        }
      } finally {
        if (!cancelled) {
          setDailySummaryLoading(false);
        }
      }
    };

    void loadDailySummary();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, isMorning]);

  useEffect(() => {
    if (!user) return;
    const fetchActivePlans = async () => {
      try {
        // We need a new endpoint to just fetch active plans, or use the existing one?
        // The existing /api/orbit/learning-lessons was fetching lessons.
        // We can reuse it but change the logic, OR use a new endpoint.
        // Let's use the existing one but rename it or just change the implementation?
        // Wait, I created /api/orbit/plan-lesson for single lesson.
        // I need an endpoint to get the LIST of plans.
        // `getLearningPlans` is a server function. I can make an API for it.
        // Or I can use /api/orbit/learning-lessons and change it to return plans?
        // Let's modify /api/orbit/learning-lessons to return plans instead of lessons.
        const res = await fetch(`/api/orbit/learning-lessons?userId=${user.uid}&mode=plans`);
        if (res.ok) {
          const data = await res.json();
          if (data.plans && Array.isArray(data.plans)) {
            setActivePlans(data.plans);
          }
        }
      } catch (e) {
        console.error("Failed to fetch active plans", e);
      }
    };
    fetchActivePlans();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setFlowPlan(null);
      return;
    }
    let cancelled = false;
    setFlowLoading(true);
    setFlowError(null);
    ensureFlowPlan(user.uid, getFlowDateKey(), timezone)
      .then((plan) => {
        if (!cancelled) {
          setFlowPlan(plan);
        }
      })
      .catch((error) => {
        console.error("Failed to load Flow plan", error);
        if (!cancelled) {
          setFlowError("We couldn't load your Flow plan.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFlowLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [timezone, user]);

  useEffect(() => {
    if (!user) {
      setSplitTotals([]);
      setSplitSources([]);
      return;
    }
    let cancelled = false;
    setSplitLoading(true);
    setSplitError(null);

    const loadSplit = async () => {
      try {
        let groups: Group[] = [];
        if (user.email) {
          groups = await getUserGroups(user.email);
        }
        if (!groups.length) {
          groups = await getUserGroupsById(user.uid);
        }
        const enriched = await Promise.all(
          groups.map(async (group) => {
            const [expenses, settlements] = await Promise.all([
              getExpenses(group.id),
              getSettlements(group.id),
            ]);
            return { group, expenses, settlements };
          })
        );
        if (cancelled) {
          return;
        }
        setSplitSources(
          enriched.map(({ group, expenses }) => ({
            group,
            expenses,
          }))
        );
        const summary = buildSplitSummary(enriched, user);
        setSplitTotals(summary);
      } catch (error) {
        console.error("Failed to load split summary", error);
        if (!cancelled) {
          setSplitError("We couldn't load your group balances.");
        }
      } finally {
        if (!cancelled) {
          setSplitLoading(false);
        }
      }
    };

    void loadSplit();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user?.uid) {
      setReflectionStreakDays(0);
      setLastReflectionAt(null);
      setReflectionStreakLoading(false);
      return;
    }
    let cancelled = false;
    const loadReflectionStreak = async () => {
      setReflectionStreakLoading(true);
      try {
        const lookbackDays = 10;
        const today = new Date();
        const dateKeys = Array.from({ length: lookbackDays }, (_, offset) => {
          const date = new Date(today);
          date.setDate(today.getDate() - offset);
          return getFlowDateKey(date);
        });

        const plans = await Promise.all(
          dateKeys.map((key, index) =>
            index === 0 && flowPlan
              ? Promise.resolve(flowPlan)
              : fetchFlowPlanSnapshot(user.uid, key)
          )
        );
        if (cancelled) {
          return;
        }
        let streak = 0;
        let started = false;
        let latestReflection: string | null = null;

        for (let index = 0; index < dateKeys.length; index += 1) {
          const plan = plans[index];
          const reflections = plan?.reflections ?? [];
          const hasReflections = reflections.length > 0;
          if (!latestReflection && hasReflections) {
            latestReflection =
              reflections[0]?.createdAt ??

              plan?.updatedAt ??
              null;
          }
          if (!started && index === 0 && !hasReflections) {
            continue;
          }
          if (hasReflections) {
            started = true;
            streak += 1;
          } else if (started) {
            break;
          }
        }

        if (!cancelled) {
          setReflectionStreakDays(streak);
          setLastReflectionAt(latestReflection);
        }
      } catch (error) {
        console.error("Failed to load reflection streak", error);
        if (!cancelled) {
          setReflectionStreakDays(0);
        }
      } finally {
        if (!cancelled) {
          setReflectionStreakLoading(false);
        }
      }
    };
    void loadReflectionStreak();
    return () => {
      cancelled = true;
    };
  }, [flowPlan, user?.uid]);

  useEffect(() => {
    if (!user || !isSunday) {
      setWeeklySummary(null);
      setWeeklyLoading(false);
      setWeeklyError(null);
      return;
    }
    let cancelled = false;
    setWeeklyLoading(true);
    setWeeklyError(null);
    const loadWeekly = async () => {
      try {
        const today = new Date();
        const dateKeys = Array.from({ length: 7 }, (_, offset) => {
          const date = new Date(today);
          date.setDate(today.getDate() - offset);
          return getFlowDateKey(date);
        });
        const results = await Promise.all(
          dateKeys.map((key) => fetchFlowPlanSnapshot(user.uid, key))
        );
        if (cancelled) {
          return;
        }
        const nonNullPlans = results.filter((plan): plan is FlowPlan => Boolean(plan));
        setWeeklySummary(buildWeeklyDigest(nonNullPlans));
      } catch (error) {
        console.error("Failed to load weekly summary", error);
        if (!cancelled) {
          setWeeklyError("We couldn't build this week's summary.");
        }
      } finally {
        if (!cancelled) {
          setWeeklyLoading(false);
        }
      }
    };
    void loadWeekly();
    return () => {
      cancelled = true;
    };
  }, [isSunday, user]);

  useEffect(() => {
    if (!user?.uid) {
      setBudgetPulse(null);
      setBudgetError(null);
      setBudgetEntries([]);
      return;
    }
    let cancelled = false;
    setBudgetLoading(true);
    setBudgetError(null);

    const loadBudgetPulse = async () => {
      try {
        const budgets = await listBudgetsForMember(user.uid);
        if (!budgets.length) {
          if (!cancelled) {
            setBudgetPulse(null);
            setBudgetEntries([]);
          }
          return;
        }
        const primary = budgets
          .slice()
          .sort(
            (a, b) =>
              new Date(b.updatedAt ?? 0).getTime() -
              new Date(a.updatedAt ?? 0).getTime()
          )[0];
        if (!primary) {
          if (!cancelled) {
            setBudgetPulse(null);
            setBudgetEntries([]);
          }
          return;
        }
        const monthKey = getBudgetMonthKey();
        const month =
          (await fetchBudgetMonthSnapshot(primary.id, monthKey)) ??
          (await fetchBudgetMonth(primary.id, monthKey));
        if (cancelled) {
          return;
        }
        setBudgetEntries(month?.entries ?? []);
        const summary = buildBudgetPulseSummary(primary, month, monthKey);
        setBudgetPulse(summary);
      } catch (error) {
        console.error("Failed to load budget pulse", error);
        if (!cancelled) {
          setBudgetError("We couldn't load your budget.");
          setBudgetPulse(null);
          setBudgetEntries([]);
        }
      } finally {
        if (!cancelled) {
          setBudgetLoading(false);
        }
      }
    };

    void loadBudgetPulse();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const upcomingTasks = useMemo(() => {
    if (!flowPlan?.tasks?.length) {
      return [];
    }
    return flowPlan.tasks
      .filter((task) => task.status === "pending" || task.status === "in_progress")
      .sort((a, b) => getTaskTime(a) - getTaskTime(b))
      .slice(0, 3);
  }, [flowPlan?.tasks]);

  const completedTasks = useMemo(() => {
    if (!flowPlan?.tasks?.length) {
      return 0;
    }
    return flowPlan.tasks.filter((task) => task.status === "done").length;
  }, [flowPlan?.tasks]);

  const timelineMoments = useMemo(() => buildTimeline(flowPlan), [flowPlan]);
  const reflections = flowPlan?.reflections ?? EMPTY_REFLECTIONS;
  const latestReflection = reflections[0] ?? null;


  const primarySummary = splitTotals[0] ?? null;
  const searchTokens = useMemo(() => normaliseQueryTokens(searchQuery), [searchQuery]);
  const searchableItems = useMemo(() => {
    const items: SearchResultItem[] = [];

    if (flowPlan?.tasks?.length) {
      for (const task of flowPlan.tasks) {
        const { display, normalized } = normaliseTagList([task.category]);
        if (!display.length) {
          continue;
        }
        items.push({
          id: `flow-${task.id}`,
          product: "flow",
          title: task.title,
          subtitle: `${FLOW_CATEGORY_LABELS[task.category]} · Flow task`,
          tags: display,
          normalizedTags: normalized,
          href: "/flow",
        });
      }
    }

    if (orbitShares.length) {
      for (const share of orbitShares) {
        const { display, normalized } = normaliseTagList(share.tags ?? []);
        if (!display.length) {
          continue;
        }
        items.push({
          id: `orbit-${share.id}`,
          product: "orbit",
          title: share.title ?? share.url ?? "Saved link",
          subtitle: share.description ?? share.sourceApp ?? "Orbit link",
          tags: display,
          normalizedTags: normalized,
          href: "/scratch-pad",
          externalUrl: share.url,
        });
      }
    }

    if (splitSources.length) {
      for (const { group, expenses } of splitSources) {
        const groupTagList = mergeTagLists(group.tags ?? [], extractTagsFromText(group.name));
        const groupTagInfo = normaliseTagList(groupTagList);
        const normalizedGroupName = group.name?.toLowerCase().trim() ?? "";
        const groupNormalizedTokens = normalizedGroupName
          ? Array.from(new Set([...groupTagInfo.normalized, normalizedGroupName]))
          : groupTagInfo.normalized;

        if (groupNormalizedTokens.length) {
          items.push({
            id: `split-group-${group.id}`,
            product: "split",
            title: group.name,
            subtitle: "Split group",
            tags: groupTagInfo.display,
            normalizedTags: groupNormalizedTokens,
            href: `/split?groupId=${group.id}`,
          });
        }

        for (const expense of expenses) {
          const { display, normalized } = normaliseTagList(expense.tags ?? []);
          if (!display.length) {
            continue;
          }
          items.push({
            id: `split-${group.id}-${expense.id}`,
            product: "split",
            title: expense.description,
            subtitle: `${group.name} · Split expense`,
            tags: display,
            normalizedTags: normalized,
            href: `/split?groupId=${group.id}`,
          });
        }
      }
    }

    if (budgetEntries.length) {
      for (const entry of budgetEntries) {
        const { display, normalized } = normaliseTagList(entry.tags ?? []);
        if (!display.length) {
          continue;
        }
        items.push({
          id: `pulse-${entry.id}`,
          product: "pulse",
          title: entry.merchant ?? entry.category,
          subtitle: `${entry.category} · ${formatBudgetAmount(
            entry.amount,
            budgetPulse?.currency
          )}`,
          tags: display,
          normalizedTags: normalized,
          href: "/budget",
        });
      }
    }

    return items;
  }, [budgetEntries, budgetPulse?.currency, flowPlan?.tasks, orbitShares, splitSources]);

  const filteredSearchResults = useMemo(() => {
    if (!searchTokens.length) {
      return [];
    }
    return searchableItems.filter((item) =>
      searchTokens.every((token) => item.normalizedTags.some((tag) => tag.includes(token)))
    );
  }, [searchTokens, searchableItems]);

  const isSearchActive = searchTokens.length > 0;
  const searchLoading =
    isSearchActive &&
    (orbitSharesLoading || flowLoading || splitLoading || budgetLoading);
  const searchErrors = useMemo(
    () =>
      Array.from(
        new Set(
          [flowError, splitError, budgetError, orbitSharesError].filter(
            (message): message is string => Boolean(message)
          )
        )
      ),
    [budgetError, flowError, orbitSharesError, splitError]
  );
  const searchPlaceholder = user
    ? "Search tags like #work or wellness"
    : "Sign in to search your tags";
  const searchDisabled = !user;

  const handleReflectionSubmit = useCallback(async () => {
    if (!user || !flowPlan) {
      setReflectionStatus("Sign in to save reflections.");
      return;
    }
    const trimmed = reflectionNote.trim();
    if (!trimmed) {
      setReflectionStatus("Write a quick sentence before saving.");
      return;
    }
    setReflectionBusy(true);
    setReflectionStatus(null);
    try {
      let photoUrl: string | null = null;
      if (reflectionPhoto) {
        const upload = await uploadOrbitAttachment(user.uid, reflectionPhoto);
        photoUrl = upload.downloadUrl;
      }
      const selectedMood = getFlowMoodOption(reflectionMood) ?? FLOW_MOOD_OPTIONS[0];
      const nowIso = new Date().toISOString();
      const newReflection: FlowReflection = {
        id: generateId(),
        taskId: null,
        note: trimmed,
        sentiment: selectedMood.sentiment,
        mood: selectedMood.emoji,
        moodLabel: selectedMood.label,
        photoUrl,
        createdAt: nowIso,
      };
      setFlowPlan((prev) => {
        if (!prev) {
          return prev;
        }
        const updated = {
          ...prev,
          reflections: [newReflection, ...prev.reflections],
          updatedAt: nowIso,
        } satisfies FlowPlan;
        void persistFlowPlan(updated);
        return updated;
      });
      setReflectionNote("");
      setReflectionPhoto(null);
      setReflectionPhotoName(null);
      setReflectionMood(defaultMoodId);
      setReflectionStatus("Saved to Flow.");
    } catch (error) {
      console.error("Failed to save reflection", error);
      setReflectionStatus("We couldn't save that. Try again.");
    } finally {
      setReflectionBusy(false);
    }
  }, [defaultMoodId, flowPlan, persistFlowPlan, reflectionMood, reflectionNote, reflectionPhoto, user]);

  const handlePhotoChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setReflectionPhoto(null);
      setReflectionPhotoName(null);
      return;
    }
    if (file.size > ORBIT_UPLOAD_MAX_BYTES) {
      const maxMb = Math.round((ORBIT_UPLOAD_MAX_BYTES / (1024 * 1024)) * 10) / 10;
      setReflectionStatus(`Choose a file under ${maxMb} MB.`);
      return;
    }
    setReflectionStatus(null);
    setReflectionPhoto(file);
    setReflectionPhotoName(file.name);
  }, []);

  const palette = THEMES[theme];
  const greetingName = user?.displayName?.split(" ")[0] ?? "friend";




  const handleSearchClear = useCallback(() => {
    setSearchQuery("");
  }, []);

  const handleResultNavigate = useCallback(
    (item: SearchResultItem) => {
      if (item.href) {
        router.push(item.href);
        return;
      }
      if (item.externalUrl && typeof window !== "undefined") {
        window.open(item.externalUrl, "_blank", "noopener,noreferrer");
      }
    },
    [router]
  );

  const handleResultOpenExternal = useCallback((url: string | null | undefined) => {
    if (!url) {
      return;
    }
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const handleAddAnchorToFlow = useCallback(
    (task: WorkTaskHighlight) => {
      if (!user || !flowPlan) {
        return;
      }
      const key = normalizeTaskTitle(task.title);
      if (!key || anchorAddState[key] === "adding" || anchorAddState[key] === "added") {
        return;
      }
      const alreadyInFlow =
        flowPlan.tasks?.some(
          (existing) => normalizeTaskTitle(existing.title) === key
        ) ?? false;
      if (alreadyInFlow) {
        setAnchorAddState((prev) => ({ ...prev, [key]: "added" }));
        return;
      }
      setAnchorAddState((prev) => ({ ...prev, [key]: "adding" }));
      const nowIso = new Date().toISOString();
      setFlowPlan((prev) => {
        if (!prev) {
          return prev;
        }
        const sequence = (prev.tasks?.length ?? 0) + 1;
        const nextTask: FlowTask = {
          id: generateId(),
          title: task.title,
          type: "priority",
          category: "work",
          estimateMinutes: 45,
          sequence,
          status: "pending",
          notes: task.note ?? null,
          scheduledStart: null,
          scheduledEnd: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const updated = {
          ...prev,
          tasks: [...prev.tasks, nextTask],
          updatedAt: nowIso,
        } satisfies FlowPlan;
        void persistFlowPlan(updated);
        return updated;
      });
      setAnchorAddState((prev) => ({ ...prev, [key]: "added" }));
    },
    [anchorAddState, flowPlan, persistFlowPlan, user]
  );

  const anchorStatusLookup = useCallback(
    (task: WorkTaskHighlight) => {
      const key = normalizeTaskTitle(task.title);
      if (!key) {
        return null;
      }
      const alreadyInFlow =
        flowPlan?.tasks?.some(
          (existing) => normalizeTaskTitle(existing.title) === key
        ) ?? false;
      if (alreadyInFlow) {
        return "added";
      }
      return anchorAddState[key] ?? null;
    },
    [anchorAddState, flowPlan]
  );

  const handleInsightVote = useCallback(
    async (insight: OrbitInsightCard, direction: InsightVoteDirection) => {
      if (!user?.uid) {
        setInsightMessages((prev) => ({
          ...prev,
          [insight.id]: "Sign in to personalize these cards.",
        }));
        return;
      }

      setInsightVotes((prev) => ({ ...prev, [insight.id]: direction }));
      try {
        const response = await fetch("/api/orbit/insight-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            topic: insight.topic,
            vote: direction,
          }),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        setInsightMessages((prev) => ({
          ...prev,
          [insight.id]:
            direction === "more"
              ? "Got it - we'll bring more like this."
              : "Understood - we'll dial this topic down.",
        }));
      } catch (error) {
        console.error("Failed to record insight vote", error);
        setInsightMessages((prev) => ({
          ...prev,
          [insight.id]: "Couldn't record that vote. Try again shortly.",
        }));
        setInsightVotes((prev) => {
          const next = { ...prev };
          delete next[insight.id];
          return next;
        });
      }
    },
    [user?.uid]
  );

  const handleInsightSave = useCallback(
    async (insight: OrbitInsightCard) => {
      if (!user?.uid) {
        setInsightMessages((prev) => ({
          ...prev,
          [insight.id]: "Sign in to save this to Orbit.",
        }));
        return;
      }
      setSavingInsightId(insight.id);
      try {
        const response = await fetch("/api/orbit/insight-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            insight,
          }),
        });
        const payload = await response.json();
        if (!response.ok || payload?.error) {
          throw new Error(payload?.error ?? "Failed to save insight");
        }
        setInsightMessages((prev) => ({
          ...prev,
          [insight.id]: "Saved to Orbit.",
        }));
      } catch (error) {
        console.error("Failed to save insight", error);
        setInsightMessages((prev) => ({
          ...prev,
          [insight.id]: "Couldn't save to Orbit. Try again.",
        }));
      } finally {
        setSavingInsightId(null);
      }
    },
    [user?.uid]
  );

  const [authChecked, setAuthChecked] = useState(false);
  const [isAnon, setIsAnon] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("anon_member");
      setIsAnon(Boolean(stored));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      setUser(current);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = useCallback(
    async (providerType: "google" | "microsoft" | "facebook") => {
      try {
        const selectedProvider =
          providerType === "microsoft"
            ? microsoftProvider
            : providerType === "facebook"
              ? facebookProvider
              : provider;
        await signInWithPopup(auth, selectedProvider);
      } catch (err) {
        console.error("Sign-in failed", err);
      }
    },
    []
  );

  if (authChecked && !user && !isAnon) {
    return (
      <div className={cn("min-h-screen px-4 py-10 sm:px-6", isNight ? "bg-slate-950" : "bg-slate-50/80")}>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <Card className="flex flex-col items-center gap-4 border-slate-200 bg-white/90 p-10 text-center shadow-xl shadow-slate-300/40 backdrop-blur">
            <Sparkles className="h-10 w-10 text-indigo-400" />
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">
                Welcome to your Dashboard
              </h2>
              <p className="text-sm text-slate-500">
                Sign in to see your daily summary, flow tasks, and budget pulse.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => handleSignIn("google")} className="gap-2">
                Continue with Google
              </Button>
              <Button variant="outline" onClick={() => handleSignIn("microsoft")}>
                Microsoft
              </Button>
              <Button variant="outline" onClick={() => handleSignIn("facebook")}>
                Facebook
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Onboarding Wizard Overlay */}
      {showWizard && <OnboardingWizard onComplete={handleWizardComplete} />}

      {/* Main Content - Only show if wizard is checked and (not showing wizard OR wizard is done) */}
      {wizardChecked && !showWizard && (
        <div className={cn("min-h-screen pb-24 transition-colors duration-700", palette.gradient)}>
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
            {/* Header & Search */}
            <header
              className={cn(
                "relative z-10 rounded-[32px] border border-white/40 p-6 shadow-lg backdrop-blur",
                palette.hero,
                theme === "night" ? "text-white" : "text-slate-900"
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.4em] text-current/70">
                  Ritual dashboard
                </span>
              </div>

              <div className={cn(
                "absolute bottom-2 right-4 flex gap-1 rounded-full border p-0.5",
                theme === "night"
                  ? "border-white/30 bg-white/10"
                  : "border-slate-200 bg-slate-50/80"
              )}>
                {Object.values(THEMES).map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    className={cn(
                      "flex items-center justify-center rounded-full px-2 py-1 text-[10px] transition-all",
                      theme === option.id
                        ? theme === "night"
                          ? "bg-white/20 text-white shadow-sm"
                          : "bg-white text-slate-900 shadow-sm"
                        : theme === "night"
                          ? "text-white/60 hover:text-white/80"
                          : "text-slate-400 hover:text-slate-600"
                    )}
                    title={option.label}
                  >
                    <span className="text-sm leading-none">{option.emoji}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className={cn("text-3xl font-bold", theme === "night" && "text-white")}>Hey {greetingName}, keep the loop kind.</h1>
                  <p className={cn("text-base", theme === "night" ? "text-indigo-100" : "text-slate-600")}>
                    See → Do → Feel → Reflect without bouncing tabs.
                  </p>
                </div>
              </div>
            </header>

            <div
              className={cn(
                "rounded-[28px] border p-6 shadow-lg backdrop-blur",
                isNight
                  ? "border-white/10 bg-slate-900/50 text-white"
                  : "border-white/70 bg-white/90 text-slate-900"
              )}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500">
                    Search anything
                  </p>
                  <p className={cn("text-sm", isNight ? "text-indigo-100" : "text-slate-600")}>
                    Find Orbit saves, Flow anchors, Split expenses, and Pulse entries by tag.
                  </p>
                </div>
                <div className="relative w-full md:max-w-md">
                  <Search
                    className={cn(
                      "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                      isNight ? "text-white/60" : "text-slate-500"
                    )}
                  />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    disabled={searchDisabled}
                    aria-label="Search by tags"
                    className={cn(
                      "pl-9",
                      isNight
                        ? "border-white/15 bg-white/10 text-white placeholder:text-white/40"
                        : "border-slate-200 bg-white"
                    )}
                  />
                </div>
              </div>
              {isSearchActive ? (
                <div className="mt-4">
                  <SearchResultsPane
                    query={searchQuery}
                    results={filteredSearchResults}
                    loading={searchLoading}
                    errors={searchErrors}
                    onClear={handleSearchClear}
                    onNavigate={handleResultNavigate}
                    onOpenExternal={handleResultOpenExternal}
                    isNight={isNight}
                  />
                </div>
              ) : null}
            </div>

            {shouldShow("flow") && (
              isMorning ? (
                <>
                  {flowLoading ? (
                    <SkeletonBanner label="Loading Flow insights" />
                  ) : flowPlan ? (
                    <FlowCards
                      isMorning={isMorning}
                      isNight={isNight}
                      upcomingTasks={upcomingTasks}
                      completedTasks={completedTasks}
                      totalTasks={flowPlan.tasks?.length ?? 0}
                      latestReflection={latestReflection}
                      onAddJournal={() => router.push("/journal")}
                      onReflect={() => router.push("/flow")}
                      onOpenFlow={() => router.push("/flow")}
                    />
                  ) : (
                    <SkeletonBanner label={flowError ?? "Sign in to see Flow insights"} />
                  )}
                  <div className="space-y-6">
                    <DailyWorkSummaryCard summary={dailySummary} loading={dailySummaryLoading} isNight={isNight} />
                    <DailyRecommendationCard
                      summary={dailySummary}
                      loading={dailySummaryLoading}
                      isNight={isNight}
                      onAddAnchor={handleAddAnchorToFlow}
                      anchorStatusLookup={anchorStatusLookup}
                      canAddAnchors={Boolean(user && flowPlan)}
                    />
                    {activePlans.length > 0 ? (
                      <LearningCarousel
                        plans={activePlans}
                        isNight={isNight}
                        userId={user?.uid}
                      />
                    ) : (
                      <InsightCarousel
                        insights={dailySummary?.insights ?? []}
                        loading={dailySummaryLoading}
                        isNight={isNight}
                        votes={insightVotes}
                        messages={insightMessages}
                        savingInsightId={savingInsightId}
                        onVote={handleInsightVote}
                        onSave={handleInsightSave}
                        canInteract={Boolean(user)}
                      />
                    )}
                  </div>
                </>
              ) : flowLoading ? (
                <SkeletonBanner label="Loading Flow insights" />
              ) : flowPlan ? (
                <>
                  <FlowCards
                    isMorning={isMorning}
                    isNight={isNight}
                    upcomingTasks={upcomingTasks}
                    completedTasks={completedTasks}
                    totalTasks={flowPlan.tasks?.length ?? 0}
                    latestReflection={latestReflection}
                    onAddJournal={() => router.push("/journal")}
                    onReflect={() => router.push("/flow")}
                    onOpenFlow={() => router.push("/flow")}
                  />
                  <div className="mt-6">
                    {activePlans.length > 0 ? (
                      <LearningCarousel
                        plans={activePlans}
                        isNight={isNight}
                        userId={user?.uid}
                      />
                    ) : (
                      <InsightCarousel
                        insights={dailySummary?.insights ?? []}
                        loading={dailySummaryLoading}
                        isNight={isNight}
                        votes={insightVotes}
                        messages={insightMessages}
                        savingInsightId={savingInsightId}
                        onVote={handleInsightVote}
                        onSave={handleInsightSave}
                        canInteract={Boolean(user)}
                      />
                    )}
                  </div>
                </>
              ) : (
                <SkeletonBanner label={flowError ?? "Sign in to see Flow insights"} />
              )
            )}

            {shouldShow("flow") && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card
                  className={cn(
                    "rounded-[28px] p-6 shadow-sm",
                    isNight
                      ? "border-white/15 bg-slate-900/60 text-white"
                      : "border border-indigo-200 bg-indigo-50/70 text-slate-900"
                  )}
                >
                  <CardHeader className="p-0">
                    <p
                      className={cn(
                        "text-xs font-semibold uppercase tracking-[0.35em]",
                        isNight ? "text-indigo-200" : "text-indigo-500"
                      )}
                    >
                      Mood + photo
                    </p>
                    <CardTitle className={cn("text-xl", isNight ? "text-white" : "text-indigo-900")}>
                      Drop a feeling and a photo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label
                          className={cn(
                            "text-xs font-semibold uppercase tracking-[0.35em]",
                            isNight ? "text-indigo-100" : "text-indigo-500"
                          )}
                        >
                          Mood
                        </label>
                        <select
                          value={reflectionMood}
                          onChange={(event) => setReflectionMood(event.target.value)}
                          className={cn(
                            "mt-2 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none",
                            isNight
                              ? "border-white/30 bg-slate-900/50 text-white focus:border-indigo-200"
                              : "border-indigo-200 bg-white text-slate-700 focus:border-indigo-300"
                          )}
                        >
                          {FLOW_MOOD_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.emoji} {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          className={cn(
                            "text-xs font-semibold uppercase tracking-[0.35em]",
                            isNight ? "text-indigo-100" : "text-indigo-500"
                          )}
                        >
                          Photo
                        </label>
                        <Input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className={cn(
                            "mt-2 cursor-pointer text-sm",
                            isNight
                              ? "border-white/30 bg-slate-900/50 text-white"
                              : "border-indigo-200"
                          )}
                          onChange={handlePhotoChange}
                        />
                        <p className={cn("mt-1 text-xs", isNight ? "text-indigo-200" : "text-indigo-500")}>
                          {reflectionPhotoName
                            ? `Attached: ${reflectionPhotoName}`
                            : "Optional — shows up in Flow reflections."}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label
                        className={cn(
                          "text-xs font-semibold uppercase tracking-[0.35em]",
                          isNight ? "text-indigo-100" : "text-indigo-500"
                        )}
                      >
                        Reflection
                      </label>
                      <Textarea
                        className={cn(
                          "mt-2 min-h-[100px]",
                          isNight
                            ? "border-white/30 bg-slate-900/40 text-white placeholder:text-slate-400"
                            : "border-indigo-200"
                        )}
                        placeholder="What moment stands out?"
                        value={reflectionNote}
                        onChange={(event) => setReflectionNote(event.target.value)}
                      />
                    </div>
                    {reflectionStatus ? (
                      <p className={cn("text-sm", isNight ? "text-indigo-200" : "text-indigo-700")}>{reflectionStatus}</p>
                    ) : null}
                    <Button
                      className={cn(
                        "text-white",
                        isNight ? "bg-indigo-500 hover:bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-500"
                      )}
                      onClick={handleReflectionSubmit}
                      disabled={reflectionBusy}
                    >
                      {reflectionBusy ? <Spinner size="sm" className="text-white" /> : "Sync to Flow"}
                    </Button>
                  </CardContent>
                </Card>
                <ReflectionStreakCard
                  streak={reflectionStreakDays}
                  lastReflectionAt={lastReflectionAt}
                  loading={reflectionStreakLoading}
                  dark={isNight}
                  onViewHistory={() => setShowReflectionsExperience(true)}
                  photoUrl={latestReflection?.photoUrl ?? null}
                  photoNote={latestReflection?.note ?? null}
                />
              </div>
            )}

            <Dialog open={showReflectionsExperience} onOpenChange={setShowReflectionsExperience}>
              <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="sr-only">
                  <DialogTitle>Reflections History</DialogTitle>
                </DialogHeader>
                <ReflectionsExperience user={user} onClose={() => setShowReflectionsExperience(false)} />
              </DialogContent>
            </Dialog>


            {(shouldShow("pulse") || shouldShow("split")) && (
              <div className={cn("grid gap-6", shouldShow("pulse") && shouldShow("split") ? "lg:grid-cols-2" : "grid-cols-1")}>
                {shouldShow("pulse") && (
                  <BudgetPulseCard
                    loading={budgetLoading}
                    error={budgetError}
                    summary={budgetPulse}
                    onOpenBudget={() => router.push("/budget")}
                    dark={isNight}
                  />
                )}

                {shouldShow("split") && (
                  <GroupSummaryCard
                    loading={splitLoading}
                    error={splitError}
                    summaries={splitTotals}
                    primary={primarySummary}
                    onAddExpense={() => router.push("/split")}
                    dark={isNight}
                  />
                )}
              </div>
            )}

            {isSunday && shouldShow("flow") ? (
              <WeeklyDigestCard
                summary={weeklySummary}
                loading={weeklyLoading}
                error={weeklyError}
                moments={timelineMoments}
              />
            ) : null}

            {intent !== "all" && (
              <div className="pt-8 pb-4 text-center">
                <p className="text-sm text-slate-500 mb-3">Looking for more tools?</p>
                <Button
                  variant="outline"
                  onClick={() => handleWizardComplete("all")}
                  className="rounded-full border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Show all features
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

    </>
  );
}

function SearchResultsPane({
  query,
  results,
  loading,
  errors,
  onClear,
  onNavigate,
  onOpenExternal,
  isNight,
}: {
  query: string;
  results: SearchResultItem[];
  loading: boolean;
  errors: string[];
  onClear: () => void;
  onNavigate: (item: SearchResultItem) => void;
  onOpenExternal: (url: string | null | undefined) => void;
  isNight: boolean;
}) {
  const dedupedErrors = Array.from(new Set(errors));
  const hasResults = results.length > 0;
  const statusTone = isNight ? "text-white/70" : "text-slate-600";

  return (
    <Card
      className={cn(
        "rounded-3xl border",
        isNight ? "border-white/10 bg-slate-900/70 text-white" : "border-slate-100 bg-white"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3",
          isNight ? "border-white/10" : "border-slate-100"
        )}
      >
        <div>
          <p className={cn("text-sm font-semibold", isNight ? "text-white" : "text-slate-900")}>
            Results for “{query.trim()}”
          </p>
          <p className={cn("text-xs", statusTone)}>
            {loading ? "Gathering tags across Orbit, Flow, Split, and Pulse…" : `${results.length} matches`}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className={cn(
            "text-xs font-semibold",
            isNight ? "text-white/80 hover:text-white" : "text-slate-600 hover:text-slate-900"
          )}
        >
          Clear
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center gap-3 px-4 py-6 text-sm">
          <Spinner className="h-4 w-4 text-indigo-500" />
          <span className={statusTone}>Looking across your saved products…</span>
        </div>
      ) : null}
      {!loading && hasResults ? (
        <ul className="divide-y divide-slate-100/70">
          {results.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold",
                      PRODUCT_BADGES[item.product],
                      isNight && "border-white/20 bg-white/10 text-white"
                    )}
                  >
                    {PRODUCT_LABELS[item.product]}
                  </Badge>
                  <p className={cn("text-sm font-semibold", isNight ? "text-white" : "text-slate-900")}>
                    {item.title}
                  </p>
                </div>
                {item.subtitle ? (
                  <p className={cn("text-xs", statusTone)}>{item.subtitle}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={`${item.id}-${tag}`}
                      className={cn(
                        "rounded-full border px-3 py-0.5 text-xs font-medium",
                        isNight ? "border-white/15 text-white/80" : "border-slate-200 text-slate-600"
                      )}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                <Button
                  size="sm"
                  variant={isNight ? "secondary" : "outline"}
                  onClick={() => onNavigate(item)}
                  className="text-xs font-semibold"
                >
                  Go to {PRODUCT_LABELS[item.product]}
                </Button>
                {item.externalUrl ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex items-center gap-1 text-xs font-semibold"
                    onClick={() => onOpenExternal(item.externalUrl)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open link
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && !hasResults ? (
        <div className="px-4 py-6 text-sm">
          <p className={statusTone}>
            No items use that tag yet. Add tags from Orbit, Flow, Split, or Pulse to see them here.
          </p>
        </div>
      ) : null}
      {dedupedErrors.length ? (
        <div
          className={cn(
            "border-t px-4 py-3 text-xs",
            isNight ? "border-white/10 text-amber-200" : "border-slate-100 text-amber-700"
          )}
        >
          {dedupedErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function FlowCards({
  isMorning,
  isNight,
  upcomingTasks,
  completedTasks,
  totalTasks,
  latestReflection,
  onAddJournal,
  onReflect,
  onOpenFlow,
}: {
  isMorning: boolean;
  isNight: boolean;
  upcomingTasks: FlowTask[];
  completedTasks: number;
  totalTasks: number;
  latestReflection: FlowReflection | null;
  onAddJournal: () => void;
  onReflect: () => void;
  onOpenFlow: () => void;
}) {
  const openToodlMind = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-toodl-mind"));
    }
  };

  if (isMorning) {
    return (
      <Card className="relative overflow-hidden rounded-[28px] border-none bg-white/90 p-6 shadow-lg">
        <span className="pointer-events-none absolute -top-10 right-4 h-28 w-28 rounded-full bg-gradient-to-br from-amber-300 via-yellow-200 to-orange-200 opacity-70 animate-dashboard-sun" />
        <span className="pointer-events-none absolute -top-8 right-0 h-36 w-36 rounded-full bg-amber-200/30 blur-3xl animate-dashboard-sun-glow" />
        <CardHeader className="flex flex-col gap-3 p-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-500">Morning calm</p>
            <CardTitle className="text-2xl text-slate-900">Good morning.</CardTitle>
            <p className="text-sm text-slate-500">
              {upcomingTasks.length ? "Here's how Flow lined up your next anchors." : "Add a task in Flow to start the day."}
            </p>
          </div>
        </CardHeader>
        <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
          <Highlight
            label="Top Flow events"
            value={
              upcomingTasks.length
                ? upcomingTasks.map((task) => task.title).join(" · ")
                : "No pending tasks just yet."
            }
          />
          <Highlight
            label="Today’s pulse"
            value={
              totalTasks ? (
                <span className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-slate-900">{completedTasks}/{totalTasks}</span>
                  <span className="text-slate-600">done · {totalTasks - completedTasks} to go</span>
                </span>
              ) : (
                "No schedule for today."
              )
            }
          />
          <Highlight
            label="Next anchor"
            value={
              upcomingTasks[0] ? (
                <span className="block font-semibold text-slate-900 leading-snug">
                  {upcomingTasks[0].title} <span className="font-normal text-slate-500">· {formatTaskTimeRange(upcomingTasks[0])}</span>
                </span>
              ) : (
                "Add a top priority to Flow"
              )
            }
          />
          <Highlight
            label="Mind note"
            value={latestReflection?.note ?? "Drop a quick reflection to keep the loop alive."}
          />
        </CardContent>
        <div className="mt-2 flex justify-end">
          <Button
            variant="outline"
            className={cn(
              "px-5 text-sm font-semibold",
              isNight
                ? "border-transparent bg-emerald-500/90 text-slate-900 hover:bg-emerald-400"
                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            )}
            onClick={onOpenFlow}
          >
            Open Flow
          </Button>
        </div>
        <div className="mt-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-500 via-indigo-500/90 to-violet-500 p-4 text-white shadow-lg shadow-indigo-200/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Talk to Toodl Mind</p>
                <p className="text-xs text-indigo-50/90">
                  Add an expense, settle a group tab, or schedule the next block just by asking.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="bg-white/15 text-white hover:bg-white/30"
              onClick={openToodlMind}
            >
              Ask now
            </Button>
          </div>
        </div>
      </Card>
    );
  }
  const progressText = totalTasks
    ? `${completedTasks}/${totalTasks} tasks finished`
    : "Nothing planned yet.";
  return (
    <Card className="relative overflow-hidden rounded-[28px] border-none bg-slate-900 text-white">
      {!isMorning ? (
        <>
          <span className="pointer-events-none absolute -top-12 right-4 h-32 w-32 rounded-full bg-gradient-to-br from-amber-200 via-yellow-100 to-white opacity-80 animate-dashboard-moon" />
          <span className="pointer-events-none absolute -top-10 right-0 h-40 w-40 rounded-full bg-amber-200/25 blur-3xl animate-dashboard-moon-glow" />
        </>
      ) : null}
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Evening reflection</p>
        <CardTitle className="text-2xl">That’s a wrap.</CardTitle>
        <p className="text-sm text-slate-300">{progressText}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Highlight label="Wins" value={getEveningWins(upcomingTasks, completedTasks)} dark />
        <Highlight
          label="Prompt"
          value={latestReflection?.note ?? "What worked today? capture one line."}
          dark
        />
        <Highlight
          label="Streak"
          value={`Reflections logged: ${latestReflection ? "updated" : "0"}`}
          dark
        />
      </CardContent>
      <div className="mt-auto flex flex-wrap gap-3 px-6 pb-6">
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onReflect}>
          + Reflect now
        </Button>
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onAddJournal}>
          + Journal
        </Button>
      </div>
    </Card>
  );
}

function BudgetPulseCard({
  loading,
  error,
  summary,
  onOpenBudget,
  dark = false,
}: {
  loading: boolean;
  error: string | null;
  summary: BudgetPulseSummary | null;
  onOpenBudget: () => void;
  dark?: boolean;
}) {
  const mutedText = dark ? "text-slate-300" : "text-slate-500";
  const streakLabel = summary
    ? summary.streak > 0
      ? `${summary.streak}-day pace`
      : summary.onPace === false
        ? "Off pace today"
        : "No streak yet"
    : null;
  const streakHint = summary
    ? summary.streak > 0
      ? "Protect the run with another on-target day."
      : summary.onPace === false
        ? "Lighten tomorrow’s spend to recover."
        : "Stay on plan today to start a streak."
    : null;
  const streakDisplay = summary ? streakLabel ?? "—" : null;
  const streakMessage = summary ? streakHint ?? "Stay on plan today to start a streak." : null;
  return (
    <Card
      className={cn(
        "rounded-[28px] p-6 shadow-sm",
        dark ? "border-white/15 bg-slate-900/60 text-white" : "border-violet-200 bg-white/95 text-slate-900"
      )}
    >
      <CardHeader className="flex flex-col gap-3 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.35em]",
                dark ? "text-violet-200" : "text-violet-500"
              )}
            >
              Budget
            </p>
            <CardTitle className={cn("text-xl", dark ? "text-white" : "text-slate-900")}>
              This month’s budget
            </CardTitle>
          </div>
          <Button
            variant="outline"
            className={cn(
              "text-sm font-semibold",
              dark
                ? "bg-violet-500/90 text-slate-900 hover:bg-violet-400 border-transparent"
                : "border-slate-200 text-slate-700 hover:bg-slate-100"
            )}
            onClick={onOpenBudget}
          >
            Open budget
          </Button>
        </div>
      </CardHeader>
      <CardContent className="mt-4 space-y-4">
        {loading ? (
          <SkeletonBanner label="Crunching budget pulse" />
        ) : error ? (
          <p className="text-sm text-rose-500">{error}</p>
        ) : summary ? (
          <>
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.3em]",
                dark ? "text-slate-200" : "text-slate-400"
              )}
            >
              {summary.title}
            </p>
            <div
              className={cn(
                "rounded-2xl border p-4",
                dark ? "border-violet-200/30 bg-violet-500/10" : "border-violet-100 bg-violet-50/70"
              )}
            >
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.3em]",
                  dark ? "text-violet-200" : "text-violet-500"
                )}
              >
                {summary.monthLabel}
              </p>
              <p className={cn("text-2xl font-semibold", dark ? "text-white" : "text-violet-900")}>
                {formatCurrency(summary.spent, summary.currency)}
              </p>
              <p className={cn("text-xs", dark ? "text-violet-100" : "text-violet-700")}>Spent so far</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className={cn(
                  "rounded-2xl border p-4",
                  dark ? "border-emerald-200/30 bg-emerald-500/10" : "border-emerald-100 bg-emerald-50/70"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.3em]",
                    dark ? "text-emerald-200" : "text-emerald-500"
                  )}
                >
                  Remaining
                </p>
                <p className={cn("text-xl font-semibold", dark ? "text-emerald-200" : "text-emerald-900")}>
                  {formatCurrency(summary.remaining, summary.currency)}
                </p>
                <p className={cn("text-xs", dark ? "text-emerald-100" : "text-emerald-700")}>
                  Of {formatCurrency(summary.allowance, summary.currency)} planned
                </p>
              </div>
              <div
                className={cn(
                  "rounded-2xl border p-4",
                  dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50/80"
                )}
              >
                <p className={cn("text-xs font-semibold uppercase tracking-[0.3em]", mutedText)}>
                  Streak
                </p>
                <p className={cn("text-xl font-semibold", dark ? "text-white" : "text-slate-900")}>
                  {streakDisplay}
                </p>
                <p className={cn("text-xs", mutedText)}>{streakMessage}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Connect a budget to see spending pace, remaining runway, and streaks right from Flow.
            </p>
            <Button
              variant="outline"
              className="w-full border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={onOpenBudget}
            >
              Start a budget
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GroupSummaryCard({
  loading,
  error,
  summaries,
  primary,
  onAddExpense,
  dark = false,
}: {
  loading: boolean;
  error: string | null;
  summaries: CurrencySummary[];
  primary: CurrencySummary | null;
  onAddExpense: () => void;
  dark?: boolean;
}) {
  const baseCard = dark
    ? "border-white/15 bg-slate-900/60 text-white"
    : "border-emerald-200 bg-white/95 text-slate-900";
  const owedLabel = dark ? "text-emerald-200" : "text-emerald-500";
  const owedValue = dark ? "text-emerald-300" : "text-emerald-700";
  const oweLabel = dark ? "text-slate-300" : "text-slate-500";
  const mutedText = dark ? "text-slate-300" : "text-slate-500";
  const cardSurface = dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50";

  return (
    <Card className={cn("rounded-[28px] p-6 shadow-sm", baseCard)}>
      <CardHeader className="flex flex-col gap-3 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={cn("text-xs font-semibold uppercase tracking-[0.35em]", owedLabel)}>Groups</p>
            <CardTitle className={cn("text-xl", dark ? "text-white" : "text-slate-900")}>Money pulse</CardTitle>
          </div>
          <Button
            variant="outline"
            className={cn(
              "text-sm font-semibold",
              dark
                ? "bg-emerald-500/90 text-slate-900 hover:bg-emerald-400 border-transparent"
                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            )}
            onClick={onAddExpense}
          >
            + Add expense
          </Button>
        </div>
      </CardHeader>
      <CardContent className="mt-4 space-y-4">
        {loading ? (
          <SkeletonBanner label="Crunching group balances" />
        ) : error ? (
          <p className="text-sm text-rose-500">{error}</p>
        ) : primary ? (
          <>
            <div
              className={cn(
                "rounded-2xl border p-4",
                dark ? "border-emerald-200/30 bg-emerald-500/10" : "border-emerald-100 bg-emerald-50/60"
              )}
            >
              <p className={cn("text-xs font-semibold uppercase tracking-[0.3em]", owedLabel)}>You’re owed</p>
              <p className={cn("text-2xl font-semibold", owedValue)}>
                {formatCurrency(primary.owed, primary.currency)}
              </p>
              <p className={cn("text-xs", dark ? "text-emerald-100" : "text-emerald-700")}>
                From {primary.owedGroups.length || 1} group{primary.owedGroups.length > 1 ? "s" : ""}
              </p>
            </div>
            <div className={cn("rounded-2xl border p-4", cardSurface)}>
              <p className={cn("text-xs font-semibold uppercase tracking-[0.3em]", oweLabel)}>You owe</p>
              <p className={cn("text-2xl font-semibold", dark ? "text-white" : "text-slate-700")}>
                {primary.owe ? formatCurrency(primary.owe, primary.currency) : "—"}
              </p>
              <p className={cn("text-xs", mutedText)}>
                {primary.owe ? `To ${primary.oweGroups.length || 1} friend${primary.oweGroups.length > 1 ? "s" : ""}` : "All square for now."}
              </p>
            </div>
            {summaries.length > 1 ? (
              <div>
                <p className={cn("text-xs font-semibold uppercase tracking-[0.35em]", mutedText)}>
                  Other currencies
                </p>
                <div className={cn("mt-2 space-y-2 text-sm", dark ? "text-slate-200" : "text-slate-600")}>
                  {summaries.slice(1).map((summary) => (
                    <div
                      key={summary.currency}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border px-3 py-2",
                        dark ? "border-white/10 bg-white/5" : "border-slate-100 bg-white"
                      )}
                    >
                      <span>{summary.currency}</span>
                      <span>{formatCurrency(summary.owed - summary.owe, summary.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className={cn("text-sm", mutedText)}>Create a split group to see balances roll in.</p>
        )}
      </CardContent>
    </Card>
  );
}

function buildBudgetPulseSummary(
  budget: BudgetDocument,
  month: BudgetMonth,
  monthKey: string
): BudgetPulseSummary {
  const totalIncome =
    month.incomes?.reduce((sum, income) => sum + (Number(income.amount) || 0), 0) ?? 0;
  const totalFixed =
    month.fixeds?.reduce(
      (sum, fixed) =>
        sum + (fixed.enabled === false ? 0 : Number(fixed.amount) || 0),
      0
    ) ?? 0;
  const savingsTarget = Number(month.savingsTarget) || 0;
  const allowance = Math.max(0, totalIncome - totalFixed - savingsTarget);
  const spent =
    month.entries?.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0) ?? 0;
  const remaining = Math.max(0, allowance - spent);
  const { streak, onPace } = calculateBudgetStreak(month.entries ?? [], allowance, monthKey);

  return {
    title: budget.title || "Household budget",
    monthLabel: formatBudgetMonthLabel(monthKey),
    allowance,
    spent,
    remaining,
    streak,
    onPace,
    currency: "USD",
    id: budget.id,
  };
}

function calculateBudgetStreak(
  entries: BudgetLedgerEntry[],
  allowance: number,
  monthKey: string
): { streak: number; onPace: boolean | null } {
  const details = parseBudgetMonthKey(monthKey);
  if (!details) {
    return { streak: 0, onPace: null };
  }
  const { year, monthIndex, daysInMonth } = details;
  const totals = new Array(daysInMonth).fill(0);
  entries.forEach((entry) => {
    const date = safeEntryDate(entry.date);
    if (
      date &&
      date.getFullYear() === year &&
      date.getMonth() === monthIndex
    ) {
      const day = date.getDate();
      totals[day - 1] += Number(entry.amount) || 0;
    }
  });

  const today = new Date();
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex, daysInMonth, 23, 59, 59, 999);
  let evaluationEndDay = daysInMonth;
  if (today < monthStart) {
    evaluationEndDay = 0;
  } else if (today <= monthEnd) {
    evaluationEndDay = today.getDate();
  }

  if (evaluationEndDay <= 0) {
    return { streak: 0, onPace: null };
  }

  let cumulative = 0;
  let runningStreak = 0;
  let currentStreak = 0;
  let onPaceToday: boolean | null = null;
  const epsilon = 0.01;

  for (let day = 1; day <= daysInMonth; day++) {
    cumulative += totals[day - 1];
    const allowed = allowance <= 0 ? 0 : (allowance * day) / daysInMonth;
    const onPace =
      allowance <= 0 ? cumulative <= epsilon : cumulative <= allowed + epsilon;
    if (day <= evaluationEndDay) {
      if (onPace) {
        runningStreak += 1;
      } else {
        runningStreak = 0;
      }
      if (day === evaluationEndDay) {
        currentStreak = runningStreak;
        onPaceToday = onPace;
      }
    }
  }

  return { streak: currentStreak, onPace: onPaceToday };
}

function parseBudgetMonthKey(monthKey: string) {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  const monthIndex = month - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  return { year, monthIndex, daysInMonth };
}

function safeEntryDate(value?: string | null) {
  if (!value) {
    return null;
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
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatBudgetMonthLabel(monthKey: string) {
  const details = parseBudgetMonthKey(monthKey);
  if (!details) {
    return monthKey;
  }
  const date = new Date(details.year, details.monthIndex, 1);
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function Highlight({ label, value, dark }: { label: string; value: ReactNode; dark?: boolean }) {
  return (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.35em]", dark ? "text-slate-400" : "text-slate-500")}>{label}</p>
      <div className={cn("text-sm", dark ? "text-slate-200" : "text-slate-700")}>{value}</div>
    </div>
  );
}

function SkeletonBanner({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
      {label}
    </div>
  );
}

function getTaskTime(task: FlowTask) {
  const source = task.scheduledStart || task.actualStart || task.createdAt;
  if (!source) {
    return Number.POSITIVE_INFINITY;
  }
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

function formatTaskTimeRange(task: FlowTask) {
  const start = formatTime(task.scheduledStart || task.actualStart);
  const end = formatTime(task.scheduledEnd || task.actualEnd);
  if (start && end) {
    return `${start} – ${end}`;
  }
  return start || "--:--";
}

function formatTime(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getEveningWins(tasks: FlowTask[], completed: number) {
  if (!tasks.length && !completed) {
    return "Nothing planned today.";
  }
  const pending = tasks.filter((task) => task.status !== "done");
  if (!pending.length) {
    return "Everything checked off. Celebrate with a quiet moment.";
  }
  return `${completed} done · ${pending.length} still open`;
}

function buildTimeline(plan: FlowPlan | null) {
  if (!plan?.tasks?.length) {
    return [];
  }
  return plan.tasks
    .map((task) => ({
      label: formatTime(task.scheduledStart) || new Date(task.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      detail: task.title,
      stamp: getTaskTime(task),
    }))
    .sort((a, b) => b.stamp - a.stamp)
    .slice(0, MAX_TIMELINE_ITEMS)
    .map(({ label, detail }) => ({ label, detail }));
}

function buildSplitSummary(
  entries: Array<{ group: Group; expenses: Expense[]; settlements: Settlement[] }>,
  user: User
): CurrencySummary[] {
  if (!entries.length) {
    return [];
  }
  const summaryMap = new Map<CurrencyCode, CurrencySummary>();
  entries.forEach(({ group, expenses, settlements }) => {
    if (!group.members?.length) {
      return;
    }
    const memberId = findMemberId(group.members, user);
    if (!memberId) {
      return;
    }
    const currency = group.currency ?? ("USD" as CurrencyCode);
    const openBalances = calculateOpenBalancesMinor(
      group.members,
      expenses ?? [],
      settlements ?? [],
      currency
    );
    const planForMember = getSettlementPlanMinor(group.members, openBalances)[memberId];
    const owedMinor = planForMember?.receives.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
    const oweMinor = planForMember?.owes.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
    const owed = fromMinor(owedMinor, currency);
    const owe = fromMinor(oweMinor, currency);
    if (!summaryMap.has(currency)) {
      summaryMap.set(currency, {
        currency,
        owed: 0,
        owe: 0,
        owedGroups: [],
        oweGroups: [],
      });
    }
    const bucket = summaryMap.get(currency)!;
    if (owed > 0) {
      bucket.owed += owed;
      bucket.owedGroups.push(group.name);
    }
    if (owe > 0) {
      bucket.owe += owe;
      bucket.oweGroups.push(group.name);
    }
  });
  return Array.from(summaryMap.values()).sort((a, b) => b.owed - a.owed || a.owe - b.owe);
}

function findMemberId(members: Member[], user: User) {
  return (
    members.find((member) => member.id === user.uid || (user.email && member.email === user.email))?.id ?? null
  );
}

function formatCurrency(value: number, currency: CurrencyCode) {
  const fractionDigits = FRACTION_DIGITS[currency] ?? 2;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

type WeeklySummary = {
  totals: { completed: number; tasks: number };
  categories: Record<
    FlowCategory,
    {
      completed: number;
      tasks: number;
    }
  >;
};

function buildWeeklyDigest(plans: FlowPlan[]): WeeklySummary {
  const summary: WeeklySummary = {
    totals: { completed: 0, tasks: 0 },
    categories: {
      work: { completed: 0, tasks: 0 },
      family: { completed: 0, tasks: 0 },
      home: { completed: 0, tasks: 0 },
      wellness: { completed: 0, tasks: 0 },
      play: { completed: 0, tasks: 0 },
      growth: { completed: 0, tasks: 0 },
    },
  };

  plans.forEach((plan) => {
    plan.tasks.forEach((task) => {
      summary.totals.tasks += 1;
      summary.categories[task.category].tasks += 1;
      if (task.status === "done") {
        summary.totals.completed += 1;
        summary.categories[task.category].completed += 1;
      }
    });
  });

  return summary;
}

function WeeklyDigestCard({
  summary,
  loading,
  error,
  moments,
}: {
  summary: WeeklySummary | null;
  loading: boolean;
  error: string | null;
  moments: { label: string; detail: string }[];
}) {
  return (
    <Card className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
      <CardHeader className="p-0">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Weekly digest</p>
        <CardTitle className="text-xl text-slate-900">Sunday glance</CardTitle>
      </CardHeader>
      <CardContent className="mt-4 space-y-4">
        {loading ? (
          <SkeletonBanner label="Crunching weekly stats" />
        ) : error ? (
          <p className="text-sm text-rose-500">{error}</p>
        ) : summary ? (
          <>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs text-slate-500">Tasks completed</p>
              <p className="text-xl font-semibold text-slate-900">
                {summary.totals.completed}/{summary.totals.tasks}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(summary.categories)
                .filter(([, value]) => value.tasks > 0)
                .sort((a, b) => b[1].completed - a[1].completed)
                .slice(0, 4)
                .map(([category, value]) => (
                  <div key={category} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <p className="text-xs text-slate-500">{FLOW_CATEGORY_LABELS[category as FlowCategory]}</p>
                    <p className="text-xl font-semibold text-slate-900">
                      {value.completed}/{value.tasks}
                    </p>
                  </div>
                ))}
            </div>
            <Separator />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Moments</p>
              <div className="mt-3 space-y-2">
                {moments.length ? (
                  moments.map((moment) => (
                    <div key={moment.label} className="rounded-2xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-600">
                      <span className="mr-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                        {moment.label}
                      </span>
                      {moment.detail}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Add tasks in Flow to build your timeline.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Add tasks in Flow this week to see stats here.</p>
        )}
      </CardContent>
    </Card>
  );
}



const formatRelativeDayDistance = (timestamp?: string | null) => {
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) {
    return "today";
  }
  if (diffDays === 1) {
    return "yesterday";
  }
  return `${diffDays} days ago`;
};

function ReflectionStreakCard({
  streak,
  lastReflectionAt,
  loading,
  dark,
  onViewHistory,
  photoUrl,
  photoNote,
}: {
  streak: number;
  lastReflectionAt: string | null;
  loading: boolean;
  dark: boolean;
  onViewHistory: () => void;
  photoUrl: string | null;
  photoNote: string | null;
}) {
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const tone = dark ? "text-indigo-200" : "text-slate-600";
  const accent = dark ? "text-white" : "text-slate-900";
  const badgeTone = dark
    ? "bg-white/10 text-indigo-100"
    : "bg-indigo-100 text-indigo-700";
  const streakLabel =
    streak > 1 ? `${streak}-day run` : streak === 1 ? "1 day logged" : "No streak yet";
  const relative = formatRelativeDayDistance(lastReflectionAt);
  const lastEntryText = relative
    ? `Last entry ${relative}.`
    : "Log a reflection to start your streak.";

  return (
    <Card
      className={cn(
        "rounded-[28px] p-6 shadow-sm",
        dark ? "border-white/15 bg-slate-900/60 text-white" : "border border-slate-200 bg-white/95 text-slate-900"
      )}
    >
      <CardHeader className="p-0">
        <p className={cn("text-xs font-semibold uppercase tracking-[0.35em]", tone)}>
          Reflection streak
        </p>
        <CardTitle className={cn("text-xl", accent)}>Keep the loop alive</CardTitle>
      </CardHeader>
      <CardContent className="mt-4 space-y-4">
        {loading ? (
          <div className={cn("flex items-center gap-3 text-sm", tone)}>
            <Spinner size="sm" className="text-current" />
            Checking your Flow streak...
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-baseline gap-2">
                <p className={cn("text-4xl font-bold", accent)}>{streak}</p>
                <span className={cn("text-xs font-semibold uppercase tracking-[0.3em]", tone)}>
                  day streak
                </span>
              </div>
              <p className={cn("mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", badgeTone)}>
                {streakLabel}
              </p>
            </div>
            <p className={cn("text-sm", tone)}>{lastEntryText}</p>
            {photoUrl ? (
              <>
                <button
                  type="button"
                  onClick={() => setPhotoPreviewOpen(true)}
                  className={cn(
                    "w-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-2xl",
                    dark ? "focus-visible:ring-white focus-visible:ring-offset-slate-900" : "focus-visible:ring-indigo-500 focus-visible:ring-offset-white"
                  )}
                >
                  <div
                    className={cn(
                      "overflow-hidden rounded-2xl border",
                      dark ? "border-white/10 bg-black/40" : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div className="relative flex h-40 w-full items-center justify-center">
                      <Image
                        src={photoUrl}
                        alt="Latest reflection photo"
                        fill
                        sizes="(max-width: 768px) 100vw, 320px"
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  </div>
                  <p className={cn("mt-2 text-xs", tone)}>
                    Tap to see the full photo.
                  </p>
                </button>
                <Dialog open={photoPreviewOpen} onOpenChange={setPhotoPreviewOpen}>
                  <DialogContent className="max-w-3xl border-none bg-slate-900/80 p-4 text-white shadow-2xl">
                    <DialogHeader className="sr-only">
                      <DialogTitle>Reflection photo preview</DialogTitle>
                    </DialogHeader>
                    <div className="relative h-[70vh] w-full">
                      <Image
                        src={photoUrl}
                        alt="Full reflection photo"
                        fill
                        sizes="(max-width: 1200px) 90vw, 800px"
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                    {photoNote ? (
                      <p className="mt-4 text-sm text-white/90">{photoNote}</p>
                    ) : null}
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <p className={cn("text-sm italic", tone)}>
                Add a photo to your next reflection to light up this space.
              </p>
            )}
            <div className="space-y-2">
              <Button
                className={cn(
                  "w-full text-white",
                  dark ? "bg-indigo-500 hover:bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-500"
                )}
                onClick={onViewHistory}
              >
                View History
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DailyWorkSummaryCard({
  summary,
  loading,
  isNight,
}: {
  summary: DailySummaryPayload | null;
  loading: boolean;
  isNight: boolean;
}) {
  const tone = isNight ? "text-indigo-200" : "text-indigo-600";
  return (
    <Card
      className={cn(
        "rounded-[28px] p-6 shadow-sm",
        isNight
          ? "border-white/20 bg-gradient-to-br from-indigo-900/60 via-violet-900/40 to-purple-900/60 text-white"
          : "border-indigo-200 bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 text-slate-900"
      )}
    >
      <CardHeader className="p-0">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className={cn("h-5 w-5", isNight ? "text-indigo-300" : "text-indigo-500")} />
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.35em]",
              isNight ? "text-indigo-200" : "text-indigo-500"
            )}
          >
            Daily work story
          </p>
        </div>
        <CardTitle className={cn("text-xl", isNight ? "text-white" : "text-slate-900")}>
          Your morning read
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-4 space-y-5">
        {loading ? (
          <div className={cn("flex items-center gap-3 text-sm", tone)}>
            <Spinner size="sm" className="text-current" />
            {"Gathering yesterday's wins..."}
          </div>
        ) : summary ? (
          <>
            <div className="space-y-3">
              {summary.overview.map((paragraph, index) => (
                <p
                  key={index}
                  className={cn("text-sm leading-relaxed", isNight ? "text-indigo-100" : "text-slate-700")}
                >
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <WorkTaskListSection
                label="Work wins"
                tasks={summary.completedWork}
                emptyText="Flow didn't capture any work wins yesterday."
                isNight={isNight}
              />
              <WorkTaskListSection
                label="Carryovers"
                tasks={summary.pendingWork}
                emptyText="No work carryovers - plan a fresh priority."
                isNight={isNight}
              />
            </div>
          </>
        ) : (
          <p className={cn("text-sm", tone)}>No summary just yet. Check back tomorrow morning.</p>
        )}
      </CardContent>
    </Card>
  );
}

function DailyRecommendationCard({
  summary,
  loading,
  isNight,
  onAddAnchor,
  anchorStatusLookup,
  canAddAnchors = false,
}: {
  summary: DailySummaryPayload | null;
  loading: boolean;
  isNight: boolean;
  onAddAnchor?: (task: WorkTaskHighlight) => void;
  anchorStatusLookup?: (task: WorkTaskHighlight) => "adding" | "added" | null;
  canAddAnchors?: boolean;
}) {
  const tone = isNight ? "text-indigo-200" : "text-indigo-600";
  const accent = isNight ? "text-white" : "text-slate-900";
  return (
    <Card
      className={cn(
        "rounded-[28px] p-6 shadow-sm",
        isNight ? "border-white/15 bg-slate-900/70 text-white" : "border-slate-200 bg-white/95 text-slate-900"
      )}
    >
      <CardHeader className="p-0">
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.35em]",
            isNight ? "text-indigo-200" : "text-indigo-500"
          )}
        >
          Daily recommendation
        </p>
        <CardTitle className={cn("text-xl", accent)}>
          {"Line up today's moves"}
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-4 space-y-4">
        {loading ? (
          <div className={cn("flex items-center gap-3 text-sm", tone)}>
            <Spinner size="sm" className="text-current" />
            {"Drafting today's plan..."}
          </div>
        ) : summary ? (
          <>
            <ul className="space-y-3 text-sm">
              {summary.recommendations.map((recommendation, index) => (
                <li key={index} className="flex gap-3">
                  <span
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isNight ? "bg-white/10 text-indigo-100" : "bg-indigo-100 text-indigo-700"
                    )}
                  >
                    {index + 1}
                  </span>
                  <p className={cn("leading-relaxed", isNight ? "text-indigo-100" : "text-slate-700")}>
                    {recommendation}
                  </p>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl border border-dashed border-slate-300/60 p-3">
              <WorkTaskListSection
                label="Anchor these next"
                tasks={summary.pendingWork}
                emptyText="No carryovers queued up - add one thing you want to complete."
                isNight={isNight}
                actionRenderer={
                  onAddAnchor
                    ? (task) => {
                      const status = anchorStatusLookup?.(task);
                      const isAdded = status === "added";
                      const isAdding = status === "adding";
                      const disabled = !canAddAnchors || isAdded || isAdding;
                      return (
                        <Button
                          size="sm"
                          variant={isNight ? "ghost" : "outline"}
                          disabled={disabled}
                          onClick={() => onAddAnchor(task)}
                          className={cn(
                            "text-xs font-semibold transition-all",
                            isNight
                              ? "bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 hover:text-white border border-indigo-500/20"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:text-slate-700",
                            disabled && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {isAdding ? "Adding..." : isAdded ? "Task added" : canAddAnchors ? "Add to Flow" : "Sign in to add"}
                        </Button>
                      );
                    }
                    : undefined
                }
              />
              {!canAddAnchors ? (
                <p className={cn("mt-2 text-xs", tone)}>Sign in to push these tasks into Flow.</p>
              ) : null}
            </div>
          </>
        ) : (
          <p className={cn("text-sm", tone)}>Add work tasks in Flow to get tailored recommendations.</p>
        )}
      </CardContent>
    </Card>
  );
}

function InsightCarousel({
  insights,
  loading,
  isNight,
  votes,
  messages,
  savingInsightId,
  onVote,
  onSave,
  canInteract,
}: {
  insights: OrbitInsightCard[];
  loading: boolean;
  isNight: boolean;
  votes: Record<string, InsightVoteDirection>;
  messages: Record<string, string>;
  savingInsightId: string | null;
  onVote: (insight: OrbitInsightCard, direction: InsightVoteDirection) => void;
  onSave: (insight: OrbitInsightCard) => void;
  canInteract: boolean;
}) {
  const tone = isNight ? "text-indigo-200" : "text-slate-600";
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [insights.length]);

  const totalInsights = insights.length;
  const currentInsight =
    totalInsights > 0 ? insights[activeIndex % totalInsights] : null;

  const handlePrevious = () => {
    if (totalInsights < 2) {
      return;
    }
    setActiveIndex((prev) => (prev - 1 + totalInsights) % totalInsights);
  };

  const handleNext = () => {
    if (totalInsights < 2) {
      return;
    }
    setActiveIndex((prev) => (prev + 1) % totalInsights);
  };

  return (
    <Card
      className={cn(
        "rounded-[28px] p-6 shadow-sm",
        isNight ? "border-white/15 bg-slate-900/70 text-white" : "border-slate-200 bg-white/95 text-slate-900"
      )}
    >
      <CardHeader className="p-0">
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.35em]",
            isNight ? "text-indigo-200" : "text-indigo-500"
          )}
        >
          New sparks
        </p>
        <CardTitle className={cn("text-xl", isNight ? "text-white" : "text-slate-900")}>
          {"Swipe through today's ideas"}
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-4">
        {loading ? (
          <div className={cn("flex items-center gap-3 text-sm", tone)}>
            <Spinner size="sm" className="text-current" />
            Researching new developments...
          </div>
        ) : currentInsight ? (
          <div className="space-y-4">
            {totalInsights > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <p className={cn(tone, "font-medium")}>Swipe left or use the arrows to see the next card.</p>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant={isNight ? "secondary" : "outline"}
                    className="h-8 w-8 rounded-full"
                    onClick={handlePrevious}
                    aria-label="Previous insight"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className={cn("text-xs font-semibold", tone)}>
                    {activeIndex + 1} / {totalInsights}
                  </span>
                  <Button
                    size="icon"
                    variant={isNight ? "secondary" : "outline"}
                    className="h-8 w-8 rounded-full"
                    onClick={handleNext}
                    aria-label="Next insight"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className={cn("text-xs font-medium", tone)}>Swipe left to revisit this spark anytime today.</p>
            )}
            <article
              key={currentInsight.id}
              className={cn(
                "rounded-2xl border p-5",
                isNight ? "border-white/10 bg-slate-900/80" : "border-slate-200 bg-slate-50"
              )}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">
                <span>{currentInsight.type}</span>
                <span className="text-indigo-200/60">•</span>
                <span>{currentInsight.topic}</span>
              </div>
              <h3 className={cn("mt-2 text-lg font-semibold", isNight ? "text-white" : "text-slate-900")}>
                {currentInsight.title}
              </h3>
              <p className={cn("mt-1 text-sm font-medium", tone)}>{currentInsight.summary}</p>
              <div className="mt-3 space-y-3 text-sm leading-relaxed">
                {currentInsight.paragraphs.map((paragraph, index) => (
                  <p key={index} className={isNight ? "text-indigo-100" : "text-slate-700"}>
                    {paragraph}
                  </p>
                ))}
              </div>
              {currentInsight.referenceUrl ? (
                <button
                  className={cn(
                    "mt-3 inline-flex items-center gap-1 text-xs font-semibold",
                    isNight ? "text-indigo-200" : "text-indigo-600"
                  )}
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.open(currentInsight.referenceUrl ?? "", "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  Read source
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canInteract}
                  className={cn(
                    "gap-1 rounded-full border px-3",
                    isNight
                      ? "border-white/15 text-indigo-100 hover:bg-white/10"
                      : "border-indigo-100 text-indigo-700 hover:bg-indigo-50",
                    votes[currentInsight.id] === "more" && (isNight ? "bg-white/10" : "bg-indigo-50")
                  )}
                  onClick={() => onVote(currentInsight, "more")}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  More like this
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canInteract}
                  className={cn(
                    "gap-1 rounded-full border px-3",
                    isNight
                      ? "border-white/15 text-indigo-100 hover:bg-white/10"
                      : "border-indigo-100 text-indigo-700 hover:bg-indigo-50",
                    votes[currentInsight.id] === "less" && (isNight ? "bg-white/10" : "bg-indigo-50")
                  )}
                  onClick={() => onVote(currentInsight, "less")}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Less of this
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canInteract || savingInsightId === currentInsight.id}
                  className={cn(
                    "gap-1 rounded-full border px-3",
                    isNight ? "border-white/20 text-white hover:bg-white/10" : "border-slate-200 text-slate-800"
                  )}
                  onClick={() => onSave(currentInsight)}
                >
                  {savingInsightId === currentInsight.id ? (
                    <Spinner size="sm" className="text-current" />
                  ) : (
                    <BookmarkPlus className="h-3.5 w-3.5" />
                  )}
                  Save to Orbit
                </Button>
              </div>
              {messages[currentInsight.id] ? (
                <p className={cn("mt-2 text-xs", tone)}>{messages[currentInsight.id]}</p>
              ) : null}
              {!canInteract ? (
                <p className={cn("mt-2 text-xs italic", tone)}>Sign in to vote or save.</p>
              ) : null}
            </article>
          </div>
        ) : (
          <p className={cn("text-sm", tone)}>
            {"We'll surface new stories once Orbit learns your interests."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}



function WorkTaskListSection({
  label,
  tasks,
  emptyText,
  isNight,
  actionRenderer,
}: {
  label: string;
  tasks: DailySummaryPayload["completedWork"];
  emptyText: string;
  isNight: boolean;
  actionRenderer?: (task: DailySummaryPayload["completedWork"][number], index: number) => ReactNode;
}) {
  const tone = isNight ? "text-indigo-200" : "text-slate-600";
  return (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.35em]", tone)}>{label}</p>
      {tasks.length ? (
        <ul className="mt-2 space-y-2 text-sm">
          {tasks.slice(0, 3).map((task, index) => (
            <li key={`${task.title}-${index}`} className="flex gap-3">
              <span
                className={cn(
                  "mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full",
                  isNight ? "bg-indigo-200" : "bg-indigo-500"
                )}
              />
              <div>
                <p className={cn("font-medium", isNight ? "text-white" : "text-slate-900")}>{task.title}</p>
                <p className={cn("text-xs", tone)}>
                  {task.note?.trim() ? task.note : task.status.replace(/_/g, " ")}
                </p>
                {actionRenderer ? <div className="mt-2">{actionRenderer(task, index)}</div> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn("mt-2 text-sm italic", tone)}>{emptyText}</p>
      )}
    </div>
  );
}
