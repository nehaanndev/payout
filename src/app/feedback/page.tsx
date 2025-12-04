"use client";

import { useAuth } from "@/hooks/useAuth";
import { FeedbackList } from "@/components/FeedbackList";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";

export default function FeedbackPage() {
    const { user } = useAuth();

    return (
        <div className="container max-w-2xl py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Feedback</h1>
                    <p className="text-muted-foreground">
                        See what others are saying and help us improve.
                    </p>
                </div>
                <FeedbackDialog
                    user={user}
                    trigger={
                        <Button>
                            <MessageSquarePlus className="mr-2 h-4 w-4" />
                            Give Feedback
                        </Button>
                    }
                />
            </div>

            <FeedbackList user={user} />
        </div>
    );
}
