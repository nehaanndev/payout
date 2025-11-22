"use client";

import Image from "next/image";
import { cloneElement, isValidElement, useMemo } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { theme, themeClasses } from "@/lib/theme";
import type { ToodlTheme } from "@/hooks/useToodlTheme";

const PRODUCT_META = {
  expense: {
    title: "Toodl Split",
    subtitle: "Invite friends, log what happened, and let AI settle tabs fast.",
    icon: "/brand/toodl-expense.svg",
    accent: "from-slate-900 via-slate-800 to-slate-900",
  },
  budget: {
    title: "Toodl Pulse",
    subtitle: "Keep budgets, cash, and goals in rhythm with live projections.",
    icon: "/brand/toodl-budget.svg",
    accent: "from-emerald-600 via-teal-600 to-emerald-600",
  },
  journal: {
    title: "Toodl Story",
    subtitle: "Capture today’s stories beside the numbers and revisit anytime.",
    icon: "/brand/toodl-journal.svg",
    accent: "from-rose-500 via-amber-400 to-sky-500",
  },
  orbit: {
    title: "Toodl Orbit",
    subtitle: "Collect sparks of inspiration to revisit when it counts.",
    icon: "/brand/toodl-orbit.svg",
    accent: "from-indigo-500 via-violet-500 to-sky-500",
  },
  flow: {
    title: "Toodl Flow",
    subtitle: "Design your day, balance priorities, and stay on tempo.",
    icon: "/brand/toodl-flow.svg",
    accent: "from-emerald-500 via-teal-500 to-amber-400",
  },
} as const;

type ProductKey = keyof typeof PRODUCT_META;

const THEMES = {
  morning: {
    id: "morning" as const,
    label: "Morning",
    emoji: "☀️",
  },
  night: {
    id: "night" as const,
    label: "Night",
    emoji: "🌙",
  },
} as const;

export function AppTopBar({
  product,
  heading,
  subheading,
  actions,
  userSlot,
  className,
  dark = false,
  theme: currentTheme,
  onThemeChange,
}: {
  product: ProductKey;
  heading?: ReactNode;
  subheading?: ReactNode;
  actions?: React.ReactNode;
  userSlot?: React.ReactNode;
  className?: string;
  dark?: boolean;
  theme?: ToodlTheme;
  onThemeChange?: (theme: ToodlTheme) => void;
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

  const headingTextClass = theme.text.primary(dark);
  const subheadingTextClass = theme.text.tertiary(dark);
  const containerColors = dark
    ? cn(
        "rounded-[32px] border backdrop-blur px-4 py-6 md:px-6",
        "border-white/40 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white shadow-lg"
      )
    : themeClasses.topBar(dark);
  const overlayClass = dark
    ? "" // No overlay needed in night mode - gradient is the background
    : "bg-gradient-to-r from-white/70 via-white/40 to-white/10";

  return (
    <header
      className={cn(
        "relative z-[30] mb-6 overflow-visible",
        containerColors,
        className
      )}
    >
      {!dark && <div className={cn("pointer-events-none absolute inset-0 rounded-[32px]", overlayClass)} />}
      <div className="relative flex flex-col gap-4 md:gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
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
                        <div className={cn("text-lg font-semibold md:text-2xl", headingTextClass)}>
                          {headingContent}
                        </div>
                      );
                    }
                    if (
                      typeof headingContent === "string" ||
                      typeof headingContent === "number"
                    ) {
                      return (
                        <h1 className={cn("text-lg font-semibold md:text-2xl", headingTextClass)}>
                          {headingContent}
                        </h1>
                      );
                    }
                    return (
                      <div className={cn("text-lg font-semibold md:text-2xl", headingTextClass)}>
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
                        <div className={cn("text-xs md:text-base", subheadingTextClass)}>
                          {subheadingContent}
                        </div>
                      );
                    }
                    if (
                      typeof subheadingContent === "string" ||
                      typeof subheadingContent === "number"
                    ) {
                      return (
                        <p className={cn("text-xs md:text-base", subheadingTextClass)}>
                          {subheadingContent}
                        </p>
                      );
                    }
                    return (
                      <div className={cn("text-xs md:text-base", subheadingTextClass)}>
                        {subheadingContent}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      {desktopUserSlot ? (
        <div className="absolute top-2 right-4 hidden md:flex">
          {desktopUserSlot}
        </div>
      ) : null}
      {mobileUserSlot ? (
        <div className="absolute top-2 right-4 md:hidden">
          {mobileUserSlot}
        </div>
      ) : null}
      {currentTheme && onThemeChange ? (
        <div className={cn(
          "absolute bottom-2 right-4 flex gap-1 rounded-full border p-0.5",
          dark
            ? "border-white/30 bg-white/10"
            : "border-slate-200 bg-slate-50/80"
        )}>
          {Object.values(THEMES).map((option) => (
            <button
              key={option.id}
              onClick={() => onThemeChange(option.id)}
              className={cn(
                "flex items-center justify-center rounded-full px-2 py-1 text-[10px] transition-all",
                currentTheme === option.id
                  ? dark
                    ? "bg-white/20 text-white shadow-sm"
                    : "bg-white text-slate-900 shadow-sm"
                  : dark
                    ? "text-white/60 hover:text-white/80"
                    : "text-slate-400 hover:text-slate-600"
              )}
              title={option.label}
            >
              <span className="text-sm leading-none">{option.emoji}</span>
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}
