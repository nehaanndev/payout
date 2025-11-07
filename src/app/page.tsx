'use client'

import { Suspense, useState, useEffect } from "react";
import type { ComponentType, SVGProps } from "react";
import SearchParamsClient from '@/components/SearchParamsClient'
import {
  auth,
  provider,
  microsoftProvider,
  facebookProvider,
  signInWithPopup,
  signOut,
  User,
  onAuthStateChanged,
} from "../lib/firebase"; // Import Firebase auth and providers
import ExpenseSplitter from "./expense_splitter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getOrCreateUserId } from "@/lib/userUtils";
import { avatarUrls } from "@/lib/avatars";
import { Member } from "@/types/group"; // assuming Member is defined there
import { fetchGroupById } from "@/lib/firebaseUtils";
import IdentityPrompt from "@/components/IdentityPrompt";
/* --- imports (add these near the top of the file) --- */
import Image from "next/image";
import Link from "next/link";
import { CurrencyCode } from "@/lib/currency_core";
import { DEFAULT_CURRENCY, getGroupCurrency } from "@/lib/currency";
import { AppTopBar } from "@/components/AppTopBar";
import { AppUserMenu, AppUserMenuSection } from "@/components/AppUserMenu";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CalendarCheck2,
  Camera,
  NotebookPen,
  ShieldCheck,
  Users,
  Wand2,
} from "lucide-react";
import PaymentSettingsDialog from "@/components/PaymentSettingsDialog";
import {
  fetchExpensePaymentPreferences,
  updateExpensePaymentPreferences,
} from "@/lib/expenseSettingsService";
import {
  ExpensePaymentPreferences,
  createDefaultExpensePaymentPreferences,
} from "@/types/paymentPreferences";
import { useToodlMind } from "@/components/mind/ToodlMindProvider";
import { MindUserIdentity } from "@/lib/mind/types";

type SpotlightProduct = {
  name: string;
  tagline: string;
  icon: string;
  accent: string;
  description: string;
  href: string;
};

const PRODUCT_SPOTLIGHT: SpotlightProduct[] = [
  {
    name: "Split",
    tagline: "Settle tabs from a chat",
    icon: "/brand/toodl-expense.svg",
    accent: "from-slate-900/10 via-slate-800/5 to-slate-900/0",
    description:
      "Log purchases in the conversation view, auto-calc shares, and settle every crew instantly.",
    href: "/",
  },
  {
    name: "Pulse",
    tagline: "Budgets that breathe",
    icon: "/brand/toodl-budget.svg",
    accent: "from-emerald-500/15 via-teal-400/10 to-emerald-500/0",
    description:
      "Model cash, categories, and goals with AI projections that update as soon as you speak.",
    href: "/budget",
  },
  {
    name: "Story",
    tagline: "Journals with context",
    icon: "/brand/toodl-journal.svg",
    accent: "from-rose-400/15 via-amber-300/10 to-sky-400/0",
    description:
      "Write the memory beside the math so recaps pull both feelings and figures.",
    href: "/journal",
  },
  {
    name: "Flow",
    tagline: "Line up the day’s moves",
    icon: "/brand/toodl-flow.svg",
    accent: "from-emerald-400/15 via-teal-300/10 to-amber-200/0",
    description:
      "Turn chat-driven intentions into sequenced plans, focus blocks, and nudges you’ll actually follow.",
    href: "/flow",
  },
  {
    name: "Orbit",
    tagline: "Save sparks you’ll act on",
    icon: "/brand/toodl-orbit.svg",
    accent: "from-indigo-500/15 via-violet-400/10 to-blue-400/0",
    description:
      "Drop research, receipts, and voice notes into Orbit so the AI ledger can bring them back when needed.",
    href: "/orbit",
  },
];

const WORKFLOW_STEPS: Array<{
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}> = [
  {
    title: "Toodl Mind",
    description: "Say what just happened or what you need next and let the AI Mind organize the playbook.",
    icon: Brain,
  },
  {
    title: "Capture",
    description: "Save receipts, ideas, and quick notes the second they show up so nothing slips.",
    icon: Camera,
  },
  {
    title: "Schedule",
    description: "Map chores and follow-ups onto your calendar rhythm with lightweight nudges.",
    icon: CalendarCheck2,
  },
  {
    title: "Budget",
    description: "Plan months, cash, and goals—then watch live projections as you make edits.",
    icon: BarChart3,
  },
  {
    title: "Split bills",
    description: "Track tabs with your crew and settle balances instantly without spreadsheets.",
    icon: Users,
  },
  {
    title: "Journal",
    description: "Close the conversation by writing the story beside the numbers for every shared win.",
    icon: NotebookPen,
  },
];

const FEATURE_CALLOUTS: Array<{
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}> = [
  {
    title: "Conversation context everywhere",
    description:
      "The AI Mind listens across budgets, expenses, journals, Flow plans, and Orbit saves so every reply already knows the backstory.",
    icon: Brain,
  },
  {
    title: "Crew-ready workspaces",
    description:
      "Spin up focused spaces for family, trips, side hustles, or roommates and keep each conversation scoped to the right people.",
    icon: Users,
  },
  {
    title: "Memory that answers back",
    description:
      "Budgets, receipts, and journal entries stay versioned so you can ask for a recap and get the exact moment retold.",
    icon: ShieldCheck,
  },
  {
    title: "Calendar-friendly nudges",
    description:
      "Scheduling hooks turn conversational intentions into gentle reminders that match the rhythm you already use.",
    icon: CalendarCheck2,
  },
];

const SOCIAL_PROOF: Array<{
  quote: string;
  name: string;
  role: string;
}> = [
  {
    quote:
      "We talk through the week once, and Toodl Mind spins out Flow tasks while Orbit keeps the research.",
    name: "Priya N.",
    role: "Brooklyn house share",
  },
  {
    quote:
      "We run one budget for our startup team, another for home. One conversation updates both, so we never bounce between tools.",
    name: "Marcus L.",
    role: "Small business co-founder",
  },
  {
    quote:
      "Splitting bills, logging journal wins, then asking Mind for a recap makes every month feel intentional.",
    name: "Harper & Lee",
    role: "Family CFOs",
  },
];

const identitiesMatch = (
  a: MindUserIdentity | null,
  b: MindUserIdentity | null
) => {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.userId === b.userId &&
    a.email === b.email &&
    a.displayName === b.displayName &&
    a.timezone === b.timezone
  );
};

export default function Home() {
  const [session, setSession] = useState<User | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIdentityChoice, setShowIdentityChoice] = useState(false);
  const [sharedMembers, setSharedMembers] = useState<Member[] | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [existingName, setExistingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [avatar, setAvatar] = useState("/avatars/avatar5.png");
  const [anonUser, setAnonUser] = useState<Member | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null)  // Get group_id from query string
  const [paymentPreferences, setPaymentPreferences] = useState<ExpensePaymentPreferences | null>(null);
  const [paymentDialogMode, setPaymentDialogMode] = useState<"prompt" | "settings" | null>(null);
  const [hasPromptedForPaypal, setHasPromptedForPaypal] = useState(false);
  const { setIdentity, identity } = useToodlMind();
    

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setSession(user); // Set the session as UserWithGroup type
      setGroup(groupId); // Reset group state
      console.log("group_id:", groupId);
      setLoading(false);
    });
  
    return () => unsubscribe();
  }, [groupId]);  // Add `group_id` as a dependency

  useEffect(() => {
    if (typeof window !== "undefined" && !session) {
      const storedAvatar = localStorage.getItem("user_avatar");
      if (storedAvatar) setAvatar(storedAvatar);
  
      const memberStr = localStorage.getItem("anon_member");
      if (memberStr) {
        try {
          const member: Member = JSON.parse(memberStr);
          setAnonUser(member);
        } catch {
          console.warn("Invalid anon member in storage");
        }
      }
    }
  }, [session]);
  
  // 1) If there's a group_id but no session or anonUser yet,
  // fetch that group's members so we can prompt "Who are you?"
  useEffect(() => {
    if (groupId && !session && !anonUser) {
      fetchGroupById(groupId)
        .then((g) => {
          if (g) {
            setSharedMembers(g.members ?? []);
            setCurrency(getGroupCurrency(g));
          }
          setShowIdentityChoice(true);
        })
        .catch(console.error);
    }
  }, [groupId, session, anonUser]);

  useEffect(() => {
    const timezone =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";

    let nextIdentity: MindUserIdentity | null = null;
    if (session) {
      nextIdentity = {
        userId: session.uid,
        email: session.email ?? null,
        displayName:
          session.displayName ??
          (session.email ? session.email.split("@")[0] : null),
        timezone,
      };
    } else if (anonUser) {
      nextIdentity = {
        userId: anonUser.id,
        email: anonUser.email ?? null,
        displayName: anonUser.firstName ?? anonUser.email ?? null,
        timezone,
      };
    }

    if (identitiesMatch(identity, nextIdentity)) {
      return;
    }

    setIdentity(nextIdentity);
  }, [session, anonUser, identity, setIdentity]);

  useEffect(() => {
    if (!session) {
      setPaymentPreferences(null);
      setPaymentDialogMode(null);
      return;
    }

    let active = true;
    const loadPreferences = async () => {
      try {
        const prefs = await fetchExpensePaymentPreferences(session.uid);
        if (!active) {
          return;
        }
        setPaymentPreferences(prefs);
        if (
          !prefs.paypalMeLink &&
          !prefs.suppressPaypalPrompt &&
          !hasPromptedForPaypal
        ) {
          setPaymentDialogMode((prev) => prev ?? "prompt");
          setHasPromptedForPaypal(true);
        }
      } catch (error) {
        console.error("Error loading payment preferences", error);
      }
    };

    void loadPreferences();
    return () => {
      active = false;
    };
  }, [session, hasPromptedForPaypal]);

  useEffect(() => {
    setHasPromptedForPaypal(false);
  }, [session?.uid]);

  const displayName = session?.displayName || anonUser?.firstName || 'Guest User';
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in to Firebase: ", error);
    }
  };

  const handleMicrosoftSignIn = async () => {
    try {
      await signInWithPopup(auth, microsoftProvider);
    } catch (error) {
      console.error("Error signing in with Microsoft: ", error);
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      await signInWithPopup(auth, facebookProvider);
    } catch (error) {
      console.error("Error signing in with Facebook: ", error);
    }
  };

  const handlePaymentPreferencesSave = async ({
    paypalMeLink,
    suppressPaypalPrompt,
  }: {
    paypalMeLink: string | null;
    suppressPaypalPrompt: boolean;
  }) => {
    if (!session) {
      throw new Error("Sign in required to save payment settings");
    }
    await updateExpensePaymentPreferences(session.uid, {
      paypalMeLink,
      suppressPaypalPrompt,
    });
    const base =
      paymentPreferences ?? createDefaultExpensePaymentPreferences();
    setPaymentPreferences({
      ...base,
      paypalMeLink,
      suppressPaypalPrompt,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleResetIdentity = () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn("Failed to clear stored identity", error);
    }
    location.reload();
  };

  const handleContinueWithoutSignIn = () => {
    const existing_name = localStorage.getItem('user_name');
    if (existing_name) {
      setExistingName(existing_name);
      setShowIdentityChoice(true);
    } else {
      setIsNewUser(true);
      setShowIdentityChoice(true);
    }
    const avatarIndex = Math.floor(Math.random() * avatarUrls.length);
    const anonAvatar = avatarUrls[avatarIndex];
    localStorage.setItem('user_avatar', anonAvatar);
  };

  const handleSelectExistingIdentity = () => {
    const memberStr = localStorage.getItem("anon_member");
    if (!memberStr) {
      return;
    }
    try {
      const member: Member = JSON.parse(memberStr);
      setAnonUser(member);
      setShowIdentityChoice(false);
      setIsNewUser(false);
      if (member.firstName) {
        setExistingName(member.firstName);
      }
    } catch (error) {
      console.warn("Failed to parse stored anon member", error);
    }
  };

  const handleSubmitIdentityName = () => {
    if (!tempName.trim()) {
      return;
    }
    const id = getOrCreateUserId();
    const member: Member = {
      id,
      email: "",
      firstName: tempName.trim(),
      authProvider: "anon",
    };
    localStorage.setItem("anon_member", JSON.stringify(member));
    setAnonUser(member);
    setExistingName(member.firstName ?? null);
    const avatarIndex = Math.floor(Math.random() * avatarUrls.length);
    const anonAvatar = avatarUrls[avatarIndex];
    localStorage.setItem("user_avatar", anonAvatar);
    setShowIdentityChoice(false);
    setIsNewUser(false);
    setTempName("");
  };

  const expenseMenuSections: AppUserMenuSection[] = [];
  if (!session && anonUser) {
    expenseMenuSections.push({
      title: "Identity",
      items: [
        {
          label: "Reset guest identity",
          onClick: handleResetIdentity,
        },
      ],
    });
  }

  if (session) {
    expenseMenuSections.push({
      title: "App settings",
      items: [
        {
          label: "Payment settings",
          description: paymentPreferences?.paypalMeLink
            ? "Share or edit your PayPal.Me link"
            : "Add a PayPal.Me link so friends can pay you quickly",
          onClick: () => setPaymentDialogMode("settings"),
        },
      ],
    });
  }

  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  return (
    <>
      {/* 3️⃣ Hydrate the client-only hook via Suspense */}
      <Suspense fallback={null}>
        <SearchParamsClient onParams={params => {
          setGroupId(params.get('group_id'))
        }} />
      </Suspense>
    <div className="min-h-screen flex flex-col bg-gray-100">
      { /* Case A: Signed-in or already-identified anon user → show the app */ }
      {session || anonUser ? (
        <>
          <AppTopBar
            product="expense"
            userSlot={
              <AppUserMenu
                product="expense"
                displayName={displayName}
                avatarSrc={avatar}
                onSignOut={session ? handleSignOut : undefined}
                sections={expenseMenuSections}
              />
            }
          />
          <div className="flex-grow p-8">
            <ExpenseSplitter
              session={session}
              groupid={group}
              anonUser={anonUser}
              currency={currency}
              paymentPreferences={paymentPreferences}
              onShowPaymentSettings={() => setPaymentDialogMode("settings")}
            />
          </div>
        </>
      )     
      /* Case B: No user yet, but we fetched sharedMembers → ask “Who are you?” */ 
      : sharedMembers ? (
        <IdentityPrompt
          members={sharedMembers}
          onSelect={(member) => {
            // Save the chosen member as our anonUser and hide the prompt
            localStorage.setItem("anon_member", JSON.stringify(member));
            setAnonUser(member);
            setShowIdentityChoice(false);
            setSharedMembers(null);
          }}
        />
      ): (
        <>
          <LandingPage
            onGoogle={handleGoogleSignIn}
            onMicrosoft={handleMicrosoftSignIn}
            onFacebook={handleFacebookSignIn}
            onContinueWithoutSignIn={handleContinueWithoutSignIn}
          />
          <IdentityModal
            open={showIdentityChoice}
            existingName={existingName}
            isNewUser={isNewUser}
            tempName={tempName}
            onSetTempName={setTempName}
            onSetIsNewUser={setIsNewUser}
            onClose={() => {
              setShowIdentityChoice(false);
              setIsNewUser(false);
              setTempName("");
            }}
            onSelectExisting={handleSelectExistingIdentity}
            onSubmitNew={handleSubmitIdentityName}
          />
        </>
      )}
    </div>
      <PaymentSettingsDialog
        open={paymentDialogMode !== null}
        mode={paymentDialogMode ?? "settings"}
        initialLink={paymentPreferences?.paypalMeLink ?? null}
        initialSuppressPrompt={
          paymentPreferences?.suppressPaypalPrompt ?? false
        }
        onClose={() => setPaymentDialogMode(null)}
        onSave={handlePaymentPreferencesSave}
      />
    </>
  );
}

type LandingPageProps = {
  onGoogle: () => void;
  onMicrosoft: () => void;
  onFacebook: () => void;
  onContinueWithoutSignIn: () => void;
};

function LandingPage({
  onGoogle,
  onMicrosoft,
  onFacebook,
  onContinueWithoutSignIn,
}: LandingPageProps) {
  return (
    <div className="flex flex-col bg-white text-slate-900">
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-sky-50">
        <div className="absolute -top-40 left-20 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-28">
          <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
            <div className="space-y-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 ring-1 ring-slate-100">
                <Wand2 className="h-3.5 w-3.5 text-amber-500" />
                AI-first ledger
              </span>
              <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                AI conversations that run your life&apos;s ledger.
              </h1>
              <p className="text-lg text-slate-600 lg:text-xl">
                Tell Toodl&apos;s AI what just happened or what needs to move next. That one conversation ripples into Split for bills, Pulse for budgets, Story for journals, Flow for plans, and Orbit for saves—no more juggling apps to stay organized.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primaryDark"
                  onClick={onGoogle}
                  className="flex items-center gap-2 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Image src="/logos/google.svg" alt="Google" width={18} height={18} className="h-4 w-4" />
                  Start with Google
                </Button>
                <Button
                  variant="outline"
                  onClick={onMicrosoft}
                  className="flex items-center gap-2 border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900"
                >
                  <Image src="/logos/microsoft.svg" alt="Microsoft" width={18} height={18} className="h-4 w-4" />
                  Use Microsoft
                </Button>
                <Button
                  variant="outline"
                  onClick={onFacebook}
                  className="flex items-center gap-2 border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900"
                >
                  <Image src="/logos/facebook.svg" alt="Facebook" width={18} height={18} className="h-4 w-4" />
                  Facebook login
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <button
                  type="button"
                  onClick={onContinueWithoutSignIn}
                  className="inline-flex items-center text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                >
                  Continue without signing in
                </button>
                <span>It only takes a minute to invite teammates later.</span>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                    The Toodl apps
                  </p>
                  <span className="text-[11px] font-medium uppercase tracking-[0.35em] text-emerald-500">
                    Five live · AI-ready
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {PRODUCT_SPOTLIGHT.map((product) => (
                    <div
                      key={`hero-${product.name}`}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/70 p-3"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-inner">
                        <Image src={product.icon} alt={product.name} width={32} height={32} className="brand-logo" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.tagline}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -top-10 -right-6 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />
              <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-slate-900/95 px-6 py-8 text-white shadow-2xl shadow-sky-200/30">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-300/15 via-transparent to-sky-500/15" />
                <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 text-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
                    <Brain className="h-3.5 w-3.5" />
                    AI ledger demo
                  </span>
                  <p className="text-xl font-semibold">Watch a chat become a plan</p>
                  <p className="text-sm text-white/70">
                    Drop your walkthrough or launch reel here to show how one spoken thought feeds the AI, then becomes budgets, Flow tasks, Orbit saves, and journal notes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Four apps · One ledger</p>
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Every experience clicks into the same shared rhythm.
            </h2>
            <p className="mx-auto max-w-2xl text-base text-slate-600">
              Kick things off with a conversation, then drop into Split, Pulse, Story, Flow, or Orbit—soon the next app joins without new logins or context switching.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {PRODUCT_SPOTLIGHT.map((product) => (
              <Link
                key={product.name}
                href={product.href}
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/70 p-6 text-left shadow-sm transition hover:-translate-y-1.5 hover:border-slate-200 hover:shadow-xl"
              >
                <div className={`pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br ${product.accent}`} />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-inner">
                    <Image src={product.icon} alt={product.name} width={44} height={44} className="brand-logo" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{product.tagline}</p>
                  </div>
                </div>
                <p className="relative mt-4 flex-1 text-sm text-slate-600">{product.description}</p>
                <span className="relative mt-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 transition group-hover:text-slate-900">
                  Peek inside <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 md:grid-cols-[260px_1fr] md:items-start">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-300">Conversation to completion</p>
              <h2 className="text-3xl font-bold text-white md:text-4xl">
                One chat fans out into every action.
              </h2>
              <p className="text-sm text-slate-300">
                Speak the moment once. Toodl Mind captures it, schedules what matters, updates the budget, spins up Flow blocks, routes Orbit saves, splits the costs, and leaves a journal note behind. The cadence works for groceries, weddings, startups, or side quests.
              </p>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-8 bottom-8 w-px bg-gradient-to-b from-emerald-400 via-emerald-300/20 to-transparent" />
              <div className="space-y-8">
                {WORKFLOW_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="relative flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300/20 text-emerald-200">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
                          Step {index + 1}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{step.title}</h3>
                        <p className="mt-1 text-sm text-slate-200">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Voices from the crew</p>
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
              People using Toodl feel calmer, more connected, and more on track.
            </h2>
            <p className="text-sm text-slate-600">
              Transparent tabs, collaborative budgets, and private journals mean fewer surprises and more wins shared out loud.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {SOCIAL_PROOF.map((story) => (
              <div
                key={story.name}
                className="flex h-full flex-col justify-between rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
              >
                <p className="text-sm text-slate-600">&ldquo;{story.quote}&rdquo;</p>
                <div className="mt-6 space-y-1 text-sm font-medium text-slate-800">
                  <p>{story.name}</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{story.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Under the hood</p>
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Details that hold every Toodl app together.</h2>
            <p className="mx-auto max-w-2xl text-base text-slate-600">
              Shared identity, context-aware assistance, and reliable history mean each app feels specialized without living in its own silo.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {FEATURE_CALLOUTS.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex h-full flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-slate-200 hover:shadow-lg"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center text-white">
          <h2 className="text-3xl font-bold md:text-4xl">
            Ready to start the AI conversation that runs your ledger?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-200">
            Say it once, let the AI Mind remember it, then split bills, plan budgets, capture journals, spin up Flow, and organize Orbit—all with a single sign-in.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              variant="primaryDark"
              onClick={onGoogle}
              className="flex items-center gap-2 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              <Image src="/logos/google.svg" alt="Google" width={18} height={18} className="h-4 w-4" />
              Start with Google
            </Button>
            <Button
              variant="outline"
              onClick={onMicrosoft}
              className="flex items-center gap-2 border-white/40 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              <Image src="/logos/microsoft.svg" alt="Microsoft" width={18} height={18} className="h-4 w-4" />
              Use Microsoft
            </Button>
            <Button
              variant="outline"
              onClick={onFacebook}
              className="flex items-center gap-2 border-white/40 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              <Image src="/logos/facebook.svg" alt="Facebook" width={18} height={18} className="h-4 w-4" />
              Facebook login
            </Button>
          </div>
          <button
            type="button"
            onClick={onContinueWithoutSignIn}
            className="mt-6 inline-flex items-center text-sm text-slate-300 underline-offset-2 hover:text-white hover:underline"
          >
            Prefer to explore without signing in
          </button>
        </div>
      </section>
    </div>
  );
}

type IdentityModalProps = {
  open: boolean;
  existingName: string | null;
  isNewUser: boolean;
  tempName: string;
  onSetTempName: (value: string) => void;
  onSetIsNewUser: (value: boolean) => void;
  onSelectExisting: () => void;
  onSubmitNew: () => void;
  onClose: () => void;
};

function IdentityModal({
  open,
  existingName,
  isNewUser,
  tempName,
  onSetTempName,
  onSetIsNewUser,
  onSelectExisting,
  onSubmitNew,
  onClose,
}: IdentityModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
        {existingName && !isNewUser ? (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Welcome back!</h2>
              <p className="text-sm text-slate-600">
                We spotted your earlier session. Continue as {existingName} or choose a different name.
              </p>
            </div>
            <div className="space-y-3">
              <Button className="w-full" onClick={onSelectExisting}>
                I&apos;m {existingName}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  onSetIsNewUser(true);
                }}
              >
                Somebody else
              </Button>
              <Button variant="ghost" className="w-full text-slate-500 hover:text-slate-700" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold text-slate-900">Who should we call you?</h2>
              <p className="text-sm text-slate-600">We&apos;ll use this name in shared tabs until you sign in.</p>
            </div>
            <div className="space-y-3">
              <label className="sr-only" htmlFor="anon-name">
                Your name
              </label>
              <input
                id="anon-name"
                type="text"
                value={tempName}
                onChange={(event) => onSetTempName(event.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <Button className="w-full" onClick={onSubmitNew}>
                Continue
              </Button>
              <Button variant="ghost" className="w-full text-slate-500 hover:text-slate-700" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
