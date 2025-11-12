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
} from "@/lib/journalService";
import { auth, onAuthStateChanged, signOut } from "@/lib/firebase";
import { generateId } from "@/lib/id";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/firebase";
import type {
  JournalAnswers,
  JournalDocument,
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

type JournalQuestion = {
  id: keyof JournalAnswers;
  label: string;
  placeholder?: string;
  helper?: string;
  type?: "textarea" | "input";
};

type JournalStep = {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  questions: JournalQuestion[];
};

const JOURNAL_STEPS: JournalStep[] = [
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
    id: "work",
    title: "Work & Wins",
    subtitle:
      "Unpack the stories from work — the shifts, the surprises, the lessons your future self will smile about.",
    accent:
      "from-amber-200 via-orange-200 to-rose-200 text-amber-900 border-amber-300",
    questions: [
      {
        id: "workStory",
        label: "What did you tackle at work today?",
        placeholder: "Meetings, projects, breakthroughs, tough conversations...",
        type: "textarea",
      },
      {
        id: "workFeeling",
        label: "What feeling lingered as you walked away from work?",
        placeholder: "Proud, stretched, energized, ready for rest...",
        type: "textarea",
      },
    ],
  },
  {
    id: "learning",
    title: "Growth & Sparks",
    subtitle:
      "Capture what stretched you. New insights, lessons, reminders — anything that nudged you forward.",
    accent:
      "from-emerald-200 via-teal-200 to-cyan-200 text-emerald-900 border-emerald-300",
    questions: [
      {
        id: "learningNote",
        label: "What did you learn or notice today?",
        placeholder: "A new idea, a skill sharpened, a pattern spotted...",
        type: "textarea",
      },
      {
        id: "forwardIntent",
        label: "How will you carry that into tomorrow?",
        placeholder: "A promise to yourself, a habit tweak, a mindset shift...",
        type: "textarea",
      },
    ],
  },
  {
    id: "family",
    title: "Family & Heartbeats",
    subtitle:
      "Hold space for the people you love. The laughs, the quiet moments, the story you want to revisit.",
    accent:
      "from-indigo-200 via-sky-200 to-purple-200 text-indigo-900 border-indigo-300",
    questions: [
      {
        id: "familyStory",
        label: "What did you do with your wife/kids today?",
        placeholder:
          "Bedtime stories, spontaneous adventures, real conversations...",
        type: "textarea",
      },
      {
        id: "familyFeeling",
        label: "What made you feel most connected at home?",
        placeholder:
          "A shared laugh, a shared silence, a hug that landed just right...",
        type: "textarea",
      },
    ],
  },
  {
    id: "gratitude",
    title: "Gratitude & Freestyle",
    subtitle:
      "Seal the day with gratitude and whatever else your heart wants to spill — this page is yours.",
    accent:
      "from-lime-200 via-yellow-200 to-rose-200 text-lime-900 border-lime-300",
    questions: [
      {
        id: "gratitude",
        label: "Who or what are you grateful for?",
        placeholder:
          "Name the person, moment, or simple joy that made the day brighter.",
        type: "textarea",
      },
      {
        id: "other",
        label: "Other — write whatever you feel like.",
        helper:
          "A wild idea, a vent session, a secret goal — this space is your catch-all page.",
        placeholder:
          "Let it flow. No rules, no editing. Just you catching the day before it fades.",
        type: "textarea",
      },
    ],
  },
];

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
  const [journalDoc, setJournalDoc] = useState<JournalDocument | null>(null);
  const [invalidJournal, setInvalidJournal] = useState(false);
  const [loadingJournal, setLoadingJournal] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [answers, setAnswers] = useState<JournalAnswers>(initialAnswers);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryEntries, setLibraryEntries] = useState<JournalEntrySummary[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);

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

  const totalSteps = JOURNAL_STEPS.length;
  const isSummaryStep = currentStep === totalSteps;
  const activeStep = isSummaryStep ? null : JOURNAL_STEPS[currentStep];

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
      setJournalDoc(null);
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
    if (!member) {
      return;
    }
    if (journalId) {
      return;
    }
    let active = true;

    const bootstrap = async () => {
      setLoadingJournal(true);
      try {
        const newJournalId = await createJournalDocument(member);
        if (!active) {
          return;
        }
        setJournalId(newJournalId);
        persistJournalToUrl(newJournalId);
        setInvalidJournal(false);
      } catch (error) {
        console.error("Failed to create journal:", error);
        if (active) {
          setInvalidJournal(true);
          setLoadingJournal(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, [journalId, member, persistJournalToUrl]);

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
          setJournalDoc(null);
          return;
        }
        await ensureMemberOnJournal(journalId, member);
        if (!active) {
          return;
        }
        setJournalDoc(doc);
        setInvalidJournal(false);
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

    hydrate();

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
    return activeStep.questions.some((question) => {
      if (currentStep === 0 && question.id === "entryDate") {
        return false;
      }
      const value = answers[question.id];
      return value && value.trim().length > 0;
    });
  }, [activeStep, answers, currentStep, isSummaryStep]);

  const journalPreview = useMemo(() => {
    const sections: { heading: string; body: string[] }[] = [];

    const sceneBody: string[] = [];
    if (answers.dayVibe) {
      sceneBody.push(
        `The day floated in feeling ${answers.dayVibe.trim()}.`
      );
    }
    if (selectedMood) {
      sceneBody.push(
        `Mood on the journal palette: ${selectedMood.toUpperCase()}.`
      );
    }
    if (answers.goldenMoment) {
      sceneBody.push(`Golden moment: ${answers.goldenMoment.trim()}.`);
    }
    if (sceneBody.length) {
      sections.push({ heading: "Scene Setting", body: sceneBody });
    }

    const workBody: string[] = [];
    if (answers.workStory) {
      workBody.push(answers.workStory.trim());
    }
    if (answers.workFeeling) {
      workBody.push(`It left me feeling ${answers.workFeeling.trim()}.`);
    }
    if (workBody.length) {
      sections.push({ heading: "Work & Wins", body: workBody });
    }

    const growthBody: string[] = [];
    if (answers.learningNote) {
      growthBody.push(answers.learningNote.trim());
    }
    if (answers.forwardIntent) {
      growthBody.push(
        `Tomorrow, I'll carry it forward by ${answers.forwardIntent.trim()}.`
      );
    }
    if (growthBody.length) {
      sections.push({ heading: "Growth Sparks", body: growthBody });
    }

    const familyBody: string[] = [];
    if (answers.familyStory) {
      familyBody.push(answers.familyStory.trim());
    }
    if (answers.familyFeeling) {
      familyBody.push(`It felt ${answers.familyFeeling.trim()}.`);
    }
    if (familyBody.length) {
      sections.push({ heading: "Family & Heartbeats", body: familyBody });
    }

    const gratitudeBody: string[] = [];
    if (answers.gratitude) {
      gratitudeBody.push(`Grateful for ${answers.gratitude.trim()}.`);
    }
    if (answers.other) {
      gratitudeBody.push(answers.other.trim());
    }
    if (gratitudeBody.length) {
      sections.push({ heading: "Freestyle Reflections", body: gratitudeBody });
    }

    return sections;
  }, [answers, selectedMood]);

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
    setAnswers(initialAnswers);
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

  const handleSaveEntry = async () => {
    if (!journalId || !member) {
      return;
    }
    setSavingEntry(true);
    setSaveError(null);
    try {
      const nowIso = new Date().toISOString();
      const normalizedAnswers = Object.entries(answers).reduce(
        (acc, [key, value]) => {
          acc[key as keyof JournalAnswers] = value.trim();
          return acc;
        },
        {} as JournalAnswers
      );
      const entry: JournalEntry = {
        id: generateId(),
        journalId,
        memberId: member.id,
        entryDate: normalizedAnswers.entryDate || null,
        mood: selectedMood,
        answers: normalizedAnswers,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await saveJournalEntry(journalId, entry);
      setLastSavedAt(nowIso);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save journal entry:", error);
      setSaveError("We couldn't save your entry. Please try again in a moment.");
    } finally {
      setSavingEntry(false);
    }
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
    setJournalDoc(null);
    setInvalidJournal(false);
    router.replace("/journal");
    handleReset();
  }, [handleReset, router]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  }, []);

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
          },
          {
            label: "Start new entry",
            onClick: handleStartFresh,
          },
        ],
      },
    ],
    [handleCopyLink, handleStartFresh, shareUrl]
  );

  const loadLibraryEntries = useCallback(async () => {
    if (!journalId) {
      return;
    }
    setLibraryLoading(true);
    try {
      const summaries = await listJournalEntrySummaries(journalId);
      setLibraryEntries(summaries);
      setLibraryError(null);
    } catch (error) {
      console.error("Failed to load journal entries:", error);
      setLibraryError("We couldn't load previous entries right now.");
    } finally {
      setLibraryLoading(false);
    }
  }, [journalId]);

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

  if (
    loadingJournal ||
    !journalId ||
    !journalDoc ||
    !member
  ) {
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
                <Button variant="secondary" onClick={() => setLibraryOpen(true)}>
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
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-slate-400">
            Journal ID · {journalId}
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

                  {currentStep === 0 ? (
                    <div className="grid gap-6">
                      <div>
                        <Label className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Pick your day
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
                    </div>
                  ) : null}

                  <div className="grid gap-6">
                    {activeStep.questions.map((question) => {
                      if (currentStep === 0 && question.id === "entryDate") {
                        return null;
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
                              className="border-white/50 bg-white/80 shadow-inner shadow-slate-500/10 focus:border-slate-400 focus:ring-slate-300/40"
                            />
                          ) : (
                            <Input
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
                      {answers.entryDate
                        ? formatDisplayDate(answers.entryDate)
                        : "Journal Preview"}
                    </span>
                    <h2 className="font-serif text-4xl font-semibold text-slate-900">
                      Your Story From Today
                    </h2>
                    {selectedMood ? (
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
