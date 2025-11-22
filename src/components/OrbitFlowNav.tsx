"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    id: "orbit",
    label: "Orbit",
    href: "/orbit",
    accent: "from-indigo-500 via-violet-500 to-sky-500",
  },
  {
    id: "flow",
    label: "Flow",
    href: "/flow",
    accent: "from-emerald-500 via-teal-500 to-amber-400",
  },
];

export function OrbitFlowNav({ isNight = false }: { isNight?: boolean }) {
  const pathname = usePathname();

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-full border p-1 shadow-sm",
      isNight
        ? "border-white/20 bg-white/10"
        : "border-slate-200 bg-white/60"
    )}>
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          pathname.startsWith(`${item.href}/`) ||
          (item.id === "orbit" && pathname.startsWith("/scratch-pad"));

        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "relative inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold transition",
              active
                ? isNight
                  ? "text-slate-900"
                  : "text-slate-900"
                : isNight
                ? "text-slate-300 hover:text-white hover:bg-white/20"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/80"
            )}
          >
            {active ? (
              <span
                className={cn(
                  "absolute inset-0 -z-10 rounded-full bg-gradient-to-r opacity-90 transition",
                  item.accent
                )}
              />
            ) : null}
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
