"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { ensureUserProfile } from "@/lib/userService";
import { type UserProfile } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { Loader2, Settings as SettingsIcon, CreditCard, ShieldCheck } from "lucide-react";
import { useToodlTheme } from "@/hooks/useToodlTheme";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);
    const { isNight } = useToodlTheme();

    useEffect(() => {
        const fetchProfile = async () => {
            if (auth.currentUser) {
                const profile = await ensureUserProfile(auth.currentUser);
                setUserProfile(profile);
            }
            setLoading(false);
        };

        fetchProfile();
    }, []);

    const handleManageSubscription = async () => {
        setPortalLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            const response = await fetch("/api/stripe/portal", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userId: user.uid,
                }),
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error("Failed to create portal session:", data.error);
                alert("Failed to open subscription management. Please try again.");
            }
        } catch (error) {
            console.error("Error managing subscription:", error);
            alert("An error occurred. Please try again.");
        } finally {
            setPortalLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!userProfile) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p className="text-slate-500">Please sign in to view settings.</p>
            </div>
        );
    }

    const isPlus = userProfile.tier === "plus";

    return (
        <div className={cn(
            "min-h-screen p-8 transition-colors duration-300",
            isNight ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
        )}>
            <div className="mx-auto max-w-2xl space-y-8">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl shadow-sm",
                        isNight ? "bg-slate-900 text-indigo-400" : "bg-white text-indigo-600"
                    )}>
                        <SettingsIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                        <p className={cn("text-sm", isNight ? "text-slate-400" : "text-slate-500")}>
                            Manage your account and subscription
                        </p>
                    </div>
                </div>

                <Card className={cn(
                    "border-0 shadow-md",
                    isNight ? "bg-slate-900 text-slate-100" : "bg-white"
                )}>
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-indigo-500" />
                            <CardTitle>Subscription</CardTitle>
                        </div>
                        <CardDescription>
                            Manage your billing and plan details
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Current Plan</p>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-2xl font-bold",
                                        isPlus ? "text-indigo-500" : "text-slate-700 dark:text-slate-200"
                                    )}>
                                        {isPlus ? "Plus" : "Free"}
                                    </span>
                                    {isPlus && (
                                        <span className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                            <ShieldCheck className="h-3 w-3" />
                                            Active
                                        </span>
                                    )}
                                </div>
                            </div>

                            {isPlus ? (
                                <Button
                                    variant="outline"
                                    onClick={handleManageSubscription}
                                    disabled={portalLoading}
                                    className={cn(
                                        "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
                                        portalLoading && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {portalLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        "Manage Subscription"
                                    )}
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => setUpgradeOpen(true)}
                                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md hover:from-indigo-600 hover:to-violet-700"
                                >
                                    Upgrade to Plus
                                </Button>
                            )}
                        </div>

                        {!isPlus && (
                            <div className="mt-6 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Upgrade to <strong>Plus</strong> to unlock unlimited access to all features, including unlimited Orbit saves, Flow tasks, and more.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <UpgradeDialog
                open={upgradeOpen}
                onOpenChange={setUpgradeOpen}
            />
        </div>
    );
}
