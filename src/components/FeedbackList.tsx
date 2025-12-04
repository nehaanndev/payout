"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
};

const APP_COLORS: Record<AppName, string> = {
    general: "bg-slate-500",
    dashboard: "bg-blue-500",
    split: "bg-green-500",
    budget: "bg-purple-500",
    journal: "bg-yellow-500",
    orbit: "bg-pink-500",
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
        return <div className="p-8 text-center">Loading feedback...</div>;
    }

    return (
        <div className="space-y-4">
            {feedbacks.map((feedback) => {
                const isUpvoted = user ? feedback.upvotes.includes(user.uid) : false;

                return (
                    <Card key={feedback.id}>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <Badge className={cn("text-white", APP_COLORS[feedback.app] || "bg-slate-500")}>
                                    {APP_LABELS[feedback.app]}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="mb-4 text-sm">{feedback.message}</p>
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("gap-2", isUpvoted && "text-blue-600")}
                                    onClick={() => handleUpvote(feedback)}
                                    disabled={!user}
                                >
                                    <ThumbsUp className="h-4 w-4" />
                                    {feedback.upvotes.length}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
            {feedbacks.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                    No feedback yet. Be the first to share your thoughts!
                </div>
            )}
        </div>
    );
}
