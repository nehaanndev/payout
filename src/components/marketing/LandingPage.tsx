"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CalendarCheck2,
  Camera,
  NotebookPen,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

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
    href: "/split",
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
    tagline: "Journal beside the math",
    icon: "/brand/toodl-journal.svg",
    accent: "from-rose-400/15 via-amber-300/10 to-sky-400/0",
    description:
      "Write the day beside the numbers so feelings carry through every recap.",
    href: "/journal",
  },
  {
    name: "Flow",
    tagline: "Line up the day’s moves",
    icon: "/brand/toodl-flow.svg",
    accent: "from-emerald-400/15 via-teal-300/10 to-amber-200/0",
    description:
      "Turn intentions into a calm schedule without leaving the conversation.",
    href: "/flow",
  },
  {
    name: "Orbit",
    tagline: "Save sparks you’ll act on",
    icon: "/brand/toodl-orbit.svg",
    accent: "from-indigo-500/15 via-violet-400/10 to-blue-400/0",
    description:
      "Drop research, receipts, and voice notes into Orbit so the ledger remembers for you.",
    href: "/orbit",
  },
];

type WorkflowStep = {
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    title: "Toodl Mind",
    description:
      "Say what just happened or what needs to move next, let the AI organize the playbook.",
    icon: Brain,
  },
  {
    title: "Capture",
    description:
      "Save receipts, ideas, and quick notes the second they show up so nothing slips.",
    icon: Camera,
  },
  {
    title: "Schedule",
    description:
      "Map chores and follow-ups onto your calendar rhythm with lightweight nudges.",
    icon: CalendarCheck2,
  },
  {
    title: "Budget",
    description:
      "Plan months, cash, and goals—then watch live projections as you make edits.",
    icon: BarChart3,
  },
  {
    title: "Split bills",
    description:
      "Track tabs with your crew and settle balances instantly without spreadsheets.",
    icon: Users,
  },
  {
    title: "Journal",
    description:
      "Close the conversation by writing the story beside the numbers for every shared win.",
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
      "Invite the household, cofounders, or wedding party. Every app respects roles but shares the same heartbeat.",
    icon: Users,
  },
  {
    title: "Photos on your terms",
    description:
      "Drop a quick snapshot with an expense or journal. The dashboard resurfaces the heartfelt ones automatically.",
    icon: Camera,
  },
  {
    title: "Playbooks that remember",
    description:
      "Trigger Flow tasks, journal prompts, or Orbit saves by talking to Toodl Mind once.",
    icon: NotebookPen,
  },
];

const DAILY_TRIGGERS = [
  {
    name: "Orientation",
    question: "What’s the status of my crew?",
    tactic: "Groups module highlights balances with context so users instantly know if they owe or are owed.",
  },
  {
    name: "Completion",
    question: "Did I finish the loop?",
    tactic: "Flow & journal recap show streaks so people feel progress beyond to-dos.",
  },
  {
    name: "Continuity",
    question: "What’s next to keep the story moving?",
    tactic: "Saved links & AI recaps hand them a next breadcrumb so they re-open Orbit/Story nightly.",
  },
];

const RITUAL_LOOP = [
  {
    stage: "See",
    blurb: "Start with balances + budget pulse so the brain registers “status check complete.”",
  },
  {
    stage: "Do",
    blurb: "The morning Flow card surfaces tasks + anchors. Buttons add expenses or notes quickly.",
  },
  {
    stage: "Feel",
    blurb: "Reflection + journal tiles remind them to capture the day, not just the math.",
  },
  {
    stage: "Reflect",
    blurb: "Weekly digest ties it all together while AI recaps spark next week’s curiosity.",
  },
];

const DASHBOARD_SNAPSHOTS = [
  {
    id: "morning",
    label: "Morning calm",
    headline: "Wake up with clarity.",
    subhead: "Flow lines up anchors, groups show what’s owed, and budgets keep you honest.",
    emoji: "🌤️",
    gradient: "bg-gradient-to-br from-white via-emerald-50 to-white",
    background: "border-emerald-100",
    details: [
      {
        title: "Anchors",
        description: "First three Flow tasks so the day feels guided.",
      },
      {
        title: "Balances",
        description: "Household sees who owes what right away.",
      },
      {
        title: "Budget pulse",
        description: "Flex spending remaining so choices feel confident.",
      },
    ],
    ctas: ["Add expense", "Log note"],
    gridSpan: 2,
  },
  {
    id: "evening",
    label: "Evening reflection",
    headline: "Close the loop gently.",
    subhead: "Capture a journal, mark expenses settled, and nudge tomorrow’s Flow.",
    emoji: "🌙",
    gradient: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
    background: "border-slate-800 text-white",
    details: [
      {
        title: "Reflection",
        description: "Journal prompt, mood picker, and photo capture.",
      },
      {
        title: "Group actions",
        description: "Add expense, confirm settlement, or share link.",
      },
      {
        title: "Flow streak",
        description: "Shows wins + open loops to carry forward.",
      },
    ],
    ctas: ["Add journal", "Add photo"],
    gridSpan: 1,
  },
  {
    id: "sunday",
    label: "Sunday digest",
    headline: "Plan the week with receipts.",
    subhead: "AI recap, Orbit saves, and Flow timeline combine into a ritual planning session.",
    emoji: "📅",
    gradient: "bg-gradient-to-br from-white via-indigo-50 to-white",
    background: "border-indigo-100",
    details: [
      {
        title: "Digest",
        description: "Summaries of tasks, reflections, and spend.",
      },
      {
        title: "Orbit sparks",
        description: "Saved links that deserve a slot next week.",
      },
    ],
    ctas: ["Review AI notes", "Plan Flow"],
    gridSpan: 1,
  },
];

const WEEKLY_HOOKS = [
  {
    label: "Morning calm",
    description: "Flow + balances answer “What’s due?” before Slack can derail them.",
  },
  {
    label: "Evening reflection",
    description: "Journal + expenses close loops so they sleep better.",
  },
  {
    label: "Sunday digest",
    description: "AI highlights + Orbit links feed the planning ritual.",
  },
];

const SOCIAL_PROOF = [
  {
    name: "Priya, Brooklyn",
    role: "Family COO",
    quote:
      "We tell Toodl the grocery run once and it updates Split, Pulse, and my partner’s reminders. Zero follow-up needed.",
  },
  {
    name: "Jon + April",
    role: "Wedding planners",
    quote:
      "Vendors, budgets, journal entries, and Flow anchors stay aligned. AI recaps keep the whole bridal party calm.",
  },
  {
    name: "Marcus",
    role: "Startup operator",
    quote:
      "Orbit replaced six bookmarking apps. The dashboard loops me back through saved gems every Sunday so I actually use them.",
  },
];

type LandingPageProps = {
  onGoogle: () => void;
  onMicrosoft: () => void;
  onFacebook: () => void;
  onContinueWithoutSignIn: () => void;
};

export function LandingPage({
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
              <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-xl">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span className="font-semibold text-slate-900">Morning dashboard</span>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI-ready
                  </span>
                </div>
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Groups</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">$482 owed · $181 due</p>
                    <p className="text-xs text-slate-500">Balances update every time you log or settle.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Budget</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-600">$1,240 remaining</p>
                    <p className="text-xs text-slate-500">Projected to finish under by $180.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Flow</p>
                    <p className="mt-2 text-sm text-slate-700">
                      ✅ 7am - Deep work block
                      <br />
                      ✅ 10am - Vendor call
                      <br />
                      ⏳ 4pm - Budget review
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-sm text-slate-500">
                  <p className="font-semibold text-slate-700">“Add expense + reflection”</p>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DailyTriggersSection />
      <RitualLoopSection />
      <DailyDashboardShowcase />
      <PhotoIntegrationCallout />
      <WorkflowSection />
      <FeatureSection />
      <SocialProofSection />
      <LoopSummarySection />

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

function DailyTriggersSection() {
  return (
    <section className="border-y border-slate-100 bg-white/90">
      <div className="mx-auto max-w-6xl px-6 py-16 space-y-10">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Psych triggers</p>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            Why people come back every single day.
          </h2>
          <p className="text-base text-slate-600">
            Orientation, completion, and continuity are baked into the dashboard loop.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {DAILY_TRIGGERS.map((trigger) => (
            <div
              key={trigger.name}
              className="rounded-3xl border border-slate-100 bg-slate-50/60 p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-500">
                {trigger.name}
              </p>
              <p className="mt-3 text-base font-semibold text-slate-900">{trigger.question}</p>
              <p className="mt-4 text-sm text-slate-600">{trigger.tactic}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RitualLoopSection() {
  return (
    <section className="bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="space-y-3 text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-300">See → Do → Feel → Reflect</p>
          <h2 className="text-3xl font-bold md:text-4xl">The loop that upgrades a tool into a ritual.</h2>
          <p className="text-base text-slate-300">
            The home screen answers what to see, what to do, how to feel, and when to reflect—every single day.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {RITUAL_LOOP.map((item) => (
            <div
              key={item.stage}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-emerald-200">{item.stage}</p>
              <p className="mt-3 text-sm text-slate-100">{item.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DailyDashboardShowcase() {
  return (
    <section className="bg-gradient-to-b from-[#fff8f0] via-white to-slate-50/60">
      <div className="mx-auto max-w-6xl px-6 py-20 space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Home screen snapshots</p>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">How the dashboard greets every moment.</h2>
          <p className="text-base text-slate-600">
            Built for mornings, evenings, weekly recaps, and the memory lane that keeps people emotionally invested.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {DASHBOARD_SNAPSHOTS.map((snapshot) => (
            <div
              key={snapshot.id}
              className={`${snapshot.gridSpan === 2 ? "lg:col-span-2" : ""}`}
            >
              <SnapshotCard snapshot={snapshot} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type Snapshot = typeof DASHBOARD_SNAPSHOTS[number];

function SnapshotCard({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div
      className={`h-full rounded-3xl border ${snapshot.gradient} ${snapshot.background} p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
            {snapshot.label}
          </p>
          <h3 className="mt-2 text-2xl font-semibold">{snapshot.headline}</h3>
          <p className="mt-1 text-sm text-slate-600/90">{snapshot.subhead}</p>
        </div>
        <span className="text-3xl">{snapshot.emoji}</span>
      </div>
      <div className="mt-4 space-y-3">
        {snapshot.details.map((detail) => (
          <div key={`${snapshot.id}-${detail.title}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              {detail.title}
            </p>
            <p className="mt-1 text-sm text-slate-700">{detail.description}</p>
          </div>
        ))}
      </div>
      {snapshot.ctas && (
        <div className="mt-6 flex flex-wrap gap-3">
          {snapshot.ctas.map((cta) => (
            <span
              key={`${snapshot.id}-${cta}`}
              className="inline-flex items-center rounded-full border border-slate-200/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600"
            >
              + {cta}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoIntegrationCallout() {
  return (
    <section className="border-y border-slate-100 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Light-touch photos</p>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            Attach a photo anywhere, revisit it in the timeline gallery.
          </h2>
          <p className="text-base text-slate-600">
            The home screen isn’t chasing social feeds. It uses photos to keep memories alive—attach to a journal, expense,
            or Flow task, then see them pop back up when you need motivation.
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• “Add photo” button lives beside journal + expense compose.</li>
            <li>• Timeline shows “Your month in review” with lightly animated frames.</li>
            <li>• AI Digest cherry-picks two moments every Sunday.</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-6 shadow-sm">
          <div className="space-y-4 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-500">Mock preview</p>
            <p className="text-base font-semibold text-slate-900">
              “Your month in review” gallery
            </p>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`photo-${index}`}
                  className="h-20 rounded-2xl bg-gradient-to-br from-slate-200 via-white to-slate-100 shadow-inner"
                />
              ))}
            </div>
            <p>
              Lightweight resurfacing keeps family users emotionally hooked without building a full social network.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className="border-y border-slate-100 bg-white/95">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Workflow</p>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">One conversation powers every lane.</h2>
          <p className="text-base text-slate-600">
            Start with the AI Mind, then watch Split, Pulse, Story, Flow, and Orbit stay perfectly in sync.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {WORKFLOW_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="flex h-full flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-sm"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
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
  );
}

function SocialProofSection() {
  return (
    <section className="border-y border-slate-100 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Social proof</p>
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
  );
}

function LoopSummarySection() {
  return (
    <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="mx-auto max-w-6xl px-6 py-16 space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-300">Daily hook</p>
          <h2 className="text-3xl font-bold md:text-4xl">Morning → Evening → Sunday.</h2>
          <p className="text-base text-slate-200">
            That cadence is how the app turns into a ritual instead of “yet another tool.”
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {WEEKLY_HOOKS.map((hook) => (
            <div
              key={hook.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-emerald-200">
                {hook.label}
              </p>
              <p className="mt-3 text-sm text-slate-100">{hook.description}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-200">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2">
            Morning CTA → “What’s due? Where do we stand?”
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2">
            Evening CTA → “Add expense + reflection”
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2">
            Sunday CTA → “Read digest · Plan next week”
          </span>
        </div>
      </div>
    </section>
  );
}

export type { LandingPageProps };
