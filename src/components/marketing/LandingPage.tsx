"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Brain,
  MessageCircle,
  Sparkles,
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
    tagline: "Split bills with friends",
    icon: "/brand/toodl-expense.svg",
    accent: "from-slate-900/10 via-slate-800/5 to-slate-900/0",
    description: "Track shared expenses and settle up instantly.",
    href: "/split",
  },
  {
    name: "Pulse",
    tagline: "Track your budget",
    icon: "/brand/toodl-budget.svg",
    accent: "from-emerald-500/15 via-teal-400/10 to-emerald-500/0",
    description: "See where your money goes and stay on track.",
    href: "/budget",
  },
  {
    name: "Story",
    tagline: "Journal your days",
    icon: "/brand/toodl-journal.svg",
    accent: "from-rose-400/15 via-amber-300/10 to-sky-400/0",
    description: "Capture memories and reflections alongside your spend.",
    href: "/journal",
  },
  {
    name: "Flow",
    tagline: "Plan your schedule",
    icon: "/brand/toodl-flow.svg",
    accent: "from-emerald-400/15 via-teal-300/10 to-amber-200/0",
    description: "Organize your day with tasks and focus blocks.",
    href: "/flow",
  },
  {
    name: "Orbit",
    tagline: "Save important things",
    icon: "/brand/toodl-orbit.svg",
    accent: "from-indigo-500/15 via-violet-400/10 to-blue-400/0",
    description: "Keep receipts, documents, and links in one place.",
    href: "/orbit",
  },
];

type WorkflowStep = {
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const HOW_IT_WORKS_STEPS: WorkflowStep[] = [
  {
    title: "Chat",
    description:
      "Tell Toodl what’s happening—like buying groceries or planning a trip.",
    icon: MessageCircle,
  },
  {
    title: "Plan",
    description:
      "Toodl organizes it into the right app: Split, Pulse, Flow, or Orbit.",
    icon: Brain,
  },
  {
    title: "Relax",
    description: "Stay on top of your money and time without the stress.",
    icon: Sparkles,
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
              <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Plan your life.
              </h1>
              <p className="text-lg text-slate-600 lg:text-xl">
                One app for your money, tasks, journals, and family.
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
                    What each helper does
                  </p>
                  <span className="text-[11px] font-medium uppercase tracking-[0.35em] text-emerald-500">
                    Bills · Budget · Plan · Journal · Save
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

      <HowItWorksSection />
      <DailyDashboardShowcase />
      <SocialProofSection />

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



function HowItWorksSection() {
  return (
    <section className="border-y border-slate-100 bg-white/95">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">How it works</p>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">One conversation powers everything.</h2>
          <p className="text-base text-slate-600">
            Just talk to Toodl, and it handles the rest.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step) => {
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



export type { LandingPageProps };
