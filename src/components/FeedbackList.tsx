"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ThumbsUp, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getFeedbacks, toggleUpvoteFeedback } from "@/lib/feedbackService";
import { Feedback, AppName } from "@/types/feedback";
import { User } from "firebase/auth";
import { cn } from "@/lib/utils";

interface FeedbackListProps {
    user: User | null;
}

const APP_LABELS: Record<AppName, string> = {
    general: "General",
    dashboard: "Dashboard",
    split: "Split",
    budget: "Pulse",
    journal: "Story",
    orbit: "Orbit",
    flow: "Flow",
    quest: "Quest",
};

const APP_COLORS: Record<AppName, string> = {
    general: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
    dashboard: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    split: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
    budget: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    journal: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20",
    orbit: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20",
    flow: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
    quest: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
};

export function FeedbackList({ user }: FeedbackListProps) {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFeedbacks = async () => {
        const data = await getFeedbacks();
        setFeedbacks(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const handleUpvote = async (feedback: Feedback) => {
        if (!user) return; // Or show login prompt

        const isUpvoted = feedback.upvotes.includes(user.uid);

        // Optimistic update
        setFeedbacks(prev => prev.map(f => {
            if (f.id === feedback.id) {
                return {
                    ...f,
                    upvotes: isUpvoted
                        ? f.upvotes.filter(id => id !== user.uid)
                        : [...f.upvotes, user.uid]
                };
            }
            return f;
        }));

        try {
            await toggleUpvoteFeedback(feedback.id, user.uid, isUpvoted);
        } catch (error) {
            // Revert on error
            console.error("Failed to toggle upvote", error);
            fetchFeedbacks();
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                            <div className="h-4 bg-muted rounded w-20 mb-4" />
                            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                            <div className="h-4 bg-muted rounded w-1/2" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (feedbacks.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-full bg-violet-500/10 p-4 mb-4">
                        <MessageCircle className="h-8 w-8 text-violet-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No feedback yet</h3>
                    <p className="text-muted-foreground max-w-sm">
                        Be the first to share your thoughts and help shape the future of Toodl!
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {feedbacks.map((feedback) => {
                const isUpvoted = user ? feedback.upvotes.includes(user.uid) : false;

                return (
                    <Card
                        key={feedback.id}
                        className="group transition-all duration-200 hover:shadow-md hover:border-violet-500/30"
                    >
                        <CardContent className="p-6">
                            {/* Header with badge and timestamp */}
                            <div className="flex items-center gap-3 mb-4">
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "font-medium border",
                                        APP_COLORS[feedback.app] || APP_COLORS.general
                                    )}
                                >
                                    {APP_LABELS[feedback.app]}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
                                </span>
                            </div>

                            {/* Feedback message */}
                            <p className="text-base leading-relaxed mb-4">
                                {feedback.message}
                            </p>

                            {/* Actions */}
                            <div className="flex items-center pt-2 border-t border-border/50">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "gap-2 transition-colors",
                                        isUpvoted
                                            ? "text-violet-600 dark:text-violet-400 hover:text-violet-700 hover:bg-violet-500/10"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                    onClick={() => handleUpvote(feedback)}
                                    disabled={!user}
                                >
                                    <ThumbsUp className={cn("h-4 w-4", isUpvoted && "fill-current")} />
                                    <span className="font-medium">{feedback.upvotes.length}</span>
                                    <span className="text-xs">
                                        {feedback.upvotes.length === 1 ? "vote" : "votes"}
                                    </span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
