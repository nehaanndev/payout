"use client";

import { cn } from "@/lib/utils";

type ProgressProps = {
  value?: number;
  className?: string;
};

const clamp = (val: number) => Math.max(0, Math.min(100, val));

export const Progress = ({ value = 0, className }: ProgressProps) => (
  <div
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-slate-200",
      className
    )}
  >
    <div
      className="h-full rounded-full bg-slate-900 transition-all"
      style={{ width: `${clamp(value)}%` }}
    />
  </div>
);
