"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const PRODUCT_META: Record<
  "expense" | "budget" | "journal",
  {
    title: string;
    subtitle: string;
    icon: string;
    accent: string;
  }
> = {
  expense: {
    title: "Toodl Expense Splitter",
    subtitle: "Invite friends, track what’s owed, and settle fast.",
    icon: "/brand/toodl-expense.svg",
    accent: "from-slate-900 via-slate-800 to-slate-900",
  },
  budget: {
    title: "Toodl Budget Studio",
    subtitle: "Plan spending, track categories, and stay on pace.",
    icon: "/brand/toodl-budget.svg",
    accent: "from-emerald-600 via-teal-600 to-emerald-600",
  },
  journal: {
    title: "Toodl Journal",
    subtitle: "Capture today’s stories and revisit them anytime.",
    icon: "/brand/toodl-journal.svg",
    accent: "from-rose-500 via-amber-400 to-sky-500",
  },
};

export function AppTopBar({
  product,
  heading,
  subheading,
  actions,
  userSlot,
  className,
}: {
  product: "expense" | "budget" | "journal";
  heading?: string;
  subheading?: string;
  actions?: React.ReactNode;
  userSlot?: React.ReactNode;
  className?: string;
}) {
  const meta = PRODUCT_META[product];

  return (
    <header
      className={cn(
        "relative mb-6 overflow-visible rounded-3xl border border-slate-200 bg-white/80 px-6 py-5 shadow-[0_15px_45px_-25px_rgba(15,23,42,0.45)] backdrop-blur",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/40 to-white/10" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Image
            src={meta.icon}
            alt={`${product} icon`}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0"
            priority
          />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
              {heading ?? meta.title}
            </h1>
            <p className="text-sm text-slate-500 md:text-base">
              {subheading ?? meta.subtitle}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          {actions ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{actions}</div> : null}
          {userSlot}
        </div>
      </div>
    </header>
  );
}
