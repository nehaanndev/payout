"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Activity,
    Home,
    LogOut,
    NotebookPen,
    Sparkles,
    Wallet,
    Workflow,
    Globe,
    Moon,
    Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToodlTheme } from "@/hooks/useToodlTheme";
import { type User } from "firebase/auth";
import Image from "next/image";

import { type UserTier } from "@/types/user";

type AppSidebarProps = {
    user: User | null;
    isAnon?: boolean;
    tier?: UserTier;
    onSignOut: () => void;
};

export function AppSidebar({ user, isAnon = false, tier = 'free', onSignOut }: AppSidebarProps) {
    const pathname = usePathname();
    const { isNight, setTheme } = useToodlTheme();

    const NAV_ITEMS = [
        {
            label: "Dashboard",
            href: "/dashboard",
            icon: Home,
        },
        {
            label: "Split",
            href: "/split",
            icon: Wallet,
        },
        {
            label: "Pulse",
            href: "/budget",
            icon: Activity,
        },
        {
            label: "Story",
            href: "/journal",
            icon: NotebookPen,
        },
        {
            label: "Flow",
            href: "/flow",
            icon: Workflow,
        },
        {
            label: "Orbit",
            href: "/orbit",
            icon: Globe,
        },
    ];

    const handleOpenToodlMind = () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("open-toodl-mind"));
        }
    };

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-50 hidden h-screen w-16 flex-col items-center justify-between border-r py-6 transition-colors duration-300 md:flex",
                isNight
                    ? "bg-white border-slate-200"
                    : "bg-slate-900 border-slate-800"
            )}
        >
            <div className="flex flex-col items-center gap-8">
                <button
                    onClick={handleOpenToodlMind}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg transition-transform hover:scale-105 active:scale-95"
                    title="Open Toodl Mind"
                >
                    <Sparkles className="h-5 w-5 text-white" />
                </button>

                <nav className="flex flex-col gap-4">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                                    isActive
                                        ? isNight
                                            ? "bg-slate-100 text-slate-900"
                                            : "bg-white/10 text-white"
                                        : isNight
                                            ? "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                                            : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                                )}
                                title={item.label}
                            >
                                <Icon className="h-5 w-5" />
                                {isActive && (
                                    <div className={cn(
                                        "absolute -right-1 top-1/2 h-8 w-1 -translate-y-1/2 rounded-l-full",
                                        isNight ? "bg-slate-900" : "bg-white"
                                    )} />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="flex flex-col items-center gap-4">
                <button
                    onClick={() => setTheme(isNight ? "morning" : "night")}
                    className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                        isNight
                            ? "text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                            : "text-slate-500 hover:bg-white/5 hover:text-white"
                    )}
                    title={isNight ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {isNight ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                {(user || isAnon) && (
                    <>
                        <div className={cn(
                            "flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            tier === 'plus'
                                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                                : isNight
                                    ? "bg-slate-100 text-slate-500"
                                    : "bg-white/10 text-slate-400"
                        )}>
                            {tier}
                        </div>
                        <button
                            onClick={onSignOut}
                            className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                                isNight
                                    ? "text-slate-400 hover:bg-red-50 hover:text-red-600"
                                    : "text-slate-500 hover:bg-white/5 hover:text-red-400"
                            )}
                            title="Sign out"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                    </>
                )}

                {user?.photoURL ? (
                    <Image
                        src={user.photoURL}
                        alt={user.displayName ?? "User"}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full border-2 border-white/10 object-cover"
                    />
                ) : (user || isAnon) ? (
                    <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold",
                        isNight
                            ? "border-slate-200 bg-slate-100 text-slate-600"
                            : "border-white/10 bg-white/10 text-white"
                    )}>
                        {user?.displayName?.charAt(0).toUpperCase() ?? "G"}
                    </div>
                ) : null}
            </div>
        </aside>
    );
}
