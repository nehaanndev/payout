"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToodlTheme } from "@/hooks/useToodlTheme";
import { auth } from "@/lib/firebase";
import { getUserInterests } from "@/lib/orbitSummaryService";
import { InterestWizard } from "@/components/orbit/InterestWizard";

export function InterestsSettingsSection() {
    const { isNight } = useToodlTheme();
    const [loading, setLoading] = useState(true);
    const [interests, setInterests] = useState<string[]>([]);
    const [wizardOpen, setWizardOpen] = useState(false);

    const loadInterests = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        try {
            const data = await getUserInterests(auth.currentUser.uid);
            setInterests(data?.interests ?? []);
        } catch (error) {
            console.error("Failed to load interests", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInterests();
    }, []);

    const handleWizardComplete = () => {
        setWizardOpen(false);
        loadInterests();
    };

    if (loading) {
        return <div className="p-4"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <>
            <Card className={cn(
                "border-0 shadow-md",
                isNight ? "bg-slate-900 text-slate-100" : "bg-white"
            )}>
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-indigo-500" />
                        <CardTitle>Interests</CardTitle>
                    </div>
                    <CardDescription>
                        Topics that personalize your news feed
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    {interests.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {interests.map((interest) => (
                                    <Badge
                                        key={interest}
                                        variant="outline"
                                        className={cn(
                                            "px-3 py-1 text-sm font-medium",
                                            isNight
                                                ? "border-white/20 bg-white/10 text-indigo-100"
                                                : "border-indigo-200 bg-indigo-50 text-indigo-700"
                                        )}
                                    >
                                        {interest}
                                    </Badge>
                                ))}
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setWizardOpen(true)}
                                className="gap-2"
                            >
                                <Pencil className="h-4 w-4" />
                                Edit Interests
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-slate-500 dark:text-slate-400">
                                No interests set yet. Add interests to get personalized news.
                            </p>
                            <Button
                                onClick={() => setWizardOpen(true)}
                                className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
                            >
                                <Sparkles className="h-4 w-4" />
                                Set Up Interests
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
                <DialogContent className="max-w-lg p-0 border-0 bg-transparent shadow-none">
                    {auth.currentUser && (
                        <InterestWizard
                            userId={auth.currentUser.uid}
                            onComplete={handleWizardComplete}
                            dark={isNight}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
