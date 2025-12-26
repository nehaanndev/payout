"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
    Activity,
    Home,
    LogOut,
    Menu,
    NotebookPen,
    Sparkles,
    Wallet,
    Workflow,
    Globe,
    Moon,
    Sun,
    Settings,
    MessageSquare,
    Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToodlTheme } from "@/hooks/useToodlTheme";
import { type User } from "firebase/auth";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

import { type UserTier } from "@/types/user";

type MobileNavProps = {
    user: User | null;
    isAnon?: boolean;
    tier?: UserTier;
    onSignOut: () => void;
};

import { UpgradeDialog } from "@/components/UpgradeDialog";

export function MobileNav({ user, isAnon = false, tier = 'free', onSignOut }: MobileNavProps) {
    const pathname = usePathname();
    const { isNight, setTheme } = useToodlTheme();
    const [open, setOpen] = useState(false);
    const [upgradeOpen, setUpgradeOpen] = useState(false);

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
        {
            label: "Quest",
            href: "/quest",
            icon: Target,
        },
    ];

    const handleOpenToodlMind = () => {
        setOpen(false);
        // Dispatch event to open Toodl Mind
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("open-toodl-mind"));
        }
    };

    return (
        <>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "fixed left-4 top-4 z-40 md:hidden",
                            isNight ? "text-white hover:bg-white/10" : "text-slate-900 hover:bg-slate-100"
                        )}
                    >
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent
                    side="left"
                    className={cn(
                        "flex w-[300px] flex-col border-r p-0",
                        isNight ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                    )}
                >
                    <SheetHeader className="px-6 pt-6 text-left">
                        <SheetTitle className={cn("flex items-center gap-2", isNight ? "text-white" : "text-slate-900")}>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                            Toodl
                        </SheetTitle>
                    </SheetHeader>

                    <div className="flex flex-1 flex-col justify-between px-4 py-6">
                        <nav className="flex flex-col gap-2">
                            <button
                                onClick={handleOpenToodlMind}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                                    isNight
                                        ? "text-indigo-300 hover:bg-white/5 hover:text-indigo-200"
                                        : "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                                )}
                            >
                                <Sparkles className="h-5 w-5" />
                                Ask Toodl Mind
                            </button>

                            <div className={cn("my-2 h-px", isNight ? "bg-slate-800" : "bg-slate-100")} />

                            {NAV_ITEMS.map((item) => {
                                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                                const Icon = item.icon;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                                            isActive
                                                ? isNight
                                                    ? "bg-slate-800 text-white"
                                                    : "bg-slate-100 text-slate-900"
                                                : isNight
                                                    ? "text-slate-400 hover:bg-white/5 hover:text-slate-300"
                                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                        )}
                                    >
                                        <Icon className="h-5 w-5" />
                                        {item.label}
                                    </Link>
                                );
                            })}

                            <Link
                                href="/settings"
                                onClick={() => setOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                                    isNight
                                        ? "text-slate-400 hover:bg-white/5 hover:text-slate-300"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                )}
                            >
                                <Settings className="h-5 w-5" />
                                Settings
                            </Link>

                            <Link
                                href="/feedback"
                                onClick={() => setOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                                    pathname === "/feedback"
                                        ? isNight
                                            ? "bg-slate-800 text-white"
                                            : "bg-slate-100 text-slate-900"
                                        : isNight
                                            ? "text-slate-400 hover:bg-white/5 hover:text-slate-300"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                )}
                            >
                                <MessageSquare className="h-5 w-5" />
                                Feedback
                            </Link>

                            <div className={cn("my-2 h-px", isNight ? "bg-slate-800" : "bg-slate-100")} />

                            <button
                                onClick={() => setTheme(isNight ? "morning" : "night")}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                                    isNight
                                        ? "text-slate-400 hover:bg-white/5 hover:text-slate-300"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                )}
                            >
                                {isNight ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                                {isNight ? "Light Mode" : "Dark Mode"}
                            </button>
                        </nav>

                        <div className="flex flex-col gap-4">
                            {tier === 'free' && (user || isAnon) && (
                                <button
                                    onClick={() => {
                                        setOpen(false);
                                        setUpgradeOpen(true);
                                    }}
                                    className={cn(
                                        "flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]",
                                        "bg-gradient-to-r from-amber-400 to-orange-500 shadow-sm"
                                    )}
                                >
                                    <Sparkles className="h-4 w-4" />
                                    Upgrade to Plus
                                </button>
                            )}

                            {(user || isAnon) && (
                                <div className={cn("rounded-xl border p-4", isNight ? "border-slate-800 bg-slate-800/50" : "border-slate-100 bg-slate-50")}>
                                    <div className="flex items-center gap-3">
                                        {user?.photoURL ? (
                                            <Image
                                                src={user.photoURL}
                                                alt={user.displayName ?? "User"}
                                                width={40}
                                                height={40}
                                                className="h-10 w-10 rounded-full border-2 border-white/10 object-cover"
                                            />
                                        ) : (
                                            <div className={cn(
                                                "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold",
                                                isNight
                                                    ? "border-slate-700 bg-slate-800 text-slate-400"
                                                    : "border-slate-200 bg-white text-slate-500"
                                            )}>
                                                {user?.displayName?.charAt(0).toUpperCase() ?? "G"}
                                            </div>
                                        )}
                                        <div className="flex flex-col overflow-hidden">
                                            <span className={cn("truncate text-sm font-medium", isNight ? "text-white" : "text-slate-900")}>
                                                {user?.displayName ?? "Guest"}
                                            </span>
                                            <span className={cn("truncate text-xs", isNight ? "text-slate-400" : "text-slate-500")}>
                                                {user?.email ?? "Anonymous"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between">
                                        <div className={cn(
                                            "flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                            tier === 'plus'
                                                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                                                : isNight
                                                    ? "bg-slate-700 text-slate-300"
                                                    : "bg-slate-200 text-slate-600"
                                        )}>
                                            {tier}
                                        </div>
                                        <button
                                            onClick={() => {
                                                onSignOut();
                                                setOpen(false);
                                            }}
                                            className={cn(
                                                "flex items-center gap-1.5 text-xs font-medium transition-colors",
                                                isNight
                                                    ? "text-slate-400 hover:text-red-400"
                                                    : "text-slate-500 hover:text-red-600"
                                            )}
                                        >
                                            <LogOut className="h-3.5 w-3.5" />
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
            <UpgradeDialog
                open={upgradeOpen}
                onOpenChange={setUpgradeOpen}
            />
        </>
    );
}
