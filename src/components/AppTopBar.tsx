"use client";

import Image from "next/image";
import { cloneElement, isValidElement, useMemo } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const PRODUCT_META = {
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
  orbit: {
    title: "Toodl Orbit",
    subtitle: "Collect sparks of inspiration to revisit when it counts.",
    icon: "/brand/toodl-mark.svg",
    accent: "from-indigo-500 via-violet-500 to-sky-500",
  },
  flow: {
    title: "Toodl Flow",
    subtitle: "Design your day, balance priorities, and stay on tempo.",
    icon: "/brand/toodl-mark.svg",
    accent: "from-emerald-500 via-teal-500 to-amber-400",
  },
} as const;

type ProductKey = keyof typeof PRODUCT_META;

export function AppTopBar({
  product,
  heading,
  subheading,
  actions,
  userSlot,
  className,
}: {
  product: ProductKey;
  heading?: ReactNode;
  subheading?: ReactNode;
  actions?: React.ReactNode;
  userSlot?: React.ReactNode;
  className?: string;
}) {
  const meta = PRODUCT_META[product];
  const mobileUserSlot = useMemo(() => {
    if (!userSlot) {
      return null;
    }
    if (isValidElement(userSlot)) {
      return cloneElement(userSlot, { key: "mobile" });
    }
    return userSlot;
  }, [userSlot]);

  const desktopUserSlot = useMemo(() => {
    if (!userSlot) {
      return null;
    }
    if (isValidElement(userSlot)) {
      return cloneElement(userSlot, { key: "desktop" });
    }
    return userSlot;
  }, [userSlot]);

  return (
    <header
      className={cn(
        "relative z-[30] mb-6 overflow-visible rounded-3xl border border-slate-200 bg-white/80 px-4 py-5 shadow-[0_15px_45px_-25px_rgba(15,23,42,0.45)] backdrop-blur md:px-6",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/40 to-white/10" />
      <div className="relative flex flex-col gap-4 md:gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 md:gap-4">
              {mobileUserSlot ? (
                <div className="flex-shrink-0 md:hidden">{mobileUserSlot}</div>
              ) : null}
              <div className="flex items-center gap-3 md:gap-4">
                <Image
                  src={meta.icon}
                  alt={`${product} icon`}
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0"
                  priority
                />
                <div className="space-y-1">
                  {(() => {
                    const headingContent = heading ?? meta.title;
                    if (isValidElement(headingContent)) {
                      return (
                        <div className="text-lg font-semibold text-slate-900 md:text-2xl">
                          {headingContent}
                        </div>
                      );
                    }
                    if (
                      typeof headingContent === "string" ||
                      typeof headingContent === "number"
                    ) {
                      return (
                        <h1 className="text-lg font-semibold text-slate-900 md:text-2xl">
                          {headingContent}
                        </h1>
                      );
                    }
                    return (
                      <div className="text-lg font-semibold text-slate-900 md:text-2xl">
                        {headingContent}
                      </div>
                    );
                  })()}
                  {(() => {
                    const subheadingContent = subheading ?? meta.subtitle;
                    if (!subheadingContent) {
                      return null;
                    }
                    if (isValidElement(subheadingContent)) {
                      return (
                        <div className="text-xs text-slate-500 md:text-base">
                          {subheadingContent}
                        </div>
                      );
                    }
                    if (
                      typeof subheadingContent === "string" ||
                      typeof subheadingContent === "number"
                    ) {
                      return (
                        <p className="text-xs text-slate-500 md:text-base">
                          {subheadingContent}
                        </p>
                      );
                    }
                    return (
                      <div className="text-xs text-slate-500 md:text-base">
                        {subheadingContent}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
          {desktopUserSlot ? (
            <div className="hidden md:flex">{desktopUserSlot}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
