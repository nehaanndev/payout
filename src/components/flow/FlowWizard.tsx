"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Moon, Plus, Sun, UtensilsCrossed, Workflow } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  FlowCategory,
  FlowDayOfWeek,
  FlowFixedEventPreference,
  FlowSettings,
  FLOW_DAY_ORDER,
} from "@/types/flow";
import { generateId } from "@/lib/id";
import { cn } from "@/lib/utils";

const categoryOptions: Array<{ id: FlowCategory; label: string; emoji: string }> = [
  { id: "work", label: "Work", emoji: "💼" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧‍👦" },
  { id: "home", label: "Home & chores", emoji: "🏡" },
  { id: "wellness", label: "Wellness", emoji: "🌿" },
  { id: "play", label: "Leisure & play", emoji: "🎈" },
  { id: "growth", label: "Growth", emoji: "📚" },
];

const DAY_LABELS: Record<FlowDayOfWeek, { label: string; letter: string }> = {
  monday: { label: "Monday", letter: "M" },
  tuesday: { label: "Tuesday", letter: "T" },
  wednesday: { label: "Wednesday", letter: "W" },
  thursday: { label: "Thursday", letter: "T" },
  friday: { label: "Friday", letter: "F" },
  saturday: { label: "Saturday", letter: "S" },
  sunday: { label: "Sunday", letter: "S" },
};

const stepTitles = [
  "Set your daily anchors",
  "Tune your meals",
  "Add fixed rituals",
  "Review your rhythm",
] as const;

const normalizeTagInput = (value: string) => {
  if (!value) {
    return [] as string[];
  }
  const tokens = value
    .split(/[,#]/)
    .map((token) => token.trim())
    .filter(Boolean);
  const next: string[] = [];
  const seen = new Set<string>();
  tokens.forEach((token) => {
    const normalized = token.replace(/\s+/g, " ").toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      next.push(normalized);
    }
  });
  return next;
};

const formatTagString = (tags?: string[]) =>
  Array.isArray(tags) && tags.length ? tags.join(", ") : "";

const ensureRoutineDays = (days?: FlowDayOfWeek[]) =>
  days && days.length ? days : FLOW_DAY_ORDER.slice();

const sortRoutineDays = (days: FlowDayOfWeek[]) => {
  const unique = Array.from(new Set(days));
  return FLOW_DAY_ORDER.filter((day) => unique.includes(day));
};

const cloneSettings = (settings: FlowSettings): FlowSettings => ({
  ...settings,
  meals: settings.meals.map((meal) => ({ ...meal })),
  fixedEvents: settings.fixedEvents.map((event) => ({
    ...event,
    days: ensureRoutineDays(event.days),
    tags: Array.isArray(event.tags) ? [...event.tags] : [],
  })),
  sleepOverrides: { ...(settings.sleepOverrides ?? {}) },
});

type FlowWizardProps = {
  open: boolean;
  settings: FlowSettings;
  onClose: () => void;
  onSave: (settings: FlowSettings) => void;
  isNight?: boolean;
};

type RoutineDialogDraft = {
  id: string | null;
  label: string;
  category: FlowCategory;
  startTime: string;
  durationMinutes: number;
  tags: string;
  days: FlowDayOfWeek[];
};

const createRoutineDraft = (days?: FlowDayOfWeek[]): RoutineDialogDraft => ({
  id: null,
  label: "",
  category: "work",
  startTime: "09:00",
  durationMinutes: 30,
  tags: "",
  days: days ?? FLOW_DAY_ORDER.slice(),
});

export function FlowWizard({ open, settings, onClose, onSave, isNight = false }: FlowWizardProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FlowSettings>(() => cloneSettings(settings));
  const [showSleepOverrides, setShowSleepOverrides] = useState(false);
  const [routineDialogOpen, setRoutineDialogOpen] = useState(false);
  const [routineDialogMode, setRoutineDialogMode] = useState<"daily" | "custom">("daily");
  const [routineDialogDraft, setRoutineDialogDraft] = useState<RoutineDialogDraft>(
    () => createRoutineDraft()
  );

  useEffect(() => {
    if (open) {
      setDraft(cloneSettings(settings));
      setStep(0);
      setShowSleepOverrides(false);
      setRoutineDialogOpen(false);
    }
  }, [open, settings]);

  const canProceed = useMemo(() => {
    if (step === 0) {
      return Boolean(draft.workStart) && Boolean(draft.workEnd);
    }
    if (step === 1) {
      return draft.meals.every((meal) => meal.time && meal.durationMinutes > 0);
    }
    if (step === 2) {
      return draft.fixedEvents.every(
        (event) =>
          Boolean(event.label.trim()) &&
          Boolean(event.startTime) &&
          event.durationMinutes > 0
      );
    }
    return true;
  }, [draft.fixedEvents, draft.meals, draft.workEnd, draft.workStart, step]);

  const handleAddMeal = () => {
    setDraft((prev) => ({
      ...prev,
      meals: [
        ...prev.meals,
        {
          id: generateId(),
          label: "Break",
          time: "15:00",
          durationMinutes: 20,
        },
      ],
    }));
  };

  const handleMealChange = (
    index: number,
    field: "label" | "time" | "durationMinutes",
    value: string
  ) => {
    setDraft((prev) => {
      const meals = prev.meals.slice();
      const target = { ...meals[index] };
      if (field === "durationMinutes") {
        target.durationMinutes = Number(value);
      } else {
        target[field] = value;
      }
      meals[index] = target;
      return { ...prev, meals };
    });
  };

  const handleRemoveMeal = (index: number) => {
    setDraft((prev) => {
      const meals = prev.meals.slice();
      meals.splice(index, 1);
      return { ...prev, meals };
    });
  };

  const toggleSleepOverrideDay = (day: FlowDayOfWeek) => {
    setDraft((prev) => {
      const overrides = { ...(prev.sleepOverrides ?? {}) };
      if (overrides[day]) {
        delete overrides[day];
      } else {
        overrides[day] = {
          sleepStart: prev.sleepStart,
          sleepEnd: prev.sleepEnd,
        };
      }
      return { ...prev, sleepOverrides: overrides };
    });
  };

  const handleSleepOverrideChange = (
    day: FlowDayOfWeek,
    field: "sleepStart" | "sleepEnd",
    value: string
  ) => {
    setDraft((prev) => {
      const overrides = { ...(prev.sleepOverrides ?? {}) };
      const current = overrides[day] ?? {
        sleepStart: prev.sleepStart,
        sleepEnd: prev.sleepEnd,
      };
      overrides[day] = {
        ...current,
        [field]: value,
      };
      return { ...prev, sleepOverrides: overrides };
    });
  };

  const openRoutineDialog = (
    mode: "daily" | "custom",
    routineId?: string
  ) => {
    setRoutineDialogMode(mode);
    if (routineId) {
      const routine = draft.fixedEvents.find((entry) => entry.id === routineId);
      if (routine) {
        setRoutineDialogDraft({
          id: routine.id,
          label: routine.label,
          category: routine.category,
          startTime: routine.startTime,
          durationMinutes: routine.durationMinutes,
          tags: formatTagString(routine.tags),
          days: ensureRoutineDays(routine.days),
        });
        setRoutineDialogOpen(true);
        return;
      }
    }
    setRoutineDialogDraft(
      createRoutineDraft(mode === "daily" ? FLOW_DAY_ORDER.slice() : [])
    );
    setRoutineDialogOpen(true);
  };

  const closeRoutineDialog = () => {
    setRoutineDialogOpen(false);
    setRoutineDialogDraft(createRoutineDraft(FLOW_DAY_ORDER.slice()));
  };

  const handleRoutineDialogField = <K extends keyof RoutineDialogDraft>(
    field: K,
    value: RoutineDialogDraft[K]
  ) => {
    setRoutineDialogDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRoutineDialogDayToggle = (day: FlowDayOfWeek) => {
    setRoutineDialogDraft((prev) => {
      const hasDay = prev.days.includes(day);
      const nextDays = hasDay
        ? prev.days.filter((entry) => entry !== day)
        : [...prev.days, day];
      return {
        ...prev,
        days: sortRoutineDays(nextDays),
      };
    });
  };

  const handleRoutineSave = () => {
    const trimmed = routineDialogDraft.label.trim();
    if (!trimmed) {
      return;
    }
    const days = routineDialogDraft.days.length
      ? sortRoutineDays(routineDialogDraft.days)
      : routineDialogMode === "daily"
      ? FLOW_DAY_ORDER.slice()
      : [];
    if (!days.length) {
      return;
    }
    const nextEvent = {
      id: routineDialogDraft.id ?? generateId(),
      label: trimmed,
      category: routineDialogDraft.category,
      startTime: routineDialogDraft.startTime,
      durationMinutes: Math.max(5, routineDialogDraft.durationMinutes || 15),
      days,
      tags: normalizeTagInput(routineDialogDraft.tags),
    } satisfies FlowFixedEventPreference;
    setDraft((prev) => {
      const fixedEvents = prev.fixedEvents.slice();
      const existingIndex = fixedEvents.findIndex(
        (event) => event.id === nextEvent.id
      );
      if (existingIndex >= 0) {
        fixedEvents[existingIndex] = nextEvent;
      } else {
        fixedEvents.push(nextEvent);
      }
      return { ...prev, fixedEvents };
    });
    closeRoutineDialog();
  };

  const handleRoutineRemove = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      fixedEvents: prev.fixedEvents.filter((event) => event.id !== id),
    }));
  };

  const sleepOverrides = draft.sleepOverrides ?? {};
  const overrideDayOrder = FLOW_DAY_ORDER.filter((day) => Boolean(sleepOverrides[day]));
  const hasSleepOverrides = overrideDayOrder.length > 0;

  const routineDialogCanSave =
    Boolean(routineDialogDraft.label.trim()) &&
    Boolean(routineDialogDraft.startTime) &&
    routineDialogDraft.durationMinutes > 0 &&
    (routineDialogMode === "daily" || routineDialogDraft.days.length > 0);

  const advance = () => {
    if (step === stepTitles.length - 1) {
      onSave({
        ...draft,
        meals: draft.meals.map((meal) => ({
          ...meal,
          durationMinutes: Math.max(5, meal.durationMinutes),
        })),
        fixedEvents: draft.fixedEvents.map((event) => ({
          ...event,
          durationMinutes: Math.max(5, event.durationMinutes),
          days: ensureRoutineDays(event.days),
          tags: Array.isArray(event.tags) ? event.tags : [],
        })),
        sleepOverrides: draft.sleepOverrides ?? {},
      });
      return;
    }
    setStep((prev) => prev + 1);
  };

  const goBack = () => {
    if (step === 0) {
      onClose();
      return;
    }
    setStep((prev) => Math.max(0, prev - 1));
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <DialogContent className={cn(
        "max-h-[90vh] w-full overflow-y-auto rounded-3xl border px-0 pb-0 pt-0 shadow-2xl sm:max-w-3xl",
        isNight
          ? "border-white/15 bg-slate-900/95 shadow-slate-900/50"
          : "border-slate-200 bg-white/95 shadow-emerald-200/40"
      )}>
        <div className={cn(
          "sticky top-0 z-10 border-b px-6 py-5 backdrop-blur",
          isNight ? "border-white/10 bg-slate-900/90" : "border-slate-100 bg-white/90"
        )}>
          <DialogHeader className="space-y-2">
            <DialogTitle className={cn(
              "flex items-center gap-2 text-lg font-semibold",
              isNight ? "text-white" : "text-slate-900"
            )}>
              <Workflow className="h-5 w-5 text-emerald-500" />
              Flow day wizard
            </DialogTitle>
            <DialogDescription className={cn(
              "text-sm",
              isNight ? "text-slate-300" : "text-slate-500"
            )}>
              Shape your default rhythm. Flow will apply these anchors whenever you start a new day.
            </DialogDescription>
          </DialogHeader>
          <div className={cn(
            "mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
            isNight ? "text-emerald-300" : "text-emerald-600"
          )}>
            <span>
              Step {step + 1} of {stepTitles.length}
            </span>
            <span className={cn(isNight ? "text-slate-500" : "text-slate-400")}>·</span>
            <span>{stepTitles[step]}</span>
          </div>
        </div>

        <div className="px-6 py-6">
          {step === 0 ? (
            <div className="space-y-6">
              <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-500")}>
                Keep it simple—set the defaults you reach for most days. You can reopen this anytime.
              </p>
              <section className="space-y-4">
                <div className={cn("flex items-center gap-2 text-sm font-semibold uppercase tracking-wide", isNight ? "text-slate-200" : "text-slate-600")}>
                  <Clock className="h-4 w-4 text-emerald-500" />
                  Workday cadence
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="work-start">Start work</Label>
                    <Input
                      id="work-start"
                      type="time"
                      value={draft.workStart}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, workStart: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="work-end">End work</Label>
                    <Input
                      id="work-end"
                      type="time"
                      value={draft.workEnd}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, workEnd: event.target.value }))
                      }
                    />
                  </div>
                </div>
              </section>
              <Separator />
              <section className="space-y-4">
                <div className={cn("flex items-center gap-2 text-sm font-semibold uppercase tracking-wide", isNight ? "text-slate-200" : "text-slate-600")}>
                  <Moon className="h-4 w-4 text-indigo-500" />
                  Rest & sleep
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sleep-start">Lights out</Label>
                    <Input
                      id="sleep-start"
                      type="time"
                      value={draft.sleepStart}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, sleepStart: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sleep-end">Wake up</Label>
                    <Input
                      id="sleep-end"
                      type="time"
                      value={draft.sleepEnd}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, sleepEnd: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn("text-xs font-semibold", isNight ? "text-emerald-300" : "text-emerald-600")}
                    onClick={() => setShowSleepOverrides((prev) => !prev)}
                  >
                    {showSleepOverrides
                      ? "Hide day overrides"
                      : hasSleepOverrides
                      ? "Show day overrides"
                      : "Different on some days?"}
                  </Button>
                </div>
                {!showSleepOverrides && hasSleepOverrides ? (
                  <p className={cn("text-xs", isNight ? "text-slate-300" : "text-slate-500")}>
                    Custom days: {overrideDayOrder.map((day) => DAY_LABELS[day].label).join(", ")}
                  </p>
                ) : null}
                {showSleepOverrides && (
                  <div className={cn(
                    "space-y-3 rounded-2xl border p-4",
                    isNight ? "border-white/15 bg-slate-800/60" : "border-slate-100 bg-slate-50/60"
                  )}>
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", isNight ? "text-slate-300" : "text-slate-500")}>
                      Pick days to override
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {FLOW_DAY_ORDER.map((day) => {
                        const selected = Boolean(sleepOverrides[day]);
                        return (
                          <Button
                            key={day}
                            type="button"
                            size="sm"
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 text-xs",
                              selected
                                ? isNight
                                  ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                                  : "border-emerald-500 bg-emerald-500 text-white"
                                : isNight
                                ? "border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                            )}
                            onClick={() => toggleSleepOverrideDay(day)}
                          >
                            {DAY_LABELS[day].letter}
                          </Button>
                        );
                      })}
                    </div>
                    {Object.entries(sleepOverrides).map(([day, times]) => (
                      <div
                        key={day}
                        className={cn(
                          "grid gap-3 rounded-2xl border p-3 md:grid-cols-2",
                          isNight ? "border-white/15 bg-slate-800/60" : "border-slate-100 bg-white/80"
                        )}
                      >
                        <div className="space-y-1">
                          <Label>Lights out · {DAY_LABELS[day as FlowDayOfWeek].label}</Label>
                          <Input
                            type="time"
                            value={times.sleepStart}
                            onChange={(event) =>
                              handleSleepOverrideChange(
                                day as FlowDayOfWeek,
                                "sleepStart",
                                event.target.value
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Wake up</Label>
                          <Input
                            type="time"
                            value={times.sleepEnd}
                            onChange={(event) =>
                              handleSleepOverrideChange(
                                day as FlowDayOfWeek,
                                "sleepEnd",
                                event.target.value
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className={cn("flex items-center gap-2 text-sm font-semibold uppercase tracking-wide", isNight ? "text-slate-200" : "text-slate-600")}>
                  <UtensilsCrossed className="h-4 w-4 text-amber-500" />
                  Meals & breaks
                </div>
                <Button variant="ghost" size="sm" className="gap-1" onClick={handleAddMeal}>
                  <Plus className="h-4 w-4" /> Add break
                </Button>
              </div>
              <div className="space-y-3">
                {draft.meals.map((meal, index) => (
                  <div
                    key={meal.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between",
                      isNight ? "border-white/15 bg-slate-800/60" : "border-slate-200 bg-slate-50/60"
                    )}
                  >
                    <div className="flex-1 space-y-2">
                      <Label>Label</Label>
                      <Input
                        value={meal.label}
                        onChange={(event) => handleMealChange(index, "label", event.target.value)}
                      />
                    </div>
                    <div className="flex flex-1 gap-3">
                      <div className="flex-1 space-y-2">
                        <Label>Time</Label>
                        <Input
                          type="time"
                          value={meal.time}
                          onChange={(event) => handleMealChange(index, "time", event.target.value)}
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label>Duration (min)</Label>
                        <Input
                          type="number"
                          min={5}
                          value={meal.durationMinutes}
                          onChange={(event) =>
                            handleMealChange(index, "durationMinutes", event.target.value)
                          }
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMeal(index)}
                      className={cn(
                        isNight ? "text-slate-300 hover:text-rose-400" : "text-slate-500 hover:text-rose-500"
                      )}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className={cn("flex items-center gap-2 text-sm font-semibold uppercase tracking-wide", isNight ? "text-slate-200" : "text-slate-600")}>
                  <Sun className="h-4 w-4 text-emerald-500" />
                  Fixed rituals
                </div>
                <p className={cn("text-sm", isNight ? "text-slate-300" : "text-slate-500")}>
                  Capture the anchors you do every day or only on certain days. We’ll keep them pinned to your schedule.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => openRoutineDialog("daily")}>Add daily routine</Button>
                <Button variant="outline" onClick={() => openRoutineDialog("custom")}>
                  Add routine for specific days
                </Button>
              </div>
              {draft.fixedEvents.length ? (
          <div className="space-y-3">
            {draft.fixedEvents.map((event) => {
              const category = categoryOptions.find((option) => option.id === event.category);
              const isDaily = ensureRoutineDays(event.days).length === FLOW_DAY_ORDER.length;
              return (
                <div
                  key={event.id}
                  className={cn(
                    "space-y-3 rounded-2xl border p-4",
                    isNight ? "border-white/15 bg-slate-800/60" : "border-slate-200 bg-slate-50/60"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={cn("text-sm font-semibold", isNight ? "text-white" : "text-slate-900")}>{event.label}</p>
                      <p className={cn("text-xs", isNight ? "text-slate-300" : "text-slate-500")}>
                        {category ? `${category.emoji} ${category.label}` : "Routine"} · {event.startTime} · {event.durationMinutes} min
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openRoutineDialog(isDaily ? "daily" : "custom", event.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-500 hover:text-rose-600"
                        onClick={() => handleRoutineRemove(event.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                    {FLOW_DAY_ORDER.map((day) => {
                      const active = ensureRoutineDays(event.days).includes(day);
                      return (
                        <span
                          key={`${event.id}-${day}`}
                          className={cn(
                            "rounded-full border px-2 py-0.5",
                            active
                              ? isNight
                                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                                : "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                              : isNight
                              ? "border-white/15 text-slate-500"
                              : "border-slate-200 text-slate-400"
                          )}
                        >
                          {DAY_LABELS[day].letter}
                        </span>
                      );
                    })}
                  </div>
                  {event.tags?.length ? (
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                      {event.tags.map((tag) => (
                        <span
                          key={`${event.id}-${tag}`}
                          className={cn(
                            "rounded-full px-2 py-0.5",
                            isNight
                              ? "bg-white/10 text-slate-300"
                              : "bg-white/80 text-slate-600"
                          )}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
            No routines yet. Add habits you protect so Flow keeps those blocks safe.
          </p>
        )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className={cn("flex items-center gap-2 text-sm font-semibold uppercase tracking-wide", isNight ? "text-slate-200" : "text-slate-600")}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Summary
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={cn(
                    "rounded-2xl border p-4 text-sm",
                    isNight ? "border-white/15 bg-slate-800/60 text-slate-200" : "border-slate-200 bg-slate-50/60 text-slate-600"
                  )}>
                    <p>
                      <strong>Work hours:</strong> {draft.workStart} - {draft.workEnd}
                    </p>
                    <p>
                      <strong>Sleep:</strong> {draft.sleepStart} - {draft.sleepEnd}
                    </p>
                    {hasSleepOverrides ? (
                      <div className="mt-2 text-xs">
                        <p className={cn("font-semibold", isNight ? "text-slate-200" : "text-slate-700")}>Overrides</p>
                        <ul className={cn("mt-1 space-y-1", isNight ? "text-slate-300" : "text-slate-500")}>
                          {Object.entries(sleepOverrides).map(([day, times]) => (
                            <li key={`summary-${day}`}>
                              {DAY_LABELS[day as FlowDayOfWeek].label}: {times.sleepStart} - {times.sleepEnd}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  <div className={cn(
                    "rounded-2xl border p-4 text-sm",
                    isNight ? "border-white/15 bg-slate-800/60 text-slate-200" : "border-slate-200 bg-slate-50/60 text-slate-600"
                  )}>
                    <p className={cn("font-semibold", isNight ? "text-slate-200" : "text-slate-700")}>Meals & breaks</p>
                    <ul className="mt-1 space-y-1">
                      {draft.meals.map((meal) => (
                        <li key={meal.id}>
                          {meal.label}: {meal.time} · {meal.durationMinutes} min
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
              <section className="space-y-2">
                <h3 className={cn("text-sm font-semibold uppercase tracking-wide", isNight ? "text-slate-200" : "text-slate-600")}>
                  Fixed events
                </h3>
                {draft.fixedEvents.length ? (
                  <ul className={cn("space-y-1 text-sm", isNight ? "text-slate-200" : "text-slate-600")}>
                    {draft.fixedEvents.map((event) => {
                      const category = categoryOptions.find((item) => item.id === event.category);
                      return (
                        <li key={event.id} className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span>{category?.emoji}</span>
                            <span className={cn("font-medium", isNight ? "text-white" : "text-slate-700")}>{event.label}</span>
                            <span>- {event.startTime}</span>
                            <span>· {event.durationMinutes} min</span>
                          </div>
                          <div className={cn("flex flex-wrap gap-1 text-[11px] uppercase tracking-wide", isNight ? "text-slate-400" : "text-slate-500")}>
                            {FLOW_DAY_ORDER.map((day) => {
                              const active = ensureRoutineDays(event.days).includes(day);
                              return (
                                <span
                                  key={`summary-${event.id}-${day}`}
                                  className={cn(
                                    "rounded-full border px-1",
                                    active
                                      ? isNight
                                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                                        : "border-emerald-400 text-emerald-600"
                                      : isNight
                                      ? "border-white/15 text-slate-500"
                                      : "border-slate-200"
                                  )}
                                >
                                  {DAY_LABELS[day].letter}
                                </span>
                              );
                            })}
                          </div>
                          {event.tags?.length ? (
                            <div className={cn("flex flex-wrap gap-1 text-[11px]", isNight ? "text-slate-400" : "text-slate-500")}>
                              {event.tags.map((tag) => (
                                <span key={`summary-tag-${event.id}-${tag}`}>#{tag}</span>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className={cn(
                    "rounded-2xl border border-dashed p-4 text-sm",
                    isNight
                      ? "border-white/15 bg-slate-800/40 text-slate-300"
                      : "border-slate-200 bg-slate-50/60 text-slate-500"
                  )}>
                    No fixed chores or rituals added.
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </div>

        <DialogFooter className={cn(
          "sticky bottom-0 flex items-center justify-between gap-3 border-t px-6 py-4",
          isNight ? "border-white/10 bg-slate-900/90" : "border-slate-100 bg-white/90"
        )}>
          <Button variant="ghost" onClick={goBack}>
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              onClick={advance}
              disabled={!canProceed}
              className="bg-emerald-500 text-white hover:bg-emerald-400"
            >
              {step === stepTitles.length - 1 ? "Save defaults" : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <Dialog
        open={routineDialogOpen}
        onOpenChange={(value) => {
          if (!value) {
            closeRoutineDialog();
          }
        }}
      >
        <DialogContent className={cn(
          "sm:max-w-md",
          isNight && "border-white/15 bg-slate-900/95"
        )}>
          <DialogHeader className="space-y-1">
            <DialogTitle className={cn(isNight && "text-white")}>
              {routineDialogDraft.id ? "Edit routine" : "Add routine"}
            </DialogTitle>
            <DialogDescription className={cn(isNight && "text-slate-300")}>
              Give it a name, pick when it happens, and choose the days. Keep it quick and simple.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="routine-name">Routine name</Label>
              <Input
                id="routine-name"
                value={routineDialogDraft.label}
                onChange={(event) => handleRoutineDialogField("label", event.target.value)}
                placeholder="Morning pages, school drop-off…"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={routineDialogDraft.category}
                onValueChange={(value) =>
                  handleRoutineDialogField("category", value as FlowCategory)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a lane" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <span className="flex items-center gap-2">
                        <span>{option.emoji}</span>
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={routineDialogDraft.startTime}
                  onChange={(event) =>
                    handleRoutineDialogField("startTime", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={5}
                  value={routineDialogDraft.durationMinutes}
                  onChange={(event) =>
                    handleRoutineDialogField("durationMinutes", Number(event.target.value))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-2">
                {FLOW_DAY_ORDER.map((day) => {
                  const selected = routineDialogDraft.days.includes(day);
                  return (
                    <Button
                      key={`dialog-${day}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        "rounded-full px-3 text-xs",
                        selected
                          ? isNight
                            ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                            : "border-emerald-500 bg-emerald-500 text-white"
                          : isNight
                          ? "border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
                          : "border-slate-200 text-slate-500"
                      )}
                      onClick={() => handleRoutineDialogDayToggle(day)}
                    >
                      {DAY_LABELS[day].letter}
                    </Button>
                  );
                })}
              </div>
              {routineDialogMode === "daily" ? (
                <p className={cn("text-xs", isNight ? "text-slate-300" : "text-slate-500")}>
                  Daily routines auto-select every day.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input
                value={routineDialogDraft.tags}
                onChange={(event) => handleRoutineDialogField("tags", event.target.value)}
                placeholder="work, kids, #energy"
              />
            </div>
          </div>
          <DialogFooter className="mt-4 flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={closeRoutineDialog}>
              Cancel
            </Button>
            <Button onClick={handleRoutineSave} disabled={!routineDialogCanSave}>
              Save routine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
