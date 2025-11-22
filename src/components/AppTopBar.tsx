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
  },
  night: {
    id: "night" as const,
    label: "Night",
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
        "rounded-[32px] border backdrop-blur px-4 py-5 md:px-6",
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
              {mobileUserSlot ? (
                <div className="flex-shrink-0 md:hidden flex flex-col items-end gap-2">
                  {mobileUserSlot}
                  {currentTheme && onThemeChange ? (
                    <div className={cn(
                      "flex gap-2 rounded-full border p-1 text-xs font-semibold",
                      dark
                        ? "border-white/40 bg-white/20 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    )}>
                      {Object.values(THEMES).map((option) => (
                        <button
                          key={option.id}
                          onClick={() => onThemeChange(option.id)}
                          className={cn(
                            "rounded-full px-3 py-1 transition",
                            currentTheme === option.id
                              ? dark
                                ? "bg-white/80 text-slate-900"
                                : "bg-white text-slate-900"
                              : dark
                                ? "text-white/80 hover:text-white"
                                : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
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
          {desktopUserSlot ? (
            <div className="hidden md:flex md:flex-col md:items-end md:gap-2">
              {desktopUserSlot}
              {currentTheme && onThemeChange ? (
                <div className={cn(
                  "flex gap-2 rounded-full border p-1 text-xs font-semibold",
                  dark
                    ? "border-white/40 bg-white/20 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                )}>
                  {Object.values(THEMES).map((option) => (
                    <button
                      key={option.id}
                      onClick={() => onThemeChange(option.id)}
                      className={cn(
                        "rounded-full px-3 py-1 transition",
                        currentTheme === option.id
                          ? dark
                            ? "bg-white/80 text-slate-900"
                            : "bg-white text-slate-900"
                          : dark
                            ? "text-white/80 hover:text-white"
                            : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
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
