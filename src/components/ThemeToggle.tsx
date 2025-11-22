"use client";

import { cn } from "@/lib/utils";
import type { ToodlTheme } from "@/hooks/useToodlTheme";
import { theme } from "@/lib/theme";

type ThemeToggleProps = {
  theme: ToodlTheme;
  onSelect: (theme: ToodlTheme) => void;
  className?: string;
};

const OPTIONS: Array<{ id: ToodlTheme; label: string }> = [
  { id: "morning", label: "Morning" },
  { id: "night", label: "Night" },
];

export function ThemeToggle({ theme: currentTheme, onSelect, className }: ThemeToggleProps) {
  const isNight = currentTheme === "night";
  
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border px-1 py-1 text-xs font-semibold shadow-sm",
        theme.border.default(isNight),
        isNight ? "bg-slate-900/60" : "bg-white/80",
        theme.text.secondary(isNight),
        className
      )}
    >
      {OPTIONS.map((option) => {
        const isSelected = currentTheme === option.id;
        const optionIsNight = option.id === "night";
        
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={cn(
              "rounded-full px-3 py-1 transition",
              isSelected
                ? optionIsNight
                  ? "bg-white/10 text-white"
                  : "bg-white text-slate-900"
                : optionIsNight
                  ? isNight
                    ? "text-white/70 hover:text-white"
                    : "text-slate-500 hover:text-slate-800"
                  : "text-slate-500 hover:text-slate-800"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
