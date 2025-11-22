"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppTopBar } from "@/components/AppTopBar";
import { AppUserMenu, AppUserMenuSection } from "@/components/AppUserMenu";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  createJournalDocument,
  ensureMemberOnJournal,
  fetchJournalDocument,
  saveJournalEntry,
  listJournalEntrySummaries,
  fetchJournalEntryById,
  findJournalForMember,
  fetchJournalEntryByDate,
} from "@/lib/journalService";
import { auth, onAuthStateChanged, signOut } from "@/lib/firebase";
import { generateId } from "@/lib/id";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/firebase";
import type {
  JournalAnswers,
  JournalEntry,
  JournalMember,
  JournalEntrySummary,
} from "@/types/journal";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToodlTheme } from "@/hooks/useToodlTheme";

type JournalQuestion = {
  id: keyof JournalAnswers;
  label: string;
  placeholder?: string;
  helper?: string;
  type?: "textarea" | "input";
  inputType?: string;
  required?: boolean;
  rows?: number;
};

type JournalStep = {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  questions: JournalQuestion[];
};
type EntryMode = "daily" | "blog";

const DAILY_STEPS: JournalStep[] = [
  {
    id: "scene",
    title: "Set the Scene",
    subtitle:
      "Ground yourself in the day before you jump into the details. Capture the vibe like it's the first page of a fresh notebook.",
    accent:
      "from-rose-200 via-fuchsia-200 to-sky-200 text-fuchsia-900 border-pink-300",
    questions: [
      {
        id: "entryDate",
        label: "What day are we capturing?",
        placeholder: "Select today or the day you're reflecting on",
        type: "input",
        inputType: "date",
        required: true,
      },
      {
        id: "dayVibe",
        label: "Describe the vibe of the day in a few words.",
        placeholder:
          "Soft sunrise, slow coffee, creative energy... paint the vibe.",
        helper: "Think colors, textures, music — whatever brings the day back.",
        type: "textarea",
      },
      {
        id: "goldenMoment",
        label: "What was your golden moment?",
        placeholder: "The one moment you'll want to remember later.",
        type: "textarea",
      },
    ],
  },
  {
    id: "anchors",
    title: "Anchors & Wins",
    subtitle:
      "Reach for the moments that defined work and home without flipping four pages.",
    accent:
      "from-amber-200 via-orange-200 to-rose-200 text-amber-900 border-amber-300",
    questions: [
      {
        id: "workStory",
        label: "What stood out at work?",
        placeholder: "A thread you pulled, a meeting, a shift in energy...",
        type: "textarea",
      },
      {
        id: "familyStory",
        label: "How did the rest of the day unfold?",
        placeholder: "Moments with family, a walk, a conversation worth saving...",
        type: "textarea",
      },
      {
        id: "learningNote",
        label: "Name one lesson or spark to carry forward.",
        placeholder: "That aha, reminder, or pattern you spotted.",
        type: "textarea",
      },
    ],
  },
  {
    id: "feel",
    title: "Feelings & Gratitude",
    subtitle:
      "Close the loop with how it felt and who/what deserves a thank-you.",
    accent:
      "from-lime-200 via-yellow-200 to-rose-200 text-lime-900 border-lime-300",
    questions: [
      {
        id: "workFeeling",
        label: "How do you feel wrapping today?",
        placeholder: "Proud, stretched, calm, ready for rest...",
        type: "textarea",
        rows: 4,
      },
      {
        id: "gratitude",
        label: "Who or what are you grateful for?",
        placeholder: "Name the person, moment, or simple joy that stuck.",
        type: "textarea",
      },
      {
        id: "other",
        label: "Anything else you want to remember?",
        helper: "A wild idea, a vent session, a secret goal — your call.",
        placeholder: "Let it flow. No rules, no editing.",
        type: "textarea",
        rows: 4,
      },
    ],
  },
];

const BLOG_STEPS: JournalStep[] = [
  {
    id: "basics",
    title: "Blog basics",
    subtitle: "Pick a title and a short summary so sharing it is effortless.",
    accent:
      "from-sky-200 via-indigo-200 to-purple-200 text-indigo-900 border-indigo-300",
    questions: [
      {
        id: "blogTitle",
        label: "Post title",
        placeholder: "Give the piece a punchy headline",
        type: "input",
        required: true,
      },
      {
        id: "blogSummary",
        label: "Optional summary",
        placeholder: "One or two sentences on what readers will learn.",
        type: "textarea",
        rows: 3,
      },
    ],
  },
  {
    id: "draft",
    title: "Draft the post",
    subtitle: "Capture the body and optional tags before you share.",
    accent:
      "from-emerald-200 via-teal-200 to-cyan-200 text-emerald-900 border-emerald-300",
    questions: [
      {
        id: "blogBody",
        label: "Body",
        placeholder: "Write the story, unfiltered.",
        type: "textarea",
        rows: 10,
        required: true,
      },
      {
        id: "blogTags",
        label: "Tags (comma separated)",
        placeholder: "work, ai, product",
        type: "input",
      },
    ],
  },
];

const ENTRY_MODE_OPTIONS: Record<
  EntryMode,
  { title: string; description: string; badge: string }
> = {
  daily: {
    title: "Daily journal",
    description: "Guided prompts to capture the day in a handful of beats.",
    badge: "Daily",
  },
  blog: {
    title: "Blog post",
    description: "Long-form draft with title, summary, and tags for sharing.",
    badge: "Blog",
  },
};

const JOURNAL_STORAGE_KEY = "toodl:journalId";

const moodPalette = [
  { label: "Electric", value: "electric" },
  { label: "Soft", value: "soft" },
  { label: "Grateful", value: "grateful" },
  { label: "Stretched", value: "stretched" },
  { label: "Playful", value: "playful" },
  { label: "Grounded", value: "grounded" },
];

const initialAnswers: JournalAnswers = {
  entryDate: "",
  dayVibe: "",
  goldenMoment: "",
  workStory: "",
  workFeeling: "",
  learningNote: "",
  forwardIntent: "",
  familyStory: "",
  familyFeeling: "",
  gratitude: "",
  other: "",
  blogTitle: "",
  blogSummary: "",
  blogBody: "",
  blogTags: "",
};

const isClient = () => typeof window !== "undefined";

const formatMonthGroupLabel = (dateValue: string | null, fallbackValue: string) => {
  const target = dateValue || fallbackValue;
  if (!target) {
    return "Undated entries";
  }
  const date = new Date(target);
  if (Number.isNaN(date.getTime())) {
    return "Undated entries";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
};

const formatDisplayDate = (value: string) => {
  if (!value) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatTimestamp = (value: string) => {
  if (!value) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const JournalExperience = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const lastUrlIdRef = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [member, setMember] = useState<JournalMember | null>(null);
  const [journalId, setJournalId] = useState<string | null>(null);
  const [invalidJournal, setInvalidJournal] = useState(false);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  const [entryMode, setEntryMode] = useState<EntryMode>("daily");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [answers, setAnswers] = useState<JournalAnswers>(() => ({
    ...initialAnswers,
    entryDate: new Date().toISOString().slice(0, 10),
  }));
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryEntries, setLibraryEntries] = useState<JournalEntrySummary[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);

  const initialTheme = useMemo(
    () => (new Date().getHours() < 17 ? "morning" : "night"),
    []
  );
  const { theme, setTheme, isNight } = useToodlTheme(initialTheme);

  const groupedLibraryEntries = useMemo(() => {
    if (!libraryEntries.length) {
      return [] as Array<{ label: string; entries: JournalEntrySummary[] }>;
    }
    const groups = new Map<
      string,
      { label: string; entries: JournalEntrySummary[] }
    >();
    for (const entry of libraryEntries) {
      const keySource = entry.entryDate || entry.createdAt;
      const date = keySource ? new Date(keySource) : null;
      const key =
        date && !Number.isNaN(date.getTime())
          ? `${date.getFullYear()}-${date.getMonth()}`
          : `undated-${entry.id}`;
      const label = formatMonthGroupLabel(entry.entryDate, entry.createdAt);
      const bucket = groups.get(key);
      if (!bucket) {
        groups.set(key, { label, entries: [entry] });
      } else {
        bucket.entries.push(entry);
      }
    }
    return Array.from(groups.values()).map((group) => ({
      label: group.label,
      entries: group.entries.sort((a, b) =>
        (b.entryDate || b.createdAt).localeCompare(a.entryDate || a.createdAt)
      ),
    }));
  }, [libraryEntries]);

  const currentSteps = entryMode === "daily" ? DAILY_STEPS : BLOG_STEPS;
  const totalSteps = currentSteps.length;
  const isSummaryStep = currentStep === totalSteps;
  const activeStep = isSummaryStep ? null : currentSteps[currentStep];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authChecked) {
      return;
    }
    if (!user) {
      setMember(null);
      setJournalId(null);
      setLoadingJournal(false);
      return;
    }
    setMember({
      id: user.uid,
      name: user.displayName ?? "Signed Writer",
      email: user.email ?? null,
    });
  }, [authChecked, user]);

  useEffect(() => {
    const paramId = searchParams.get("journal_id");
    if (paramId && paramId !== journalId) {
      setJournalId(paramId);
      lastUrlIdRef.current = paramId;
    }
  }, [journalId, searchParams]);

  useEffect(() => {
    if (journalId || !isClient()) {
      return;
    }
    const storedId = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (storedId) {
      setJournalId(storedId);
      lastUrlIdRef.current = storedId;
    }
  }, [journalId]);

  useEffect(() => {
    if (!isClient()) {
      return;
    }
    if (journalId) {
      window.localStorage.setItem(JOURNAL_STORAGE_KEY, journalId);
    }
  }, [journalId]);

  const persistJournalToUrl = useCallback(
    (id: string) => {
      if (!id) {
        return;
      }
      if (lastUrlIdRef.current === id) {
        return;
      }
      lastUrlIdRef.current = id;
      const params = new URLSearchParams(searchParamsString);
      params.set("journal_id", id);
      router.replace(`/journal?${params.toString()}`);
    },
    [router, searchParamsString]
  );

  useEffect(() => {
    if (!member?.id || journalId) {
      if (!journalId) {
        setLoadingJournal(false);
      }
      return;
    }
    let active = true;
    setLoadingJournal(true);
    const locate = async () => {
      try {
        const doc = await findJournalForMember(member.id);
        if (!active) {
          return;
        }
        if (doc) {
          setJournalId(doc.id);
          persistJournalToUrl(doc.id);
        }
      } catch (error) {
        console.error("Failed to locate journal:", error);
      } finally {
        if (active) {
          setLoadingJournal(false);
        }
      }
    };
    void locate();
    return () => {
      active = false;
    };
  }, [journalId, member?.id, persistJournalToUrl]);

  useEffect(() => {
    if (!member || !journalId) {
      return;
    }
    let active = true;
    setLoadingJournal(true);
    setInvalidJournal(false);

    const hydrate = async () => {
      try {
        const doc = await fetchJournalDocument(journalId);
        if (!active) {
          return;
        }
        if (!doc) {
          setInvalidJournal(true);
          return;
        }
        await ensureMemberOnJournal(journalId, member);
        if (!active) {
          return;
        }
        persistJournalToUrl(journalId);
      } catch (error) {
        console.error("Failed to load journal:", error);
        if (active) {
          setInvalidJournal(true);
        }
      } finally {
        if (active) {
          setLoadingJournal(false);
        }
      }
    };

    void hydrate();

    return () => {
      active = false;
    };
  }, [journalId, member, persistJournalToUrl]);

  useEffect(() => {
    if (copyStatus === "idle") {
      return;
    }
    const timeout = setTimeout(() => setCopyStatus("idle"), 2000);
    return () => clearTimeout(timeout);
  }, [copyStatus]);

  const shareUrl = useMemo(() => {
    if (!journalId) {
      return "";
    }
    if (!isClient()) {
      return `/journal?journal_id=${journalId}`;
    }
    return `${window.location.origin}/journal?journal_id=${journalId}`;
  }, [journalId]);

  const journalStatus = savingEntry
    ? "Saving..."
    : hasUnsavedChanges
    ? "Draft in progress"
    : lastSavedAt
    ? `Last saved ${formatTimestamp(lastSavedAt)}`
    : "Ready to capture";

  const displayName = member?.name ?? user?.displayName ?? "Writer";

  useEffect(() => {
    setCopyStatus("idle");
  }, [shareUrl]);

  useEffect(() => {
    setCurrentStep(0);
  }, [entryMode]);

  const progressValue = useMemo(() => {
    if (isSummaryStep) {
      return 100;
    }
    return Math.round((currentStep / totalSteps) * 100);
  }, [currentStep, isSummaryStep, totalSteps]);

  const allowNext = useMemo(() => {
    if (isSummaryStep || !activeStep) {
      return false;
    }
    return activeStep.questions.every((question) => {
      if (!question.required) {
        return true;
      }
      const value = answers[question.id];
      return Boolean(value && value.trim().length > 0);
    });
  }, [activeStep, answers, isSummaryStep]);

  const journalPreview = useMemo(() => {
    const sections: { heading: string; body: string[] }[] = [];

    if (entryMode === "blog") {
      const title = answers.blogTitle?.trim();
      const summary = answers.blogSummary?.trim();
      const body = answers.blogBody?.trim();
      const tags = answers.blogTags?.trim();

      const blogBody: string[] = [];
      if (summary) {
        blogBody.push(summary);
      }
      if (body) {
        blogBody.push(body);
      }
      sections.push({
        heading: title && title.length ? title : "Untitled blog entry",
        body: blogBody.length ? blogBody : ["Start drafting your post."],
      });
      if (tags) {
        sections.push({
          heading: "Tags",
          body: [tags],
        });
      }
      return sections;
    }

    const sceneBody: string[] = [];
    if (answers.dayVibe) {
      sceneBody.push(`The day floated in feeling ${answers.dayVibe.trim()}.`);
    }
    if (selectedMood) {
      sceneBody.push(`Mood palette: ${selectedMood.toUpperCase()}.`);
    }
    if (answers.goldenMoment) {
      sceneBody.push(`Golden moment: ${answers.goldenMoment.trim()}.`);
    }
    if (sceneBody.length) {
      sections.push({ heading: "Scene Setting", body: sceneBody });
    }

    const anchorsBody: string[] = [];
    if (answers.workStory) {
      anchorsBody.push(answers.workStory.trim());
    }
    if (answers.familyStory) {
      anchorsBody.push(answers.familyStory.trim());
    }
    if (answers.learningNote) {
      anchorsBody.push(`Lesson to keep: ${answers.learningNote.trim()}.`);
    }
    if (anchorsBody.length) {
      sections.push({ heading: "Anchors & Wins", body: anchorsBody });
    }

    const feelingsBody: string[] = [];
    if (answers.workFeeling) {
      feelingsBody.push(`Feeling: ${answers.workFeeling.trim()}.`);
    }
    if (answers.gratitude) {
      feelingsBody.push(`Grateful for ${answers.gratitude.trim()}.`);
    }
    if (answers.other) {
      feelingsBody.push(answers.other.trim());
    }
    if (feelingsBody.length) {
      sections.push({ heading: "Feelings & Gratitude", body: feelingsBody });
    }

    return sections;
  }, [answers, entryMode, selectedMood]);

  const markDirty = useCallback(() => {
    setHasUnsavedChanges(true);
    setLastSavedAt(null);
    setSaveError(null);
  }, []);

  const updateAnswer = useCallback(
    (questionId: keyof JournalAnswers, value: string) => {
      let changed = false;
      setAnswers((prev) => {
        if (prev[questionId] === value) {
          return prev;
        }
        changed = true;
        return { ...prev, [questionId]: value };
      });
      if (changed) {
        markDirty();
      }
    },
    [markDirty]
  );

  const handleNext = () => {
    if (isSummaryStep) {
      return;
    }
    if (currentStep === totalSteps - 1) {
      setCurrentStep(totalSteps);
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    if (isSummaryStep) {
      setCurrentStep(totalSteps - 1);
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 0));
    }
  };

  const handleReset = useCallback(() => {
    setAnswers({
      ...initialAnswers,
      entryDate: new Date().toISOString().slice(0, 10),
    });
    setSelectedMood(null);
    setCurrentStep(0);
    setHasUnsavedChanges(true);
    setLastSavedAt(null);
    setSaveError(null);
  }, []);

  const handleSelectMood = (moodValue: string) => {
    setSelectedMood((prev) => {
      const next = prev === moodValue ? null : moodValue;
      if (prev !== next) {
        markDirty();
      }
      return next;
    });
  };

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) {
      return;
    }
    if (!isClient() || !navigator.clipboard) {
      setCopyStatus("failed");
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy journal link:", error);
      setCopyStatus("failed");
    }
  }, [shareUrl]);

  const handleStartFresh = useCallback(() => {
    lastUrlIdRef.current = null;
    setJournalId(null);
    setInvalidJournal(false);
    router.replace("/journal");
    if (isClient()) {
      window.localStorage.removeItem(JOURNAL_STORAGE_KEY);
    }
    handleReset();
  }, [handleReset, router]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  }, [router]);

  const journalMenuSections: AppUserMenuSection[] = useMemo(
    () => [
      {
        title: "Journal tools",
        items: [
          {
            label: "Copy journal link",
            onClick: () => {
              void handleCopyLink();
            },
            disabled: !shareUrl,
          },
          {
            label: "Browse entries",
            onClick: () => setLibraryOpen(true),
            disabled: !journalId,
          },
          {
            label: "Start new entry",
            onClick: handleStartFresh,
          },
        ],
      },
    ],
    [handleCopyLink, handleStartFresh, journalId, shareUrl]
  );

  const loadLibraryEntries = useCallback(
    async (targetId?: string) => {
      const sourceId = targetId ?? journalId;
      if (!sourceId) {
        return;
      }
      setLibraryLoading(true);
      try {
        const summaries = await listJournalEntrySummaries(sourceId);
        setLibraryEntries(summaries);
        setLibraryError(null);
      } catch (error) {
        console.error("Failed to load journal entries:", error);
        setLibraryError("We couldn't load previous entries right now.");
      } finally {
        setLibraryLoading(false);
      }
    },
    [journalId]
  );

  useEffect(() => {
    if (libraryOpen) {
      void loadLibraryEntries();
    }
  }, [libraryOpen, loadLibraryEntries]);

  const handleSelectEntry = useCallback(
    async (entryId: string) => {
      if (!journalId) {
        return;
      }
      setEntryLoading(true);
      try {
        const entry = await fetchJournalEntryById(journalId, entryId);
        if (!entry) {
          throw new Error("Entry not found");
        }
        setAnswers({ ...entry.answers });
        setEntryMode(entry.entryType ?? "daily");
        setSelectedMood(entry.mood ?? null);
        setLastSavedAt(entry.updatedAt);
        setHasUnsavedChanges(false);
        setCurrentStep(0);
        setLibraryOpen(false);
      } catch (error) {
        console.error("Failed to load journal entry:", error);
        setLibraryError("We couldn't open that entry. Please try another one.");
      } finally {
        setEntryLoading(false);
      }
    },
    [journalId]
  );

  const handleSaveEntry = async () => {
    if (!member) {
      return;
    }
    const nowIso = new Date().toISOString();
    const normalizedAnswers = Object.entries(answers).reduce(
      (acc, [key, value]) => {
        acc[key as keyof JournalAnswers] = value.trim();
        return acc;
      },
      {} as JournalAnswers
    );
    let targetJournalId = journalId;
    setSavingEntry(true);
    setSaveError(null);
    try {
      if (!targetJournalId) {
        const newJournalId = await createJournalDocument(member);
        targetJournalId = newJournalId;
        setJournalId(newJournalId);
        persistJournalToUrl(newJournalId);
      }
      let existingEntry: JournalEntry | null = null;
      if (targetJournalId && normalizedAnswers.entryDate) {
        existingEntry = await fetchJournalEntryByDate(
          targetJournalId,
          normalizedAnswers.entryDate
        );
      }
      const ensuredJournalId = targetJournalId as string;
      const entry: JournalEntry = {
        id: existingEntry?.id ?? generateId(),
        journalId: ensuredJournalId,
        memberId: member.id,
        entryDate: normalizedAnswers.entryDate || null,
        mood: entryMode === "daily" ? selectedMood : null,
        answers: normalizedAnswers,
        createdAt: existingEntry?.createdAt ?? nowIso,
        updatedAt: nowIso,
        entryType: entryMode,
      };
      await saveJournalEntry(ensuredJournalId, entry);
      setLastSavedAt(nowIso);
      setHasUnsavedChanges(false);
      void loadLibraryEntries(ensuredJournalId);
    } catch (error) {
      console.error("Failed to save journal entry:", error);
      setSaveError("We couldn't save your entry. Please try again in a moment.");
    } finally {
      setSavingEntry(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-100 via-amber-50 to-sky-100">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_65%)] opacity-40" />
        <Spinner />
      </div>
    );
  }

  if (authChecked && !user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-100 via-amber-50 to-sky-100 px-4 py-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_65%)] opacity-40" />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-8">
          <AppTopBar
            product="journal"
            subheading="Sign in to unlock Story or hop to another Toodl app."
            dark={isNight}
            theme={theme}
            onThemeChange={setTheme}
            actions={
              <Button
                className="bg-primary text-white hover:bg-payoutHover"
                onClick={() => router.push("/split")}
              >
                Sign in
              </Button>
            }
            userSlot={
              <AppUserMenu
                product="journal"
                displayName="Guest"
                identityLabel="Browsing as"
              />
            }
          />
          <div className="flex min-h-[40vh] items-center justify-center">
            <Card className="max-w-md space-y-6 border-none bg-white/80 p-8 text-center shadow-2xl shadow-rose-200/40 backdrop-blur-xl">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Sign-in required
              </h1>
              <p className="text-sm leading-relaxed text-slate-600">
                Toodl Story is private to your account. Please sign in to
                continue, then come back to capture your stories.
              </p>
              <Button
                className="w-full bg-primary text-white hover:bg-payoutHover"
                onClick={() => router.push("/split")}
              >
                Go to sign-in
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (invalidJournal) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-100 via-amber-50 to-sky-100 px-4 py-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_65%)] opacity-40" />
        <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center">
          <Card className="w-full border-none bg-white/85 p-10 text-center shadow-2xl shadow-rose-200/50 backdrop-blur-xl">
            <h2 className="font-serif text-3xl font-semibold text-slate-900">
              We couldn&apos;t open that journal.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              The share link might be mistyped or no longer available. Want to
              spin up a fresh notebook?
            </p>
            <div className="mt-8 flex justify-center">
              <Button
                onClick={handleStartFresh}
                className="bg-rose-500 px-6 py-2 text-base font-semibold text-white shadow-lg shadow-rose-400/40 transition hover:bg-rose-400"
              >
                Start a new journal
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (loadingJournal || !member) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-100 via-amber-50 to-sky-100">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_65%)] opacity-40" />
        <Spinner />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-100 via-amber-50 to-sky-100 px-4 py-16">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_65%)] opacity-40" />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-10">
        <AppTopBar
          product="journal"
          heading="Story"
          subheading="Capture the story behind the numbers, one guided reflection at a time."
          dark={isNight}
          theme={theme}
          onThemeChange={setTheme}
          actions={
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  disabled={!shareUrl}
                  className="border-slate-300"
                >
                  Copy journal link
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setLibraryOpen(true)}
                  disabled={!journalId}
                >
                  Browse past entries
                </Button>
              </div>
              <span className="text-xs text-slate-500">{journalStatus}</span>
            </div>
          }
          userSlot={
            <AppUserMenu
              product="journal"
              displayName={displayName}
              sections={journalMenuSections}
              onSignOut={user ? handleSignOut : undefined}
            />
          }
        />
        <header className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-rose-400">
            Toodl Story
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            Capture the story of your day like it deserves the front page.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Drift through guided prompts that feel like flipping through a
            colorful notebook. We&apos;ll help you stitch together the work, the
            heart, and the sparks that made today yours.
          </p>
          <div className="mx-auto max-w-3xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Choose how you want to write
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(ENTRY_MODE_OPTIONS) as EntryMode[]).map((mode) => {
                const option = ENTRY_MODE_OPTIONS[mode];
                const isActive = entryMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setEntryMode(mode)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition",
                      isActive
                        ? "border-rose-400 bg-white shadow-lg shadow-rose-200/60"
                        : "border-transparent bg-white/60 hover:bg-white/80"
                    )}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">
                      {option.badge}
                    </span>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {option.title}
                    </p>
                    <p className="text-sm text-slate-600">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-slate-400">
            Journal ID · {journalId ?? "Not saved yet"}
          </p>
        </header>

        <Card className="relative overflow-hidden border-none bg-white/80 p-6 shadow-2xl shadow-rose-200/50 backdrop-blur-xl md:p-10">
          <div className="absolute -left-12 top-10 h-40 w-40 rounded-full bg-rose-200 blur-3xl" />
          <div className="absolute right-4 top-4 h-14 w-14 rounded-full bg-orange-200 blur-2xl" />
          <div className="absolute bottom-10 right-12 h-52 w-40 rounded-full bg-sky-200 blur-3xl" />

          <div className="relative space-y-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {isSummaryStep
                    ? "Journal Preview"
                    : `Step ${currentStep + 1} of ${totalSteps}`}
                </span>
                <span className="text-sm font-medium text-slate-500">
                  {progressValue}% complete
                </span>
              </div>
              <Progress value={progressValue} className="h-3 rounded-full" />
            </div>

            {!isSummaryStep && activeStep ? (
              <div
                className={cn(
                  "relative rounded-3xl border bg-gradient-to-br p-8 shadow-xl",
                  activeStep.accent
                )}
              >
                <div className="absolute inset-0 rounded-3xl border border-white/40 bg-white/70 p-px [mask-image:linear-gradient(to_bottom,rgba(255,255,255,0.92),rgba(255,255,255,0.85))]" />
                <div className="relative space-y-8">
                  <div className="space-y-3">
                    <h2 className="font-serif text-3xl font-semibold tracking-tight">
                      {activeStep.title}
                    </h2>
                    <p className="max-w-2xl text-base leading-relaxed text-slate-700">
                      {activeStep.subtitle}
                    </p>
                  </div>

                  {entryMode === "daily" && currentStep === 0 ? (
                    <div>
                      <Label className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Select your mood ink
                      </Label>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {moodPalette.map((mood) => {
                          const isActive = selectedMood === mood.value;
                          return (
                            <button
                              key={mood.value}
                              type="button"
                              onClick={() => handleSelectMood(mood.value)}
                              className={cn(
                                "rounded-full px-4 py-2 text-sm font-semibold transition",
                                isActive
                                  ? "bg-slate-900 text-white shadow-lg shadow-slate-500/30"
                                  : "bg-white/70 text-slate-700 shadow-sm hover:bg-white"
                              )}
                            >
                              {mood.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-6">
                    {activeStep.questions.map((question) => {
                      if (
                        entryMode === "daily" &&
                        currentStep === 0 &&
                        question.id === "entryDate"
                      ) {
                        return (
                          <div key={question.id}>
                            <Label className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                              {question.label}
                            </Label>
                            <Input
                              type="date"
                              className="mt-2 border-white/60 bg-white/80 shadow-inner shadow-slate-400/10 focus:border-rose-400 focus:ring-rose-300/40"
                              value={answers.entryDate}
                              onChange={(event) =>
                                updateAnswer("entryDate", event.target.value)
                              }
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={question.id} className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                            {question.label}
                          </Label>
                          {question.type === "textarea" ? (
                            <Textarea
                              value={answers[question.id]}
                              onChange={(event) =>
                                updateAnswer(question.id, event.target.value)
                              }
                              placeholder={question.placeholder}
                              rows={question.rows}
                              className="border-white/50 bg-white/80 shadow-inner shadow-slate-500/10 focus:border-slate-400 focus:ring-slate-300/40"
                            />
                          ) : (
                            <Input
                              type={question.inputType ?? "text"}
                              value={answers[question.id]}
                              onChange={(event) =>
                                updateAnswer(question.id, event.target.value)
                              }
                              placeholder={question.placeholder}
                              className="border-white/60 bg-white/80 shadow-inner shadow-slate-500/10 focus:border-slate-400 focus:ring-slate-300/40"
                            />
                          )}
                          {question.helper ? (
                            <p className="text-sm italic text-slate-600">
                              {question.helper}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white via-rose-50 to-white p-8 shadow-lg">
                <div
                  className="absolute inset-4 rounded-2xl border-l-4 border-rose-300 bg-white/85 p-6"
                  style={{
                    backgroundImage:
                      "linear-gradient(to bottom, rgba(244, 244, 249, 0.7) 1px, transparent 1px)",
                    backgroundSize: "100% 32px",
                  }}
                />
                <div className="relative space-y-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-400">
                      {entryMode === "blog"
                        ? answers.blogTitle || "Blog preview"
                        : answers.entryDate
                        ? formatDisplayDate(answers.entryDate)
                        : "Journal preview"}
                    </span>
                    <h2 className="font-serif text-4xl font-semibold text-slate-900">
                      {entryMode === "blog" ? "Blog draft" : "Your story from today"}
                    </h2>
                    {entryMode === "daily" && selectedMood ? (
                      <p className="text-sm font-medium uppercase tracking-[0.35em] text-slate-500">
                        Mood: {selectedMood}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-5">
                    {journalPreview.length ? (
                      journalPreview.map((section) => (
                        <div key={section.heading} className="space-y-2">
                          <h3 className="font-semibold uppercase tracking-[0.25em] text-slate-500">
                            {section.heading}
                          </h3>
                          <div className="space-y-3">
                            {section.body.map((paragraph, index) => (
                              <p
                                key={`${section.heading}-${index}`}
                                className="text-lg leading-relaxed text-slate-700"
                              >
                                {paragraph}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-lg text-slate-600">
                        Your reflections will appear here once you add them.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-rose-200/60 bg-white/75 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">
                        Entry Status
                      </p>
                      <p className="mt-2 text-base text-slate-700">
                        {hasUnsavedChanges
                          ? "Draft — changes not saved yet."
                          : lastSavedAt
                          ? `Saved on ${formatTimestamp(lastSavedAt)}.`
                          : "Saved."}
                      </p>
                      {saveError ? (
                        <p className="mt-3 text-sm text-rose-600">{saveError}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2 rounded-2xl border border-rose-200/60 bg-white/75 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">
                        Share this journal
                      </p>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <code className="flex-1 break-all rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-white">
                          {shareUrl}
                        </code>
                        <Button
                          variant="outline"
                          onClick={handleCopyLink}
                          className="md:w-auto"
                        >
                          {copyStatus === "copied"
                            ? "Copied!"
                            : copyStatus === "failed"
                            ? "Copy failed"
                            : "Copy link"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 0 && !isSummaryStep}
                >
                  Back
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="bg-white/80"
                >
                  {isSummaryStep ? "Start another entry" : "Reset"}
                </Button>
              </div>

              <div className="flex items-center gap-3">
                {!isSummaryStep ? (
                  <Button
                    onClick={handleNext}
                    disabled={!allowNext}
                    className="bg-slate-900 px-6 py-2 text-base font-semibold text-white shadow-lg shadow-slate-500/30 transition hover:bg-slate-800"
                  >
                    {currentStep === totalSteps - 1
                      ? "Craft My Journal"
                      : "Next Page"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleSaveEntry}
                    disabled={savingEntry}
                    className="bg-rose-500 px-6 py-2 text-base font-semibold text-white shadow-lg shadow-rose-400/40 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-75"
                  >
                    {savingEntry
                      ? "Saving entry..."
                      : hasUnsavedChanges
                      ? "Save journal entry"
                      : "Save again"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-md overflow-y-auto bg-white/85 backdrop-blur-xl"
        >
          <SheetHeader>
            <SheetTitle>Past entries</SheetTitle>
            <SheetDescription>
              Revisit previous reflections and reopen them in the studio.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {libraryLoading && !libraryEntries.length ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : libraryError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {libraryError}
              </div>
            ) : groupedLibraryEntries.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                Your notebook is waiting for its first entry.
              </div>
            ) : (
              groupedLibraryEntries.map((group, index) => (
                <div key={`${group.label}-${index}`} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                    {group.label}
                  </h3>
                  <div className="space-y-2">
                    {group.entries.map((entry) => {
                      const displayDate = formatDisplayDate(
                        entry.entryDate || entry.createdAt
                      );
                      const updatedStamp = formatTimestamp(entry.updatedAt);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          disabled={entryLoading}
                          onClick={() => void handleSelectEntry(entry.id)}
                          className={cn(
                            "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md",
                            entryLoading && "opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-700">
                              {displayDate}
                            </span>
                            <span className="text-xs text-slate-400">
                              Updated {updatedStamp}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                            {entry.mood ? (
                              <Badge className="bg-rose-100 text-rose-700" variant="secondary">
                                {entry.mood}
                              </Badge>
                            ) : null}
                            {entry.snippet ? (
                              <span className="line-clamp-2 text-left text-sm text-slate-500">
                                “{entry.snippet}”
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">
                                No snippet saved
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default JournalExperience;
