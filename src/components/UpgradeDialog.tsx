import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface UpgradeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    featureName: string;
    limitDescription: string;
}

export function UpgradeDialog({
    open,
    onOpenChange,
    featureName,
    limitDescription,
}: UpgradeDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Unlock Unlimited {featureName}
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                        You&apos;ve reached the limit for {limitDescription} on the free plan.
                        Upgrade to Plus to remove all limits and support the development of Toodl.
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
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Maybe later
                    </Button>
                    <Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600">
                        Upgrade to Plus
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
