"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Sparkles } from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { AppUserMenu } from "@/components/AppUserMenu";
import { auth } from "@/lib/firebase";
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
import type { Group, Member, Expense } from "@/types/group";
import type { Settlement } from "@/types/settlement";
import type { BudgetDocument, BudgetMonth, BudgetLedgerEntry } from "@/types/budget";
import { type CurrencyCode, fromMinor, FRACTION_DIGITS } from "@/lib/currency_core";

const THEMES = {
  morning: {
    id: "morning",
    label: "Morning",
    gradient: "from-amber-50 via-white to-emerald-50",
    hero: "bg-gradient-to-br from-amber-100/40 via-white to-emerald-100/30",
  },
  night: {
    id: "night",
    label: "Night",
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
};

const MAX_TIMELINE_ITEMS = 4;
const FLOW_CATEGORY_LABELS: Record<FlowCategory, string> = {
  work: "Work",
  family: "Family",
  home: "Home & chores",
  wellness: "Wellness",
  play: "Play",
  growth: "Growth",
};

const aiHighlights = [
  {
    id: "ai-1",
    title: "Grow the side hustle",
    summary:
      "3/5 saves mention passive income ideas. Start with the Indie Hackers interview and the Stripe Atlas guide.",
    tags: ["indiehacker", "marketing"],
  },
  {
    id: "ai-2",
    title: "Curiosity spiral",
    summary: "Saved two deep-dives on geothermal energy. Build a reading session for Sunday afternoon.",
    tags: ["energy", "climate"],
  },
];

export default function DailyDashboardPage() {
  const hour = new Date().getHours();
  const isMorning = hour < 17;
  const isSunday = new Date().getDay() === 0;

  const [theme, setTheme] = useState<"morning" | "night">(
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

  const [splitTotals, setSplitTotals] = useState<CurrencySummary[]>([]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [budgetPulse, setBudgetPulse] = useState<BudgetPulseSummary | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

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
        const summary = buildBudgetPulseSummary(primary, month, monthKey);
        setBudgetPulse(summary);
      } catch (error) {
        console.error("Failed to load budget pulse", error);
        if (!cancelled) {
          setBudgetError("We couldn't load your budget.");
          setBudgetPulse(null);
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
  const reflections = flowPlan?.reflections ?? [];
  const latestReflection = reflections[0] ?? null;

  const primarySummary = splitTotals[0] ?? null;

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
  const userDisplayName = user?.displayName ?? user?.email ?? "You";

  return (
    <div className={cn("min-h-screen w-full bg-gradient-to-b px-4 py-10", palette.gradient)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header
          className={cn(
            "rounded-[32px] border border-white/40 p-6 shadow-lg backdrop-blur",
            palette.hero,
            theme === "night" ? "text-white" : "text-slate-900"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.4em] text-current/70">
                Ritual dashboard
              </span>
              <div className="flex gap-2 rounded-full border border-white/40 bg-white/20 p-1 text-xs font-semibold text-white">
                {Object.values(THEMES).map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    className={cn(
                      "rounded-full px-3 py-1",
                      theme === option.id ? "bg-white/80 text-slate-900" : "text-white/80"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {user ? (
              <AppUserMenu
                product="dashboard"
                displayName={userDisplayName}
                avatarSrc={user.photoURL}
              />
            ) : null}
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

        {flowLoading ? (
          <SkeletonBanner label="Loading Flow insights" />
        ) : flowPlan ? (
          <FlowCards
            isMorning={isMorning}
            upcomingTasks={upcomingTasks}
            completedTasks={completedTasks}
            totalTasks={flowPlan.tasks?.length ?? 0}
            latestReflection={latestReflection}
            onAddJournal={() => router.push("/journal")}
            onReflect={() => router.push("/flow")}
          />
        ) : (
          <SkeletonBanner label={flowError ?? "Sign in to see Flow insights"} />
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <GroupSummaryCard
            loading={splitLoading}
            error={splitError}
            summaries={splitTotals}
            primary={primarySummary}
            onAddExpense={() => router.push("/split")}
          />

          <BudgetPulseCard
            loading={budgetLoading}
            error={budgetError}
            summary={budgetPulse}
            onOpenBudget={() => router.push("/budget")}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-[28px] border border-indigo-200 bg-indigo-50/70 p-6 shadow-sm">
            <CardHeader className="p-0">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500">Mood + photo</p>
              <CardTitle className="text-xl text-indigo-900">Drop a feeling and a photo</CardTitle>
            </CardHeader>
            <CardContent className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500">Mood</label>
                  <select
                    value={reflectionMood}
                    onChange={(event) => setReflectionMood(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none"
                  >
                    {FLOW_MOOD_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.emoji} {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500">
                    Photo
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="mt-2 cursor-pointer border-indigo-200 text-sm"
                    onChange={handlePhotoChange}
                  />
                  <p className="mt-1 text-xs text-indigo-500">
                    {reflectionPhotoName
                      ? `Attached: ${reflectionPhotoName}`
                      : "Optional — shows up in Flow reflections."}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500">Reflection</label>
                <Textarea
                  className="mt-2 min-h-[100px] border-indigo-200"
                  placeholder="What moment stands out?"
                  value={reflectionNote}
                  onChange={(event) => setReflectionNote(event.target.value)}
                />
              </div>
              {reflectionStatus ? (
                <p className="text-sm text-indigo-700">{reflectionStatus}</p>
              ) : null}
              <Button
                className="bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={handleReflectionSubmit}
                disabled={reflectionBusy}
              >
                {reflectionBusy ? <Spinner size="sm" className="text-white" /> : "Sync to Flow"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border border-indigo-200 bg-white/95 p-6 shadow-sm">
            <CardHeader className="p-0">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500">Saved links</p>
              <CardTitle className="text-xl text-slate-900">AI recaps</CardTitle>
            </CardHeader>
            <CardContent className="mt-4 space-y-4">
              <Button
                variant="outline"
                className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                onClick={() => router.push("/scratch-pad")}
              >
                Add a note or save a link
              </Button>
              {aiHighlights.map((item) => (
                <div key={item.id} className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <p className="text-sm font-semibold text-indigo-700">{item.title}</p>
                  <p className="mt-1 text-sm text-indigo-600">{item.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/60 bg-white/80 px-3 py-0.5 text-xs font-medium text-indigo-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {isSunday ? (
          <WeeklyDigestCard
            summary={weeklySummary}
            loading={weeklyLoading}
            error={weeklyError}
            moments={timelineMoments}
          />
        ) : null}
      </div>
    </div>
  );
}

function FlowCards({
  isMorning,
  upcomingTasks,
  completedTasks,
  totalTasks,
  latestReflection,
  onAddJournal,
  onReflect,
}: {
  isMorning: boolean;
  upcomingTasks: FlowTask[];
  completedTasks: number;
  totalTasks: number;
  latestReflection: FlowReflection | null;
  onAddJournal: () => void;
  onReflect: () => void;
}) {
  const openToodlMind = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-toodl-mind"));
    }
  };

  if (isMorning) {
    return (
      <Card className="rounded-[28px] border-none bg-white/90 p-6 shadow-lg">
        <CardHeader className="p-0">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-500">Morning calm</p>
          <CardTitle className="text-2xl text-slate-900">Good morning.</CardTitle>
          <p className="text-sm text-slate-500">
            {upcomingTasks.length ? "Here’s how Flow lined up your next anchors." : "Add a task in Flow to start the day."}
          </p>
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
            value={totalTasks ? `${completedTasks}/${totalTasks} done · ${totalTasks - completedTasks} to go` : "No schedule for today."}
          />
          <Highlight
            label="Next anchor"
            value={
              upcomingTasks[0]
                ? `${upcomingTasks[0].title} · ${formatTaskTimeRange(upcomingTasks[0])}`
                : "Add a top priority to Flow"
            }
          />
          <Highlight
            label="Mind note"
            value={latestReflection?.note ?? "Drop a quick reflection to keep the loop alive."}
          />
        </CardContent>
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
    <Card className="rounded-[28px] border-none bg-slate-900 text-white">
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
}: {
  loading: boolean;
  error: string | null;
  summary: BudgetPulseSummary | null;
  onOpenBudget: () => void;
}) {
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
    <Card className="rounded-[28px] border border-violet-200 bg-white/95 p-6 shadow-sm">
      <CardHeader className="p-0">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-500">Budget</p>
        <CardTitle className="text-xl text-slate-900">This month’s budget</CardTitle>
      </CardHeader>
      <CardContent className="mt-4 space-y-4">
        {loading ? (
          <SkeletonBanner label="Crunching budget pulse" />
        ) : error ? (
          <p className="text-sm text-rose-500">{error}</p>
        ) : summary ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {summary.title}
            </p>
            <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-500">
                {summary.monthLabel}
              </p>
              <p className="text-2xl font-semibold text-violet-900">
                {formatCurrency(summary.spent, summary.currency)}
              </p>
              <p className="text-xs text-violet-700">Spent so far</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                  Remaining
                </p>
                <p className="text-xl font-semibold text-emerald-900">
                  {formatCurrency(summary.remaining, summary.currency)}
                </p>
                <p className="text-xs text-emerald-700">
                  Of {formatCurrency(summary.allowance, summary.currency)} planned
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Streak
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {streakDisplay}
                </p>
                <p className="text-xs text-slate-500">{streakMessage}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={onOpenBudget}
            >
              Open budget
            </Button>
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
}: {
  loading: boolean;
  error: string | null;
  summaries: CurrencySummary[];
  primary: CurrencySummary | null;
  onAddExpense: () => void;
}) {
  return (
    <Card className="rounded-[28px] border border-emerald-200 bg-white/95 p-6 shadow-sm">
      <CardHeader className="flex flex-col gap-3 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-500">Groups</p>
            <CardTitle className="text-xl text-slate-900">Money pulse</CardTitle>
          </div>
          <Button
            variant="outline"
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
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
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">You’re owed</p>
              <p className="text-2xl font-semibold text-emerald-700">{formatCurrency(primary.owed, primary.currency)}</p>
              <p className="text-xs text-emerald-700">
                From {primary.owedGroups.length || 1} group{primary.owedGroups.length > 1 ? "s" : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">You owe</p>
              <p className="text-2xl font-semibold text-slate-700">
                {primary.owe ? formatCurrency(primary.owe, primary.currency) : "—"}
              </p>
              <p className="text-xs text-slate-500">
                {primary.owe ? `To ${primary.oweGroups.length || 1} friend${primary.oweGroups.length > 1 ? "s" : ""}` : "All square for now."}
              </p>
            </div>
            {summaries.length > 1 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Other currencies</p>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  {summaries.slice(1).map((summary) => (
                    <div key={summary.currency} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-3 py-2">
                      <span>{summary.currency}</span>
                      <span>{formatCurrency(summary.owed - summary.owe, summary.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-slate-500">Create a split group to see balances roll in.</p>
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

function Highlight({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.35em]", dark ? "text-slate-400" : "text-slate-500")}>{label}</p>
      <p className={cn("text-sm", dark ? "text-slate-200" : "text-slate-700")}>{value}</p>
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
