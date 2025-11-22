"use client";

import { cn } from "@/lib/utils";

type ProgressProps = {
  value?: number;
  className?: string;
  isNight?: boolean;
};

const clamp = (val: number) => Math.max(0, Math.min(100, val));

export const Progress = ({ value = 0, className, isNight = false }: ProgressProps) => (
  <div
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full",
      isNight ? "bg-white/10" : "bg-slate-200",
      className
    )}
  >
    <div
      className={cn(
        "h-full rounded-full transition-all",
        isNight ? "bg-white/40" : "bg-slate-900"
      )}
      style={{ width: `${clamp(value)}%` }}
    />
  </div>
);
