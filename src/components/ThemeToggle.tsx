"use client";

import { cn } from "@/lib/utils";
import type { ToodlTheme } from "@/hooks/useToodlTheme";

type ThemeToggleProps = {
  theme: ToodlTheme;
  onSelect: (theme: ToodlTheme) => void;
  className?: string;
};

const OPTIONS: Array<{ id: ToodlTheme; label: string }> = [
  { id: "morning", label: "Morning" },
  { id: "night", label: "Night" },
];

export function ThemeToggle({ theme, onSelect, className }: ThemeToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border px-1 py-1 text-xs font-semibold shadow-sm",
        theme === "night"
          ? "border-white/30 bg-slate-900/60 text-white"
          : "border-slate-200 bg-white/80 text-slate-600",
        className
      )}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onSelect(option.id)}
          className={cn(
            "rounded-full px-3 py-1 transition",
            theme === option.id
              ? option.id === "night"
                ? "bg-white/10 text-white"
                : "bg-white text-slate-900"
              : option.id === "night"
                ? "text-white/70 hover:text-white"
                : "text-slate-500 hover:text-slate-800"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
