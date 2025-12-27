"use client";

import { useAuth } from "@/hooks/useAuth";
import { FeedbackList } from "@/components/FeedbackList";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Sparkles } from "lucide-react";

export default function FeedbackPage() {
    const { user } = useAuth();

    return (
        <div className="min-h-screen">
            {/* Hero Header */}
            <div className="bg-gradient-to-br from-violet-600/10 via-purple-600/5 to-transparent border-b border-border/50">
                <div className="container max-w-3xl py-12 px-4 sm:px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-violet-500" />
                                <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
                                    Community Feedback
                                </span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                                Feature Requests & Ideas
                            </h1>
                            <p className="text-muted-foreground text-base sm:text-lg max-w-xl">
                                Share your thoughts, vote on ideas, and help shape the future of Toodl.
                            </p>
                        </div>
                        <FeedbackDialog
                            user={user}
                            trigger={
                                <Button size="lg" className="gap-2 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-shadow">
                                    <MessageSquarePlus className="h-5 w-5" />
                                    Share Feedback
                                </Button>
                            }
                        />
                    </div>
                </div>
            </div>

            {/* Feedback List */}
            <div className="container max-w-3xl py-8 px-4 sm:px-6">
                <FeedbackList user={user} />
            </div>
        </div>
    );
}
