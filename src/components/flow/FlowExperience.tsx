"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";

import {
  CalendarClock,
  Check,
  CircleCheckBig,
  FastForward,
  Flame,
  HeartPulse,
  Hourglass,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Sparkles,
  TimerReset,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

import { AppTopBar } from "@/components/AppTopBar";

import { OrbitFlowNav } from "@/components/OrbitFlowNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FlowWizard } from "@/components/flow/FlowWizard";
import {
  auth,
  facebookProvider,
  microsoftProvider,
  onAuthStateChanged,
  provider,
  signInWithPopup,
  type User,
} from "@/lib/firebase";
import {
  ensureFlowPlan,
  getFlowDateKey,
  saveFlowPlan,
} from "@/lib/flowService";
import {
  fetchFlowSettings,
  saveFlowSettings,
} from "@/lib/flowSettingsService";
import { getUserProfile } from "@/lib/userService";
import type { UserProfile } from "@/types/user";
import { generateId } from "@/lib/id";
import {
  FlowCategory,
  FlowDayOfWeek,
  FlowPlan,
  FlowReflection,
  FlowSettings,
  FlowTask,
  FlowTaskStatus,
  FlowTaskType,
  FLOW_DAY_ORDER,
} from "@/types/flow";
import { FLOW_MOOD_OPTIONS } from "@/lib/flowMood";
import { cn } from "@/lib/utils";
import { useToodlTheme } from "@/hooks/useToodlTheme";

type PlannerError = {
  id: string;
  message: string;
};

const CATEGORY_META: Record<
  FlowCategory,
  { label: string; accent: string; chip: string; emoji: string }
> = {
  work: {
    label: "Work",
    accent: "bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400",
    chip: "bg-indigo-100 text-indigo-700 border-indigo-200",
    emoji: "💼",
  },
  family: {
    label: "Family",
    accent: "bg-gradient-to-r from-rose-400 via-pink-400 to-rose-500",
    chip: "bg-rose-100 text-rose-700 border-rose-200",
    emoji: "👨‍👩‍👧‍👦",
  },
  home: {
    label: "Home & Chores",
    accent: "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400",
    chip: "bg-amber-100 text-amber-700 border-amber-200",
    emoji: "🏡",
  },
  wellness: {
    label: "Wellness",
    accent: "bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500",
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    emoji: "🌿",
  },
  play: {
    label: "Play",
    accent: "bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-500",
    chip: "bg-sky-100 text-sky-700 border-sky-200",
    emoji: "🎈",
  },
  growth: {
    label: "Growth",
    accent: "bg-gradient-to-r from-purple-400 via-purple-500 to-fuchsia-500",
    chip: "bg-purple-100 text-purple-700 border-purple-200",
    emoji: "📚",
  },
};

const TASK_TYPE_LABEL: Record<FlowTaskType, string> = {
  priority: "Top priority",
  chore: "Essential chore",
  flex: "Flex block",
};



const MINUTE_OPTIONS = [15, 25, 45, 60, 90, 120];

const formatTime = (iso?: string | null) => {
  if (!iso) {
    return "--:--";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const parseTimeStringToDate = (dateKey: string, time: string) => {
  // time expected HH:mm
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year, month - 1, day, hours, minutes || 0, 0, 0);
};

const parseIso = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const pad = (value: number) => String(value).padStart(2, "0");

const toTimeInputValue = (iso: string | null | undefined) => {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const DAY_INDEX_TO_FLOW_DAY: FlowDayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const getFlowDayFromDateKey = (dateKey: string): FlowDayOfWeek => {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  const index = date.getDay();
  return DAY_INDEX_TO_FLOW_DAY[index] ?? "monday";
};

const ensureEventDays = (days?: FlowDayOfWeek[]) =>
  days && days.length ? days : FLOW_DAY_ORDER.slice();

const sortTasksBySchedule = (tasks: FlowTask[]) =>
  tasks
    .slice()
    .sort((left, right) => {
      const leftStart = left.scheduledStart
        ? new Date(left.scheduledStart).getTime()
        : Number.POSITIVE_INFINITY;
      const rightStart = right.scheduledStart
        ? new Date(right.scheduledStart).getTime()
        : Number.POSITIVE_INFINITY;
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }
      return left.sequence - right.sequence;
    })
    .map((task, index) => ({
      ...task,
      sequence: index,
    }));

const reindexSequence = (tasks: FlowTask[]) =>
  tasks.map((task, index) => ({
    ...task,
    sequence: index,
  }));

const isFinishedStatus = (status: FlowTaskStatus) =>
  status === "done" || status === "skipped" || status === "failed";

const generateAutoSchedule = (
  tasks: FlowTask[],
  dateKey: string,
  startTime: string
) => {
  if (!tasks.length) {
    return tasks;
  }
  const base = parseTimeStringToDate(dateKey, startTime || "08:00");
  let cursor = new Date(base);
  const ordered = reindexSequence(tasks).sort((a, b) => a.sequence - b.sequence);
  const updated: FlowTask[] = [];

  ordered.forEach((task) => {
    if (isFinishedStatus(task.status)) {
      const end = parseIso(task.actualEnd) ?? parseIso(task.scheduledEnd);
      if (end) {
        cursor = new Date(Math.max(cursor.getTime(), end.getTime()));
      }
      updated.push(task);
      return;
    }

    if (task.locked && task.scheduledStart && task.scheduledEnd) {
      const lockedEnd = parseIso(task.scheduledEnd);
      if (lockedEnd) {
        cursor = new Date(Math.max(cursor.getTime(), lockedEnd.getTime()));
      }
      updated.push(task);
      return;
    }

    const estimateMs = Math.max(5, task.estimateMinutes) * 60 * 1000;
    const startDate = new Date(cursor);
    const endDate = new Date(cursor.getTime() + estimateMs);
    cursor = new Date(endDate);

    updated.push({
      ...task,
      scheduledStart: startDate.toISOString(),
      scheduledEnd: endDate.toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return sortTasksBySchedule(updated);
};

const reschedulePendingTasks = (
  tasks: FlowTask[],
  dateKey: string,
  startTime: string
) => {
  const now = new Date();
  const base = parseTimeStringToDate(dateKey, startTime || "08:00");
  let cursor = new Date(Math.max(now.getTime(), base.getTime()));

  const ordered = tasks.slice().sort((a, b) => a.sequence - b.sequence);
  const updated: FlowTask[] = [];

  ordered.forEach((task) => {
    if (task.status === "done" || task.status === "skipped" || task.status === "failed") {
      const end = parseIso(task.actualEnd) ?? parseIso(task.scheduledEnd);
      if (end) {
        cursor = new Date(Math.max(cursor.getTime(), end.getTime()));
      }
      updated.push(task);
      return;
    }

    if (task.locked && task.scheduledStart && task.scheduledEnd) {
      const startDate = parseIso(task.scheduledStart) ?? cursor;
      const endDate = parseIso(task.scheduledEnd) ?? startDate;
      cursor = new Date(Math.max(cursor.getTime(), endDate.getTime()));
      updated.push(task);
      return;
    }

    const estimateMs = Math.max(5, task.estimateMinutes) * 60 * 1000;
    const startDate = new Date(Math.max(cursor.getTime(), now.getTime()));
    const endDate = new Date(startDate.getTime() + estimateMs);
    cursor = new Date(endDate);

    updated.push({
      ...task,
      scheduledStart: startDate.toISOString(),
      scheduledEnd: endDate.toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return sortTasksBySchedule(updated);
};

const ensureAutoScheduleState = (plan: FlowPlan): FlowPlan => ({
  ...plan,
  autoScheduleEnabled: plan.autoScheduleEnabled ?? true,
});

const autoSchedulingActive = (plan: FlowPlan) =>
  plan.autoScheduleEnabled ?? true;

const applySettingsToPlan = (
  plan: FlowPlan,
  settings: FlowSettings
): FlowPlan => {
  const dateKey = plan.date;
  const dayOfWeek = getFlowDayFromDateKey(dateKey);
  const manualTasks = plan.tasks.filter((task) => !task.templateId);
  const existingTemplateMap = new Map(
    plan.tasks
      .filter((task) => task.templateId)
      .map((task) => [task.templateId ?? "", task])
  );

  const buildLockedTask = (
    templateId: string,
    title: string,
    category: FlowCategory,
    type: FlowTaskType,
    start: string,
    durationMinutes: number
  ): FlowTask => {
    const startDate = parseTimeStringToDate(dateKey, start);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    const nowIso = new Date().toISOString();
    const existing = existingTemplateMap.get(templateId) ?? null;
    return {
      id: existing?.id ?? generateId(),
      title,
      type,
      category,
      estimateMinutes: durationMinutes,
      sequence: existing?.sequence ?? 0,
      locked: true,
      templateId,
      status: existing?.status ?? "pending",
      scheduledStart: startDate.toISOString(),
      scheduledEnd: endDate.toISOString(),
      notes: existing?.notes ?? null,
      actualStart: existing?.actualStart ?? null,
      actualEnd: existing?.actualEnd ?? null,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
  };

  const templateTasks: FlowTask[] = [];

  settings.meals.forEach((meal) => {
    templateTasks.push(
      buildLockedTask(
        `meal:${meal.id}`,
        meal.label,
        "wellness",
        "flex",
        meal.time,
        meal.durationMinutes
      )
    );
  });

  settings.fixedEvents.forEach((event) => {
    const activeDays = ensureEventDays(event.days);
    if (!activeDays.includes(dayOfWeek)) {
      return;
    }
    templateTasks.push(
      buildLockedTask(
        `fixed:${event.id}`,
        event.label,
        event.category,
        "chore",
        event.startTime,
        event.durationMinutes
      )
    );
  });

  const combined = [...manualTasks, ...templateTasks];
  const sorted = sortTasksBySchedule(combined);

  return {
    ...plan,
    startTime: settings.workStart,
    timezone: settings.timezone || plan.timezone,
    tasks: sorted,
  };
};

const getCurrentTask = (plan: FlowPlan | null, nowMs: number) => {
  if (!plan) {
    return null;
  }
  return (
    plan.tasks.find((task) => {
      if (!task.scheduledStart || !task.scheduledEnd) {
        return false;
      }
      if (task.status === "done" || task.status === "skipped") {
        return false;
      }
      const startMs = new Date(task.scheduledStart).getTime();
      const endMs = new Date(task.scheduledEnd).getTime();
      return startMs <= nowMs && nowMs < endMs;
    }) ?? null
  );
};

const getCatchUpTasks = (plan: FlowPlan | null, nowMs: number) => {
  if (!plan) {
    return [];
  }
  return plan.tasks.filter((task) => {
    if (task.status !== "pending" && task.status !== "in_progress") {
      return false;
    }
    if (!task.scheduledEnd) {
      return false;
    }
    const endMs = new Date(task.scheduledEnd).getTime();
    return endMs <= nowMs;
  });
};

type DraftTaskInput = {
  title: string;
  category: FlowCategory;
  estimate: number;
  notes?: string;
};

const normaliseDraftTitle = (value: string) => value.trim();

export function FlowExperience() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [plan, setPlan] = useState<FlowPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [settings, setSettings] = useState<FlowSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsApplied, setSettingsApplied] = useState(false);
  const [activeDate, setActiveDate] = useState(getFlowDateKey());
  const [startTime, setStartTime] = useState("08:00");
  const [errors, setErrors] = useState<PlannerError[]>([]);
  const [priorityDraft, setPriorityDraft] = useState<DraftTaskInput>({
    title: "",
    category: "work",
    estimate: 45,
    notes: "",
  });
  const [choreDraft, setChoreDraft] = useState<DraftTaskInput>({
    title: "",
    category: "home",
    estimate: 30,
    notes: "",
  });
  const [flexDraft, setFlexDraft] = useState<DraftTaskInput>({
    title: "",
    category: "play",
    estimate: 30,
    notes: "",
  });
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FlowTask | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>("");
  const [editDuration, setEditDuration] = useState<number>(30);
  const [timelineOnly, setTimelineOnly] = useState(false);
  const [reflectionMoodId, setReflectionMoodId] = useState<string | null>(null);
  const [reflectionNote, setReflectionNote] = useState("");
  const [reflectionSaving, setReflectionSaving] = useState(false);

  const initialTheme = useMemo(
    () => (new Date().getHours() < 17 ? "morning" : "night"),
    []
  );
  const { theme, setTheme, isNight } = useToodlTheme(initialTheme);

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const persistPlan = useCallback(
    async (nextPlan: FlowPlan) => {
      if (!user) {
        return;
      }
      setSaving(true);
      try {
        await saveFlowPlan(user.uid, nextPlan);
      } catch (error) {
        console.error("Failed to save plan", error);
        setErrors((prev) => [
          ...prev,
          {
            id: generateId(),
            message: "We couldn't save your updates. They’ll retry shortly.",
          },
        ]);
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      setUser(current);
      if (current) {
        const profile = await getUserProfile(current.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setSettingsApplied(false);
      setSettingsLoading(false);
      return;
    }
    let cancelled = false;
    setSettingsLoading(true);
    fetchFlowSettings(user.uid, timezone)
      .then((preferences) => {
        if (!cancelled) {
          setSettings(preferences);
          setSettingsApplied(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load Flow settings", error);
        if (!cancelled) {
          setErrors((prev) => [
            ...prev,
            {
              id: generateId(),
              message: "We couldn't load your Flow defaults. You can still plan manually.",
            },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [timezone, user]);

  useEffect(() => {
    if (!user) {
      setPlan(null);
      setLoadingPlan(false);
      return;
    }

    let isCancelled = false;
    setLoadingPlan(true);
    ensureFlowPlan(user.uid, activeDate, timezone)
      .then((loadedPlan) => {
        if (isCancelled) {
          return;
        }
        setPlan(ensureAutoScheduleState(loadedPlan));
        setStartTime(loadedPlan.startTime || "08:00");
      })
      .catch((error) => {
        console.error("Failed to load Flow plan", error);
        if (!isCancelled) {
          setErrors((prev) => [
            ...prev,
            {
              id: generateId(),
              message:
                "We couldn't load your Flow plan. Please refresh or try again in a moment.",
            },
          ]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingPlan(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeDate, timezone, user]);

  useEffect(() => {
    if (!plan || !settings || settingsApplied || !user) {
      return;
    }

    if (plan.tasks.length === 0) {
      setPlan((prev) => {
        if (!prev) {
          return prev;
        }
        const applied = applySettingsToPlan(prev, settings);
        setStartTime(applied.startTime);
        void persistPlan(applied);
        return applied;
      });
    } else {
      setStartTime(plan.startTime || settings.workStart);
    }

    setSettingsApplied(true);
  }, [plan, persistPlan, settings, settingsApplied, user]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const updatePlan = useCallback(
    (mutator: (plan: FlowPlan) => FlowPlan) => {
      setPlan((prev) => {
        if (!prev) {
          return prev;
        }
        const basePlan = ensureAutoScheduleState(prev);
        const mutated = ensureAutoScheduleState(mutator(basePlan));
        const next = {
          ...mutated,
          updatedAt: new Date().toISOString(),
        };
        void persistPlan(next);
        return next;
      });
    },
    [persistPlan]
  );

  const priorityCount = useMemo(
    () => plan?.tasks.filter((task) => task.type === "priority").length ?? 0,
    [plan?.tasks]
  );

  const addTask = useCallback(
    (type: FlowTaskType, draft: DraftTaskInput) => {
      const title = normaliseDraftTitle(draft.title);
      if (!plan || !title) {
        return;
      }



      const nowIso = new Date().toISOString();
      const nextSequence =
        plan.tasks.length > 0
          ? Math.max(...plan.tasks.map((task) => task.sequence)) + 1
          : 0;

      const newTask: FlowTask = {
        id: generateId(),
        title,
        type,
        category: draft.category,
        estimateMinutes: Math.max(5, draft.estimate || 30),
        sequence: nextSequence,
        status: "pending",
        notes: draft.notes?.trim() ? draft.notes.trim() : null,
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: null,
        actualEnd: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      updatePlan((current) => ({
        ...current,
        tasks: [...current.tasks, newTask],
      }));
    },
    [plan, priorityCount, updatePlan]
  );

  const handleGenerateSchedule = useCallback(() => {
    if (!plan || !plan.tasks.length) {
      setErrors((prev) => [
        ...prev,
        {
          id: generateId(),
          message: "Add at least one task before generating a schedule.",
        },
      ]);
      return;
    }
    updatePlan((current) => {
      const scheduledTasks = generateAutoSchedule(
        current.tasks,
        current.date,
        startTime
      );
      return {
        ...current,
        startTime,
        autoScheduleEnabled: true,
        tasks: scheduledTasks,
      };
    });
  }, [plan, startTime, updatePlan]);

  const handleStartTimeChange = useCallback(
    (value: string) => {
      setStartTime(value);
      if (!plan) {
        return;
      }
      updatePlan((current) => ({
        ...current,
        startTime: value,
        tasks: autoSchedulingActive(current)
          ? reschedulePendingTasks(current.tasks, current.date, value)
          : current.tasks,
      }));
    },
    [plan, updatePlan]
  );

  const handleTaskStatusChange = useCallback(
    (taskId: string, status: FlowTaskStatus) => {
      if (!plan) {
        return;
      }
      const nowIso = new Date().toISOString();
      updatePlan((current) => {
        const updatedTasks = current.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }
          if (status === task.status) {
            return task;
          }
          const next: FlowTask = {
            ...task,
            status,
            updatedAt: nowIso,
          };
          if (status === "in_progress") {
            next.actualStart = next.actualStart ?? nowIso;
          }
          if (status === "done") {
            next.actualStart = next.actualStart ?? nowIso;
            next.actualEnd = nowIso;
          }
          if (status === "skipped") {
            next.actualEnd = nowIso;
          }
          if (status === "failed") {
            next.actualStart = next.actualStart ?? task.scheduledStart ?? nowIso;
            next.actualEnd = nowIso;
          }
          if (status === "pending") {
            next.actualStart = null;
            next.actualEnd = null;
          }
          return next;
        });
        const shouldReschedule = autoSchedulingActive(current) && isFinishedStatus(status);
        const tasksWithSchedule = shouldReschedule
          ? reschedulePendingTasks(updatedTasks, current.date, current.startTime)
          : updatedTasks;
        return {
          ...current,
          tasks: tasksWithSchedule,
        };
      });
    },
    [plan, updatePlan]
  );

  const handleRemoveTask = useCallback(
    (taskId: string) => {
      if (!plan) {
        return;
      }
      updatePlan((current) => {
        const filtered = sortTasksBySchedule(
          current.tasks.filter((task) => task.id !== taskId)
        );
        const nextTasks = autoSchedulingActive(current)
          ? reschedulePendingTasks(
            filtered,
            current.date,
            current.startTime
          )
          : filtered;
        return {
          ...current,
          tasks: nextTasks,
        };
      });
    },
    [plan, updatePlan]
  );

  const handleMoveTask = useCallback(
    (taskId: string, direction: "up" | "down") => {
      if (!plan) {
        return;
      }
      updatePlan((current) => {
        const idx = current.tasks.findIndex((task) => task.id === taskId);
        if (idx === -1) {
          return current;
        }
        const swapWith = direction === "up" ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= current.tasks.length) {
          return current;
        }
        const nextTasks = [...current.tasks];
        const temp = nextTasks[idx];
        nextTasks[idx] = nextTasks[swapWith];
        nextTasks[swapWith] = temp;
        const reindexed = sortTasksBySchedule(nextTasks);
        return {
          ...current,
          tasks: autoSchedulingActive(current)
            ? reschedulePendingTasks(
              reindexed,
              current.date,
              current.startTime
            )
            : reindexed,
        };
      });
    },
    [plan, updatePlan]
  );


  const handleSaveTaskEdits = useCallback(() => {
    if (!plan || !editingTask) {
      return;
    }
    const appliedStart = editStartTime || startTime;
    const duration = Math.max(5, Number(editDuration) || editingTask.estimateMinutes);
    const startDate = parseTimeStringToDate(plan.date, appliedStart);
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    const nowIso = new Date().toISOString();
    updatePlan((current) => {
      const updatedTasks = current.tasks.map((task) => {
        if (task.id !== editingTask.id) {
          return task;
        }
        return {
          ...task,
          estimateMinutes: duration,
          scheduledStart: startDate.toISOString(),
          scheduledEnd: endDate.toISOString(),
          updatedAt: nowIso,
        };
      });
      return {
        ...current,
        autoScheduleEnabled: false,
        tasks: sortTasksBySchedule(updatedTasks),
      };
    });
    setEditingTask(null);
  }, [editDuration, editStartTime, editingTask, plan, startTime, updatePlan]);

  const handleAddReflection = useCallback(() => {
    if (!plan || reflectionSaving) {
      return;
    }
    const trimmed = reflectionNote.trim();
    if (!trimmed) {
      setErrors((prev) => [
        ...prev,
        {
          id: generateId(),
          message: "Add a quick note about how the day feels before saving.",
        },
      ]);
      return;
    }
    const selectedMood =
      FLOW_MOOD_OPTIONS.find((option) => option.id === reflectionMoodId) ??
      FLOW_MOOD_OPTIONS.find((option) => option.id === "calm");
    setReflectionSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const newReflection: FlowReflection = {
        id: generateId(),
        taskId: null,
        note: trimmed,
        sentiment: selectedMood?.sentiment ?? "neutral",
        mood: selectedMood?.emoji,
        moodLabel: selectedMood?.label,
        createdAt: nowIso,
      };
      updatePlan((current) => ({
        ...current,
        reflections: [newReflection, ...current.reflections],
      }));
      setReflectionMoodId(null);
      setReflectionNote("");
    } finally {
      setReflectionSaving(false);
    }
  }, [plan, reflectionMoodId, reflectionNote, reflectionSaving, updatePlan]);

  const currentTask = useMemo(
    () => getCurrentTask(plan, now),
    [plan, now]
  );
  const catchUpTasks = useMemo(
    () => getCatchUpTasks(plan, now),
    [plan, now]
  );

  const menuSections = useMemo(() => {
    if (!user) {
      return [];
    }
    return [
      {
        title: "Flow",
        items: [
          {
            label: "Reset schedule",
            icon: <TimerReset className="h-4 w-4 text-slate-400" />,
            onClick: () => handleGenerateSchedule(),
            disabled: !plan?.tasks.length,
          },
        ],
      },
    ];
  }, [handleGenerateSchedule, plan?.tasks.length, user]);

  const userSlot = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {menuSections.map((section, idx) => (
          <Fragment key={idx}>
            {section.title && <DropdownMenuLabel>{section.title}</DropdownMenuLabel>}
            {section.items.map((item, itemIdx) => (
              <DropdownMenuItem
                key={itemIdx}
                onClick={() => {
                  if (item.onClick) void item.onClick();
                }}
                disabled={item.disabled}
              >
                {item.icon && <span className="mr-2">{item.icon}</span>}
                {item.label}
              </DropdownMenuItem>
            ))}
            {idx < menuSections.length - 1 && <DropdownMenuSeparator />}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const catchUpIds = catchUpTasks.map((task) => task.id);

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
      } catch (error) {
        console.error("Sign-in failed", error);
        setErrors((prev) => [
          ...prev,
          {
            id: generateId(),
            message: "Sign-in failed. Please try again.",
          },
        ]);
      }
    },
    []
  );



  const handleDismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((error) => error.id !== id));
  }, []);

  const tasksForDate = plan?.tasks ?? [];

  const daytimeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return "Good morning";
    }
    if (hour < 18) {
      return "Good afternoon";
    }
    return "Good evening";
  }, []);


  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 transition-colors",
        isNight && "from-slate-950 via-slate-900 to-emerald-950 text-slate-100"
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-10 md:px-6">
        <AppTopBar
          product="flow"
          heading="Flow"
          subheading="Design your day, weave priorities with pause, and stay on tempo."
          dark={isNight}
          theme={theme}
          onThemeChange={setTheme}
          actions={undefined}
          userSlot={user ? userSlot : undefined}
        />

        {errors.length ? (
          <div className="space-y-2">
            {errors.map((error) => (
              <div
                key={error.id}
                className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 shadow-sm"
              >
                <span>{error.message}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismissError(error.id)}
                  className="text-rose-500 hover:text-rose-700"
                >
                  Dismiss
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {!authChecked || loadingPlan || settingsLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : !user ? (
          <Card className={cn(
            "flex flex-col items-center gap-4 border-slate-200 bg-white/90 p-12 text-center backdrop-blur",
            isNight ? "shadow-2xl shadow-slate-900/50" : "shadow-2xl shadow-emerald-200/30"
          )}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Flame className="h-6 w-6" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-slate-900">
                Flow keeps your day in rhythm
              </h2>
              <p className="text-sm text-slate-500">
                Sign in to craft schedules that blend focus, chores, and rest.
                We’ll remember your tempo across devices.
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
        ) : (
          <>
            {plan ? (
              <div className={cn(
                "flex flex-col gap-2 rounded-3xl border px-4 py-3 shadow-sm",
                isNight ? "border-white/15 bg-slate-900/60" : "border-slate-200 bg-white/80"
              )}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className={cn("text-sm font-semibold", isNight ? "text-white" : "text-slate-900")}>Timeline focus</p>
                    <p className={cn("text-xs", isNight ? "text-slate-300" : "text-slate-500")}>
                      Collapse planning tools to keep only Today&apos;s timeline visible.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrbitFlowNav isNight={isNight} />
                    <span className={cn("text-sm font-medium", isNight ? "text-slate-200" : "text-slate-600")}>
                      {timelineOnly ? "Timeline only" : "Full workspace"}
                    </span>
                    <Switch
                      checked={timelineOnly}
                      onCheckedChange={setTimelineOnly}
                      aria-label="Toggle timeline-only view"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {plan && !timelineOnly ? (
              <Card className={cn(
                "border-none p-6",
                isNight
                  ? "bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 shadow-xl shadow-slate-900/50"
                  : "bg-gradient-to-br from-white via-white/90 to-emerald-50 shadow-xl shadow-emerald-200/40"
              )}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className={cn(
                      "text-2xl font-semibold",
                      isNight ? "text-white" : "text-slate-900"
                    )}>
                      {daytimeGreeting}, {user.displayName ?? "friend"} 👋
                    </h2>
                    <p className={cn(
                      "text-sm",
                      isNight ? "text-slate-300" : "text-slate-600"
                    )}>
                      Keep the rhythm steady. We&apos;ll nudge you if anything drifts off tempo.
                    </p>
                    {settings ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <div className={cn(
                          "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                          isNight ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300" : "border-indigo-100 bg-indigo-50 text-indigo-700"
                        )}>
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                          Work planned: {Math.floor(
                            (plan?.tasks
                              .filter((t) => t.category === "work" && t.status !== "skipped")
                              .reduce((acc, t) => acc + t.estimateMinutes, 0) || 0) / 60
                          )}h {
                            ((plan?.tasks
                              .filter((t) => t.category === "work" && t.status !== "skipped")
                              .reduce((acc, t) => acc + t.estimateMinutes, 0) || 0) % 60)
                          }m
                        </div>
                        <div className={cn(
                          "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                          isNight ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-emerald-100 bg-emerald-50 text-emerald-700"
                        )}>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Free time: {(() => {
                            const start = parseTimeStringToDate(activeDate, settings.sleepEnd);
                            const end = parseTimeStringToDate(activeDate, settings.sleepStart);
                            // If sleep start is earlier than sleep end (e.g. 23:00 vs 07:00), it's same day.
                            // If sleep start is smaller (e.g. 01:00) but meant to be next day, we need to handle that.
                            // Usually sleepStart is bedtime (e.g. 23:00) and sleepEnd is wake up (e.g. 07:00).
                            // Active day is sleepEnd to sleepStart.
                            let activeMinutes = (end.getTime() - start.getTime()) / 1000 / 60;
                            if (activeMinutes < 0) {
                              activeMinutes += 24 * 60;
                            }

                            const committedMinutes = plan?.tasks
                              .filter((t) =>
                                (t.category === "work" || t.category === "home" || t.category === "wellness") &&
                                t.status !== "skipped"
                              )
                              .reduce((acc, t) => acc + t.estimateMinutes, 0) ?? 0;

                            const freeMinutes = Math.max(0, activeMinutes - committedMinutes);
                            return `${Math.floor(freeMinutes / 60)}h ${Math.floor(freeMinutes % 60)}m`;
                          })()}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm shadow-sm">
                      <CalendarClock className="h-4 w-4 text-emerald-500" />
                      <input
                        type="date"
                        value={activeDate}
                        onChange={(event) => setActiveDate(event.target.value)}
                        className="rounded-md border border-transparent bg-transparent focus:border-emerald-300 focus:outline-none focus:ring-0"
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm shadow-sm">
                      <Hourglass className="h-4 w-4 text-emerald-500" />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(event) =>
                          handleStartTimeChange(event.target.value)
                        }
                        className="rounded-md border border-transparent bg-transparent focus:border-emerald-300 focus:outline-none focus:ring-0"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className={cn(
                        "gap-2",
                        isNight
                          ? "bg-indigo-500/90 text-slate-900 hover:bg-indigo-400 border-transparent"
                          : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      )}
                      onClick={() => setWizardOpen(true)}
                    >
                      <Sparkles className="h-4 w-4" /> Plan Your Day
                    </Button>
                  </div>
                </div>
                {currentTask ? (
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <div className={cn(
                      "relative overflow-hidden rounded-3xl border p-5",
                      isNight
                        ? "border-white/20 bg-slate-800/60 shadow-lg shadow-slate-900/50"
                        : "border-emerald-200 bg-white/80 shadow-lg shadow-emerald-200/40"
                    )}>
                      {!isNight && (
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white/90 to-transparent opacity-80" />
                      )}
                      <div className="relative flex flex-col gap-2">
                        <div className={cn(
                          "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
                          isNight ? "text-emerald-300" : "text-emerald-600"
                        )}>
                          <HeartPulse className="h-4 w-4" /> Up next
                        </div>
                        <h3 className={cn(
                          "text-lg font-semibold",
                          isNight ? "text-white" : "text-slate-900"
                        )}>
                          {currentTask.title}
                        </h3>
                        <div className={cn(
                          "flex flex-wrap items-center gap-2 text-sm",
                          isNight ? "text-slate-300" : "text-slate-600"
                        )}>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border text-xs",
                              CATEGORY_META[currentTask.category].chip
                            )}
                          >
                            {CATEGORY_META[currentTask.category].emoji}{" "}
                            {CATEGORY_META[currentTask.category].label}
                          </Badge>
                          <span>
                            {formatTime(currentTask.scheduledStart)} –{" "}
                            {formatTime(currentTask.scheduledEnd)}
                          </span>
                          <span>· {currentTask.estimateMinutes} min</span>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            size="sm"
                            className="bg-emerald-500 text-white hover:bg-emerald-400"
                            onClick={() =>
                              handleTaskStatusChange(currentTask.id, "in_progress")
                            }
                          >
                            I’m on it
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              handleTaskStatusChange(currentTask.id, "done")
                            }
                          >
                            Done early
                          </Button>
                        </div>
                      </div>
                    </div>
                    {catchUpIds.length ? (
                      <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5 shadow-lg shadow-amber-200/30">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                          <PauseCircle className="h-4 w-4" />
                          Check-in
                        </div>
                        <p className="mt-2 text-sm text-amber-700">
                          A few blocks slipped past their finish. How did they go?
                        </p>
                        <div className="mt-3 space-y-2">
                          {catchUpTasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-white/70 px-3 py-2 text-sm text-amber-800"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{task.title}</span>
                                <span className="text-xs">
                                  {formatTime(task.scheduledStart)} –{" "}
                                  {formatTime(task.scheduledEnd)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleTaskStatusChange(task.id, "done")
                                  }
                                >
                                  Mark done
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleTaskStatusChange(task.id, "skipped")
                                  }
                                >
                                  Skip
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-rose-600 hover:text-rose-700"
                                  onClick={() =>
                                    handleTaskStatusChange(task.id, "failed")
                                  }
                                >
                                  Failed
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            ) : null}

            {user && plan ? (
              <div
                className={cn(
                  "grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]",
                  timelineOnly && "lg:grid-cols-1"
                )}
              >
                {!timelineOnly ? (
                  <Card className={cn(
                    "border",
                    isNight
                      ? "border-white/15 bg-slate-900/60"
                      : "border-slate-200 bg-white/90 shadow-lg shadow-slate-200/50"
                  )}>
                    <CardHeader className="space-y-1">
                      <CardTitle className={cn(
                        "text-xl font-semibold",
                        isNight ? "text-white" : "text-slate-900"
                      )}>
                        Capture queue
                      </CardTitle>
                      <p className={cn(
                        "text-sm",
                        isNight ? "text-slate-300" : "text-slate-500"
                      )}>
                        Add today&apos;s anchors and essentials. Flow will weave them into a timeline.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <section className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                              Top priorities
                            </h3>
                            <p className="text-xs text-slate-500">
                              Choose the moves that will shift the needle.
                            </p>
                          </div>
                          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600">
                            {priorityCount}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="priority-title">Title</Label>
                          <Input
                            id="priority-title"
                            value={priorityDraft.title}
                            onChange={(event) =>
                              setPriorityDraft((prev) => ({
                                ...prev,
                                title: event.target.value,
                              }))
                            }
                            placeholder="Deep work block, design review, call prep…"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                              value={priorityDraft.category}
                              onValueChange={(value) =>
                                setPriorityDraft((prev) => ({
                                  ...prev,
                                  category: value as FlowCategory,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Pick a lane" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CATEGORY_META).map(([id, meta]) => (
                                  <SelectItem key={id} value={id}>
                                    <span className="flex items-center gap-2">
                                      <span>{meta.emoji}</span>
                                      {meta.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Duration (min)</Label>
                            <Input
                              type="number"
                              min={5}
                              value={priorityDraft.estimate}
                              onChange={(event) =>
                                setPriorityDraft((prev) => ({
                                  ...prev,
                                  estimate: Number(event.target.value),
                                }))
                              }
                            />
                            <div className="flex flex-wrap gap-1 pt-1">
                              {MINUTE_OPTIONS.map((option) => (
                                <Button
                                  key={`priority-minute-${option}`}
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-7 rounded-full border px-3 text-xs",
                                    priorityDraft.estimate === option
                                      ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                                      : "border-transparent text-slate-500 hover:border-slate-200"
                                  )}
                                  onClick={() =>
                                    setPriorityDraft((prev) => ({
                                      ...prev,
                                      estimate: option,
                                    }))
                                  }
                                >
                                  {option}m
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="priority-notes">Notes</Label>
                          <Textarea
                            id="priority-notes"
                            value={priorityDraft.notes}
                            onChange={(event) =>
                              setPriorityDraft((prev) => ({
                                ...prev,
                                notes: event.target.value,
                              }))
                            }
                            placeholder="Intent, deliverable, or checkpoints."
                            className="min-h-[80px]"
                          />
                        </div>
                        <Button
                          className="w-full bg-indigo-500 text-white hover:bg-indigo-400"
                          disabled={!priorityDraft.title.trim()}
                          onClick={() => {
                            addTask("priority", priorityDraft);
                            setPriorityDraft((prev) => ({
                              ...prev,
                              title: "",
                              notes: "",
                            }));
                          }}
                        >
                          <Flame className="mr-2 h-4 w-4" />
                          Add top priority
                        </Button>
                      </section>

                      <Separator />

                      <section className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                            Must-do chores
                          </h3>
                          <p className="text-xs text-slate-500">
                            Keep your home, family, and admin in rhythm.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chore-title">Title</Label>
                          <Input
                            id="chore-title"
                            value={choreDraft.title}
                            onChange={(event) =>
                              setChoreDraft((prev) => ({
                                ...prev,
                                title: event.target.value,
                              }))
                            }
                            placeholder="Laundry reset, grocery run, call the dentist…"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                              value={choreDraft.category}
                              onValueChange={(value) =>
                                setChoreDraft((prev) => ({
                                  ...prev,
                                  category: value as FlowCategory,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Pick a lane" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CATEGORY_META).map(([id, meta]) => (
                                  <SelectItem key={id} value={id}>
                                    <span className="flex items-center gap-2">
                                      <span>{meta.emoji}</span>
                                      {meta.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Duration (min)</Label>
                            <Input
                              type="number"
                              min={5}
                              value={choreDraft.estimate}
                              onChange={(event) =>
                                setChoreDraft((prev) => ({
                                  ...prev,
                                  estimate: Number(event.target.value),
                                }))
                              }
                            />
                          </div>
                        </div>
                        <Textarea
                          value={choreDraft.notes}
                          onChange={(event) =>
                            setChoreDraft((prev) => ({
                              ...prev,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Any context or reminders?"
                          className="min-h-[72px]"
                        />
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full",
                            isNight
                              ? "border-amber-400/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                              : "bg-amber-500 text-white hover:bg-amber-600 border-transparent"
                          )}
                          disabled={!choreDraft.title.trim()}
                          onClick={() => {
                            addTask("chore", choreDraft);
                            setChoreDraft((prev) => ({
                              ...prev,
                              title: "",
                              notes: "",
                            }));
                          }}
                        >
                          <CircleCheckBig className="mr-2 h-4 w-4" />
                          Add chore
                        </Button>
                      </section>

                      <Separator />

                      <section className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                            Flex & recharge
                          </h3>
                          <p className="text-xs text-slate-500">
                            Guard pauses, movement, or simple joys.
                          </p>
                        </div>
                        <Input
                          value={flexDraft.title}
                          onChange={(event) =>
                            setFlexDraft((prev) => ({
                              ...prev,
                              title: event.target.value,
                            }))
                          }
                          placeholder="Walk outside, stretch, coffee catch-up…"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                              value={flexDraft.category}
                              onValueChange={(value) =>
                                setFlexDraft((prev) => ({
                                  ...prev,
                                  category: value as FlowCategory,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Pick a lane" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CATEGORY_META).map(([id, meta]) => (
                                  <SelectItem key={id} value={id}>
                                    <span className="flex items-center gap-2">
                                      <span>{meta.emoji}</span>
                                      {meta.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Duration (min)</Label>
                            <Input
                              type="number"
                              min={5}
                              value={flexDraft.estimate}
                              onChange={(event) =>
                                setFlexDraft((prev) => ({
                                  ...prev,
                                  estimate: Number(event.target.value),
                                }))
                              }
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full border",
                            isNight
                              ? "border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                              : "bg-sky-500 text-white hover:bg-sky-600 border-transparent"
                          )}
                          disabled={!flexDraft.title.trim()}
                          onClick={() => {
                            addTask("flex", flexDraft);
                            setFlexDraft((prev) => ({
                              ...prev,
                              title: "",
                            }));
                          }}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Add a flex block
                        </Button>
                      </section>

                      <Separator />

                      <div className="space-y-4">
                        <div className={cn(
                          "rounded-3xl border p-4 text-sm",
                          isNight
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                        )}>
                          Flow will stack priorities first, weave chores next, and float flex blocks where space allows.
                          Tune the schedule anytime.
                        </div>
                        <Button
                          onClick={handleGenerateSchedule}
                          className="w-full bg-emerald-500 text-white hover:bg-emerald-400"
                          disabled={!plan.tasks.length}
                        >
                          <Wand2 className="mr-2 h-4 w-4" />
                          Auto-build timeline
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                <div className="space-y-6">
                  <Card className={cn(
                    "border shadow-xl",
                    isNight
                      ? "border-white/15 bg-slate-900/60 shadow-slate-900/50"
                      : "border-slate-200 bg-white/95 shadow-slate-200/50"
                  )}>
                    <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle className={cn(
                          "text-xl font-semibold",
                          isNight ? "text-white" : "text-slate-900"
                        )}>
                          Today&apos;s timeline
                        </CardTitle>
                        <p className={cn(
                          "text-sm",
                          isNight ? "text-slate-300" : "text-slate-500"
                        )}>
                          Drag the handles by nudging up/down. Mark progress inline.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                            Syncing…
                          </>
                        ) : (
                          <>
                            <CircleCheckBig className="h-4 w-4 text-emerald-500" />
                            Saved
                          </>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {tasksForDate.length === 0 ? (
                        <div className={cn(
                          "rounded-3xl border border-dashed py-12 text-center text-sm",
                          isNight
                            ? "border-white/15 bg-slate-800/40 text-slate-300"
                            : "border-slate-200 bg-slate-50/60 text-slate-500"
                        )}>
                          Add a few priorities or chores to build your flow.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {tasksForDate
                            .slice()
                            .sort((a, b) => a.sequence - b.sequence)
                            .map((task, index) => {
                              const meta = CATEGORY_META[task.category];
                              const isActive = currentTask?.id === task.id;
                              const isPast =
                                task.scheduledEnd &&
                                new Date(task.scheduledEnd).getTime() < now;
                              const getCategoryColor = (category: FlowCategory) => {
                                switch (category) {
                                  case "work":
                                    return { border: "border-indigo-400/30", bg: "bg-indigo-500/10", text: "text-indigo-200", textMuted: "text-indigo-200/80" };
                                  case "family":
                                    return { border: "border-rose-400/30", bg: "bg-rose-500/10", text: "text-rose-200", textMuted: "text-rose-200/80" };
                                  case "home":
                                    return { border: "border-amber-400/30", bg: "bg-amber-500/10", text: "text-amber-200", textMuted: "text-amber-200/80" };
                                  case "wellness":
                                    return { border: "border-emerald-400/30", bg: "bg-emerald-500/10", text: "text-emerald-200", textMuted: "text-emerald-200/80" };
                                  case "play":
                                    return { border: "border-sky-400/30", bg: "bg-sky-500/10", text: "text-sky-200", textMuted: "text-sky-200/80" };
                                  case "growth":
                                    return { border: "border-purple-400/30", bg: "bg-purple-500/10", text: "text-purple-200", textMuted: "text-purple-200/80" };
                                  default:
                                    return { border: "border-emerald-400/30", bg: "bg-emerald-500/10", text: "text-emerald-200", textMuted: "text-emerald-200/80" };
                                }
                              };

                              const categoryColors = getCategoryColor(task.category);
                              const statusColors = isNight
                                ? task.status === "skipped"
                                  ? { border: "border-amber-400/30", bg: "bg-amber-500/10", text: "text-amber-200", textMuted: "text-amber-200/80" }
                                  : task.status === "failed"
                                    ? { border: "border-rose-400/30", bg: "bg-rose-500/10", text: "text-rose-200", textMuted: "text-rose-200/80" }
                                    : categoryColors
                                : categoryColors;

                              return (
                                <div
                                  key={task.id}
                                  className={cn(
                                    "relative overflow-hidden rounded-3xl border px-4 py-4 transition",
                                    isNight
                                      ? `${statusColors.border} ${statusColors.bg} ${statusColors.text}`
                                      : "border-slate-200 bg-white",
                                    isActive && isNight
                                      ? "border-emerald-400/50 shadow-lg"
                                      : isActive
                                        ? "border-emerald-300 shadow-lg shadow-emerald-200/40"
                                        : "",
                                    task.status === "done" && !isNight
                                      ? "border-emerald-200 bg-emerald-50/60"
                                      : "",
                                    task.status === "skipped" && !isNight
                                      ? "border-amber-200 bg-amber-50/60"
                                      : "",
                                    task.status === "failed" && !isNight
                                      ? "border-rose-300 bg-rose-50/70"
                                      : ""
                                  )}
                                >
                                  {!isNight && (
                                    <div
                                      className={cn(
                                        "absolute inset-0 opacity-25",
                                        meta.accent
                                      )}
                                    />
                                  )}
                                  <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge
                                          variant="secondary"
                                          className={cn(
                                            "text-xs uppercase",
                                            isNight
                                              ? task.category === "work"
                                                ? "bg-indigo-500/30 text-indigo-200 border-indigo-400/40"
                                                : task.category === "family"
                                                  ? "bg-rose-500/30 text-rose-200 border-rose-400/40"
                                                  : task.category === "home"
                                                    ? "bg-amber-500/30 text-amber-200 border-amber-400/40"
                                                    : task.category === "wellness"
                                                      ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/40"
                                                      : task.category === "play"
                                                        ? "bg-sky-500/30 text-sky-200 border-sky-400/40"
                                                        : "bg-purple-500/30 text-purple-200 border-purple-400/40"
                                              : meta.chip
                                          )}
                                        >
                                          {meta.emoji} {meta.label}
                                        </Badge>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-xs",
                                            isNight
                                              ? "border-white/20 bg-white/5 text-slate-200"
                                              : ""
                                          )}
                                        >
                                          {TASK_TYPE_LABEL[task.type]}
                                        </Badge>
                                      </div>
                                      <h3 className={cn(
                                        "text-base font-semibold",
                                        isNight ? statusColors.text : "text-slate-900"
                                      )}>
                                        {task.title}
                                      </h3>
                                      <p className={cn(
                                        "text-sm font-medium",
                                        isNight ? statusColors.text : "text-slate-600"
                                      )}>
                                        {formatTime(task.scheduledStart)} –{" "}
                                        {formatTime(task.scheduledEnd)} ·{" "}
                                        {task.estimateMinutes} min
                                      </p>
                                      {task.notes ? (
                                        <p className={cn(
                                          "text-xs",
                                          isNight ? statusColors.textMuted : "text-slate-500"
                                        )}>
                                          {task.notes}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="flex items-center gap-1">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => handleMoveTask(task.id, "up")}
                                          disabled={index === 0}
                                        >
                                          ↑
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => handleMoveTask(task.id, "down")}
                                          disabled={index === tasksForDate.length - 1}
                                        >
                                          ↓
                                        </Button>
                                      </div>
                                      <TooltipProvider>
                                        <div className="flex items-center gap-2">
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className={cn(
                                                  "h-8 w-8 rounded-full border",
                                                  isNight
                                                    ? "border-slate-500 bg-white/10 text-slate-200 hover:bg-white/20"
                                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                )}
                                                onClick={() => {
                                                  setEditingTask(task);
                                                  setEditStartTime(
                                                    toTimeInputValue(task.scheduledStart) || startTime
                                                  );
                                                  setEditDuration(task.estimateMinutes);
                                                }}
                                              >
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">Edit</span>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-blue-600 text-white">Edit</TooltipContent>
                                          </Tooltip>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className={cn(
                                                  "h-8 w-8 rounded-full border transition-colors",
                                                  task.status === "done"
                                                    ? isNight
                                                      ? "border-emerald-500 bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                                                      : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                                                    : isNight
                                                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                                                      : "border-emerald-600 bg-white text-emerald-600 hover:bg-emerald-50"
                                                )}
                                                onClick={() =>
                                                  handleTaskStatusChange(
                                                    task.id,
                                                    task.status === "done" ? "pending" : "done"
                                                  )
                                                }
                                              >
                                                <Check className="h-4 w-4" />
                                                <span className="sr-only">
                                                  {task.status === "done" ? "Mark undone" : "Mark done"}
                                                </span>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-blue-600 text-white">
                                              {task.status === "done" ? "Mark undone" : "Mark done"}
                                            </TooltipContent>
                                          </Tooltip>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className={cn(
                                                  "h-8 w-8 rounded-full border transition-colors",
                                                  task.status === "skipped"
                                                    ? isNight
                                                      ? "border-sky-500 bg-sky-500 text-slate-900 hover:bg-sky-400"
                                                      : "border-sky-500 bg-sky-500 text-white hover:bg-sky-600"
                                                    : isNight
                                                      ? "border-sky-500 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
                                                      : "border-sky-300 bg-white text-sky-600 hover:bg-sky-50"
                                                )}
                                                onClick={() =>
                                                  handleTaskStatusChange(
                                                    task.id,
                                                    task.status === "skipped" ? "pending" : "skipped"
                                                  )
                                                }
                                              >
                                                <FastForward className="h-4 w-4" />
                                                <span className="sr-only">
                                                  {task.status === "skipped" ? "Reset skip" : "Skip"}
                                                </span>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-blue-600 text-white">
                                              {task.status === "skipped" ? "Reset skip" : "Skip"}
                                            </TooltipContent>
                                          </Tooltip>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className={cn(
                                                  "h-8 w-8 rounded-full border transition-colors",
                                                  task.status === "failed"
                                                    ? isNight
                                                      ? "border-rose-500 bg-rose-500 text-slate-900 hover:bg-rose-400"
                                                      : "border-rose-600 bg-rose-600 text-white hover:bg-rose-700"
                                                    : isNight
                                                      ? "border-rose-500 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                                                      : "border-rose-600 bg-white text-rose-600 hover:bg-rose-50"
                                                )}
                                                onClick={() =>
                                                  handleTaskStatusChange(
                                                    task.id,
                                                    task.status === "failed" ? "pending" : "failed"
                                                  )
                                                }
                                              >
                                                <X className="h-4 w-4" />
                                                <span className="sr-only">
                                                  {task.status === "failed" ? "Reset failed" : "Mark failed"}
                                                </span>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-blue-600 text-white">
                                              {task.status === "failed" ? "Reset failed" : "Mark failed"}
                                            </TooltipContent>
                                          </Tooltip>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className={cn(
                                                  "h-8 w-8 rounded-full border",
                                                  isNight
                                                    ? "border-slate-500 bg-white/10 text-slate-300 hover:bg-rose-500/30 hover:text-rose-300"
                                                    : "border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                                                )}
                                                onClick={() => handleRemoveTask(task.id)}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Remove</span>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-blue-600 text-white">Remove</TooltipContent>
                                          </Tooltip>
                                        </div>
                                      </TooltipProvider>
                                    </div>
                                  </div>
                                  {isActive ? (
                                    <div className={cn(
                                      "absolute -left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-4 shadow-lg",
                                      isNight
                                        ? "border-slate-800 bg-emerald-400"
                                        : "border-white bg-emerald-400"
                                    )} />
                                  ) : null}
                                  {!isActive && isPast && task.status === "pending" ? (
                                    <div className={cn(
                                      "absolute -left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-4 shadow-lg",
                                      isNight
                                        ? "border-slate-800 bg-amber-400"
                                        : "border-white bg-amber-400"
                                    )} />
                                  ) : null}
                                  {task.status === "failed" ? (
                                    <div className={cn(
                                      "absolute -left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-4 shadow-lg",
                                      isNight
                                        ? "border-slate-800 bg-rose-500"
                                        : "border-white bg-rose-500"
                                    )} />
                                  ) : null}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {!timelineOnly ? (
                    <Card className={cn(
                      "border shadow-lg",
                      isNight
                        ? "border-white/15 bg-slate-900/60 shadow-slate-900/50"
                        : "border-slate-200 bg-white/95 shadow-slate-200/50"
                    )}>
                      <CardHeader>
                        <CardTitle className={cn(
                          "text-lg font-semibold",
                          isNight ? "text-white" : "text-slate-900"
                        )}>
                          Reflection log
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className={cn(
                          "space-y-4 rounded-2xl border p-4",
                          isNight
                            ? "border-white/20 bg-slate-800/60"
                            : "border-slate-200 bg-slate-50/60"
                        )}>
                          <div className="space-y-1">
                            <p className={cn(
                              "text-sm font-semibold",
                              isNight ? "text-white" : "text-slate-900"
                            )}>
                              How are you feeling right now?
                            </p>
                            <p className={cn(
                              "text-xs",
                              isNight ? "text-slate-300" : "text-slate-500"
                            )}>
                              Pick an emoji, jot a sentence or two, and keep your day&apos;s story in one place.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {FLOW_MOOD_OPTIONS.map((option) => {
                              const active = reflectionMoodId === option.id;
                              return (
                                <Button
                                  key={option.id}
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  aria-pressed={active}
                                  className={cn(
                                    "flex items-center gap-1 rounded-full border px-3 text-sm transition",
                                    active
                                      ? isNight
                                        ? "border-sky-400 bg-sky-500/30 text-sky-200 shadow-sm"
                                        : "border-sky-400 bg-sky-50 text-sky-700 shadow-sm"
                                      : isNight
                                        ? "border-white/20 bg-white/10 text-slate-300 hover:border-white/30 hover:bg-white/15"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                  )}
                                  onClick={() =>
                                    setReflectionMoodId((prev) =>
                                      prev === option.id ? null : option.id
                                    )
                                  }
                                >
                                  <span className="text-lg leading-none">{option.emoji}</span>
                                  {option.label}
                                </Button>
                              );
                            })}
                          </div>
                          <Textarea
                            value={reflectionNote}
                            onChange={(event) => setReflectionNote(event.target.value)}
                            placeholder="Free-write a quick thought, mood, or story beat…"
                            rows={4}
                            className={cn(
                              isNight
                                ? "border-white/30 bg-slate-900/50 text-white placeholder:text-white/40"
                                : ""
                            )}
                          />
                          <div className="flex flex-wrap items-center gap-3">
                            <p className={cn(
                              "text-xs",
                              isNight ? "text-slate-300" : "text-slate-500"
                            )}>
                              Reflections appear here and in Journal so you can spot patterns.
                            </p>
                            <Button
                              type="button"
                              className={cn(
                                "ml-auto",
                                isNight
                                  ? "bg-emerald-500/90 text-slate-900 hover:bg-emerald-400 border-transparent"
                                  : "bg-emerald-500 text-white hover:bg-emerald-400"
                              )}
                              onClick={handleAddReflection}
                              disabled={reflectionSaving || !reflectionNote.trim()}
                            >
                              {reflectionSaving ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Saving…
                                </>
                              ) : (
                                <>
                                  <Sparkles className="mr-2 h-4 w-4" />
                                  Log feeling
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        <Separator />
                        {plan.reflections.length ? (
                          <div className="space-y-3">
                            {plan.reflections
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(b.createdAt).getTime() -
                                  new Date(a.createdAt).getTime()
                              )
                              .map((reflection) => {
                                const task = plan.tasks.find(
                                  (candidate) => candidate.id === reflection.taskId
                                );
                                return (
                                  <div
                                    key={reflection.id}
                                    className={cn(
                                      "rounded-2xl border px-4 py-3 text-sm",
                                      isNight
                                        ? "border-white/20 bg-slate-800/60 text-slate-300"
                                        : "border-slate-200 bg-white/80 text-slate-600"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex flex-1 items-start gap-2">
                                        {reflection.mood ? (
                                          <span className="text-xl leading-none">{reflection.mood}</span>
                                        ) : null}
                                        <div className="space-y-1">
                                          <p className={cn(
                                            "font-semibold",
                                            isNight ? "text-white" : "text-slate-900"
                                          )}>
                                            {task?.title ?? reflection.moodLabel ?? "Daily note"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className={cn(
                                        "text-xs",
                                        isNight ? "text-slate-400" : "text-slate-400"
                                      )}>
                                        {new Date(reflection.createdAt).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </div>
                                    </div>
                                    <p className={cn(
                                      "mt-2 whitespace-pre-line",
                                      isNight ? "text-slate-300" : "text-slate-700"
                                    )}>
                                      {reflection.note}
                                    </p>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className={cn(
                            "rounded-3xl border border-dashed py-10 text-center text-sm",
                            isNight
                              ? "border-white/15 bg-slate-800/40 text-slate-300"
                              : "border-slate-200 bg-slate-50/60 text-slate-500"
                          )}>
                            Track how each block went, capture wins, moods, and tweaks for tomorrow.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      {settings && (
        <FlowWizard
          open={wizardOpen}
          settings={settings}
          userProfile={userProfile}
          onClose={() => setWizardOpen(false)}
          onSave={(updated) => {
            setSettings(updated);
            setSettingsApplied(false);
            setWizardOpen(false);
            void saveFlowSettings(user!.uid, updated);
          }}
          isNight={isNight}
        />
      )}
      <Dialog
        open={Boolean(editingTask)}
        onOpenChange={(value) => {
          if (!value) {
            setEditingTask(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit block</DialogTitle>
            <DialogDescription>
              Adjust the start time and duration. Flow keeps the rest of your timeline in sync.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start">Start time</Label>
              <Input
                id="edit-start"
                type="time"
                value={editStartTime}
                onChange={(event) => setEditStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-duration">Duration (minutes)</Label>
              <Input
                id="edit-duration"
                type="number"
                min={5}
                value={editDuration}
                onChange={(event) => setEditDuration(Number(event.target.value))}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTaskEdits}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
