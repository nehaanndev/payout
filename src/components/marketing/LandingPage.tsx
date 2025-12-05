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
    title: "Plan your day with Flow",
    description:
      "Start each morning by planning your tasks and schedule. Add reflections throughout the day to stay mindful.",
    icon: Brain,
  },
  {
    title: "Save what matters in Orbit",
    description:
      "Found something interesting? A recipe, an article, a gift idea? Save it to Orbit and revisit when ready.",
    icon: Sparkles,
  },
  {
    title: "Manage money with Pulse & Split",
    description:
      "Track your budget in Pulse and split bills with friends. Keep your finances transparent and stress-free.",
    icon: MessageCircle,
  },
  {
    title: "Reflect with Story",
    description:
      "End your day with a personal journal entry. Capture your thoughts, wins, and gratitude.",
    icon: Brain,
  },
  {
    title: "Toodl Mind ties it all together",
    description:
      "Talk to Toodl Mind and it routes your requests to the right app. One AI assistant for your whole life.",
    icon: Sparkles,
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
              <div className="flex items-center gap-3">
                <Image
                  src="/brand/toodl-logo.png"
                  alt="Toodl"
                  width={48}
                  height={48}
                  className="h-12 w-12"
                />
                <span className="text-2xl font-bold tracking-tight text-slate-900">Toodl</span>
              </div>
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
      <FeatureShowcase />
      <SocialProofSection />

      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-emerald-50 border-t border-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.15),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Image
              src="/brand/toodl-logo.png"
              alt="Toodl"
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <span className="text-xl font-bold tracking-tight text-slate-900">Toodl</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            Ready to start the AI conversation that runs your ledger?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
            Say it once, let the AI Mind remember it, then split bills, plan budgets, capture journals, spin up Flow, and organize Orbit—all with a single sign-in.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
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
          <button
            type="button"
            onClick={onContinueWithoutSignIn}
            className="mt-6 inline-flex items-center text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            Prefer to explore without signing in
          </button>
        </div>
      </section>
    </div>
  );
}





function FeatureShowcase() {
  return (
    <div className="flex flex-col gap-24 py-24">
      {/* Section 1: The Command Center */}
      <section className="mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-2 lg:items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Your daily command center.
            </h2>
            <p className="text-lg text-slate-600">
              See a snapshot of your day as it progresses. Missed something important yesterday? Toodl brings it forward so nothing slips through the cracks.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Just ask Toodl Mind</h3>
                <p className="text-slate-600">
                  &quot;Add $45 for groceries&quot; or &quot;Add $350 for Restaurant bill to the roommates group&quot;. It handles the math and the splitting.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Search across your life</h3>
                <p className="text-slate-600">
                  Find a flow anchor, a split expense, or an orbit save—all from one search bar.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            <Image
              src="/showcase/dashboard.png"
              alt="Dashboard Snapshot"
              width={600}
              height={400}
              className="w-full object-cover"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <Image
                src="/showcase/search.png"
                alt="Search Anything"
                width={300}
                height={200}
                className="w-full object-cover"
              />
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <Image
                src="/showcase/daily-moves.png"
                alt="Daily Recommendations"
                width={300}
                height={200}
                className="w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Learn and Grow */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-2 lg:items-center">
          <div className="order-2 lg:order-1">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
              <Image
                src="/showcase/learning.png"
                alt="Learning Paths"
                width={600}
                height={400}
                className="w-full object-cover"
              />
            </div>
          </div>
          <div className="order-1 space-y-6 lg:order-2">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Learn something new every day.
            </h2>
            <p className="text-lg text-slate-600">
              Let the AI teach you a new skill in bite-sized lessons. Ask questions, get answers, and track your progress daily. It&apos;s painless growth on your schedule.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Reflection History */}
      <section className="mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            Your story, in focus.
          </h2>
          <p className="text-lg text-slate-600">
            Build a rich history of reflections with photos. Watch your personal journey unfold over time, organized and beautifully presented.
          </p>
        </div>
        <div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            <Image
              src="/showcase/reflections.png"
              alt="Reflection History"
              width={600}
              height={400}
              className="w-full object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}



function HowItWorksSection() {
  return (
    <section className="border-y border-slate-100 bg-white/95">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">How it works</p>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Your day, simplified.</h2>
          <p className="text-base text-slate-600">
            From morning planning to evening reflection—Toodl keeps everything in one place.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
