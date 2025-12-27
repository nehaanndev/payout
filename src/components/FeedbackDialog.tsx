"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { addFeedback } from "@/lib/feedbackService";
import { AppName } from "@/types/feedback";
import { User } from "firebase/auth";

interface FeedbackDialogProps {
    user: User | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

interface FeedbackFormData {
    app: AppName;
    email: string;
    message: string;
}

export function FeedbackDialog({ user, open, onOpenChange, trigger }: FeedbackDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const { register, handleSubmit, reset, setValue, watch } = useForm<FeedbackFormData>({
        defaultValues: {
            app: "general",
            email: user?.email || "",
            message: "",
        },
    });

    const selectedApp = watch("app");

    const onSubmit = async (data: FeedbackFormData) => {
        setIsSubmitting(true);
        try {
            await addFeedback(data.app, data.message, data.email);
            toast({
                title: "Feedback submitted",
                description: "Thank you for your feedback!",
            });
            reset();
            handleOpenChange(false);
        } catch {
            toast({
                title: "Error",
                description: "Failed to submit feedback. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        setIsOpen(newOpen);
        onOpenChange?.(newOpen);
        if (newOpen && user?.email) {
            setValue("email", user.email);
        }
    };

    const controlledOpen = open !== undefined ? open : isOpen;
    const controlledOnOpenChange = onOpenChange || setIsOpen;


    return (
        <Dialog open={controlledOpen} onOpenChange={controlledOnOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Send Feedback</DialogTitle>
                    <DialogDescription>
                        Help us improve by sharing your thoughts or reporting issues.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="app">App</Label>
                        <Select
                            value={selectedApp}
                            onValueChange={(value) => setValue("app", value as AppName)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select app" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="dashboard">Dashboard</SelectItem>
                                <SelectItem value="split">Split</SelectItem>
                                <SelectItem value="budget">Pulse</SelectItem>
                                <SelectItem value="journal">Story</SelectItem>
                                <SelectItem value="orbit">Orbit</SelectItem>
                                <SelectItem value="flow">Flow</SelectItem>
                                <SelectItem value="quest">Quest</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email (optional)</Label>
                        <Input
                            id="email"
                            placeholder="your@email.com"
                            {...register("email")}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                            id="message"
                            placeholder="Tell us what you think..."
                            className="min-h-[100px]"
                            {...register("message", { required: true })}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Feedback
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
