import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { auth } from "@/lib/firebase"; // Import auth to get current user

interface UpgradeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    featureName?: string;
    limitDescription?: string;
}

export function UpgradeDialog({
    open,
    onOpenChange,
    featureName,
    limitDescription,
}: UpgradeDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleUpgrade = async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                console.error("User not found");
                return;
            }

            const response = await fetch("/api/stripe/checkout", {
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
                console.error("Failed to create checkout session:", data.error);
            }
        } catch (error) {
            console.error("Error upgrading:", error);
        } finally {
            setLoading(false);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        {featureName ? `Unlock Unlimited ${featureName}` : "Unlock the Full Potential of Toodl"}
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                        {limitDescription
                            ? `You've reached the limit for ${limitDescription} on the free plan.`
                            : "Get unlimited access to all Toodl features and support development."}
                        {" "}Upgrade to Plus to remove all limits.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                        <strong>Plus benefits:</strong>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                            <li>Unlimited Orbit saves & learning tracks</li>
                            <li>Unlimited Flow recurring tasks</li>
                            <li>Unlimited Split groups & expenses</li>
                            <li>Unlimited Budget history & entries</li>
                            <li>Unlimited Journal entries & photos</li>
                        </ul>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-xs text-muted-foreground text-center">
                        Have an invite code?
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Enter code"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            id="invite-code"
                        />
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                                const input = document.getElementById('invite-code') as HTMLInputElement;
                                const code = input.value.trim();
                                if (!code) return;

                                setLoading(true);
                                try {
                                    const user = auth.currentUser;
                                    if (!user) return;

                                    const res = await fetch('/api/invite/redeem', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ code, userId: user.uid }),
                                    });

                                    if (res.ok) {
                                        window.location.reload();
                                    } else {
                                        const data = await res.json();
                                        alert(data.error || 'Failed to redeem code');
                                    }
                                } catch (e) {
                                    console.error(e);
                                    alert('Error redeeming code');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                        >
                            Redeem
                        </Button>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Maybe later
                    </Button>
                    <Button
                        onClick={handleUpgrade}
                        disabled={loading}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
                    >
                        {loading ? "Loading..." : "Upgrade to Plus"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
