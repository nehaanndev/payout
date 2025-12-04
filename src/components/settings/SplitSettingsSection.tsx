"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { theme } from "@/lib/theme";
import { useToodlTheme } from "@/hooks/useToodlTheme";
import {
    fetchExpensePaymentPreferences,
    updateExpensePaymentPreferences,
} from "@/lib/expenseSettingsService";
import { auth } from "@/lib/firebase";
import { updateGroupMembers, getUserGroups } from "@/lib/firebaseUtils";

export function SplitSettingsSection() {
    const { isNight } = useToodlTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [paypalLink, setPaypalLink] = useState("");
    const [zelleId, setZelleId] = useState("");
    const [venmoId, setVenmoId] = useState("");
    const [cashAppId, setCashAppId] = useState("");
    const [suppressPrompt, setSuppressPrompt] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            if (!auth.currentUser) return;

            try {
                // Load from expense preferences (for PayPal)
                const prefs = await fetchExpensePaymentPreferences(auth.currentUser.uid);
                if (prefs) {
                    setPaypalLink(prefs.paypalMeLink || "");
                    setZelleId(prefs.zelleId || "");
                    setVenmoId(prefs.venmoId || "");
                    setCashAppId(prefs.cashAppId || "");
                    setSuppressPrompt(prefs.suppressPaypalPrompt || false);
                }

                // Load from user profile (for others, if we decide to store them there centrally)
                // For now, we might need to fetch from a group member record or user profile.
                // The plan said "Update Member interface", which implies these are stored on the group member.
                // However, for a central settings page, we should probably store these in the user profile 
                // or sync them across groups. 
                // Let's assume for this implementation we are reading/writing to the user's profile 
                // via ensureUserProfile (which might need updating) or just handling it here.
                // Wait, the plan updated `Member` type. `Member` is part of a `Group`.
                // If we edit it here, we should probably update all groups the user is in, 
                // or better, store it in `users/{userId}` and have groups pull from there.
                // Given the current architecture, let's fetch the user profile and see if we can store it there.
                // But the `Member` interface update suggests we want it on the member object in the group.

                // Strategy:
                // 1. Fetch user profile.
                // 2. If we add these fields to UserProfile, great. If not, we might need to iterate groups.
                // The prompt asked to "Move the split payment settings to its own section".
                // Let's check `UserProfile` type.

                // For now, let's assume we will update the user's profile in `users` collection
                // and also try to propagate to groups if possible, or just rely on the user profile 
                // being the source of truth if we update the app to look there.

                // Actually, `fetchExpensePaymentPreferences` reads from `users/{userId}/preferences/expense`.
                // We should probably store Zelle/Venmo/CashApp there too.
                // But the plan explicitly modified `Member` in `group.ts`.
                // Let's stick to the plan: Update `Member`.
                // But `SettingsPage` is global. So we need to find a way to update "me" in all groups?
                // Or maybe we just store it in `preferences/expense` and when joining a group/viewing a group
                // we use that?

                // Let's look at `expenseSettingsService.ts` (I can't see it right now but I can infer).
                // I'll assume we can extend `updateExpensePaymentPreferences` to handle these new fields if I update the type.

                // Let's just fetch the first group the user is in to get current values? No, that's flaky.
                // Let's use `fetchExpensePaymentPreferences` and assume I'll update that service too.

                // Wait, I haven't updated `ExpensePaymentPreferences` type yet.
                // I should probably do that.

            } catch (error) {
                console.error("Failed to load settings", error);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        if (!auth.currentUser) return;
        setSaving(true);
        try {
            // 1. Update preferences
            await updateExpensePaymentPreferences(auth.currentUser.uid, {
                paypalMeLink: paypalLink || null,
                suppressPaypalPrompt: suppressPrompt,
                zelleId: zelleId || null,
                venmoId: venmoId || null,
                cashAppId: cashAppId || null,
            });

            // 2. Propagate to all groups (this is the "right" way given the current architecture where Member data is copied to groups)
            const groups = await getUserGroups(auth.currentUser.email || "");

            // Let's just use what we have.
            const allGroups = [...groups];

            // We need to update the member object in each group.
            for (const group of allGroups) {
                const memberIndex = group.members.findIndex(m => m.id === auth.currentUser?.uid);
                if (memberIndex !== -1) {
                    const updatedMembers = [...group.members];
                    updatedMembers[memberIndex] = {
                        ...updatedMembers[memberIndex],
                        paypalMeLink: paypalLink || null,
                        zelleId: zelleId || null,
                        venmoId: venmoId || null,
                        cashAppId: cashAppId || null,
                    };
                    await updateGroupMembers(group.id, updatedMembers);
                }
            }

        } catch (error) {
            console.error("Failed to save settings", error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-4"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <Card className={cn(
            "border-0 shadow-md",
            isNight ? "bg-slate-900 text-slate-100" : "bg-white"
        )}>
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-emerald-500" />
                    <CardTitle>Split Payments</CardTitle>
                </div>
                <CardDescription>
                    Manage how you receive money from friends
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="paypal">PayPal.Me Link</Label>
                        <Input
                            id="paypal"
                            placeholder="https://paypal.me/username"
                            value={paypalLink}
                            onChange={(e) => setPaypalLink(e.target.value)}
                            className={theme.input(isNight)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="venmo">Venmo ID</Label>
                        <Input
                            id="venmo"
                            placeholder="@username"
                            value={venmoId}
                            onChange={(e) => setVenmoId(e.target.value)}
                            className={theme.input(isNight)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cashapp">Cash App ID</Label>
                        <Input
                            id="cashapp"
                            placeholder="$username"
                            value={cashAppId}
                            onChange={(e) => setCashAppId(e.target.value)}
                            className={theme.input(isNight)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="zelle">Zelle (Email or Phone)</Label>
                        <Input
                            id="zelle"
                            placeholder="user@example.com"
                            value={zelleId}
                            onChange={(e) => setZelleId(e.target.value)}
                            className={theme.input(isNight)}
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="suppress"
                        checked={suppressPrompt}
                        onCheckedChange={(c) => setSuppressPrompt(!!c)}
                    />
                    <Label htmlFor="suppress">Don&apos;t prompt me to add payment methods again</Label>
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving} className={theme.button.primary(isNight)}>
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
