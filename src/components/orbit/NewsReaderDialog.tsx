"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { OrbitInsightCard } from "@/types/orbit";
import { X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface NewsReaderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    newsItem: OrbitInsightCard | null;
    isNight?: boolean;
}

export function NewsReaderDialog({
    open,
    onOpenChange,
    newsItem,
    isNight = false,
}: NewsReaderDialogProps) {
    if (!newsItem) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "max-w-3xl p-0 overflow-hidden border-none shadow-2xl h-[85vh] flex flex-col",
                isNight ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"
            )}>
                <DialogTitle className="sr-only">{newsItem.title}</DialogTitle>

                {/* Header Image */}
                <div className="relative w-full h-64 shrink-0 bg-slate-200 dark:bg-slate-800">
                    {newsItem.imageUrl && (
                        <Image
                            src={newsItem.imageUrl}
                            alt={newsItem.title}
                            fill
                            className="object-cover"
                            priority
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>

                    <div className="absolute bottom-6 left-6 right-6">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm mb-3">
                            {newsItem.topic}
                        </span>
                        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight shadow-sm">
                            {newsItem.title}
                        </h2>
                    </div>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1">
                    <div className="p-6 md:p-8 space-y-6 max-w-2xl mx-auto">
                        {/* Summary Highlight */}
                        <div className={cn(
                            "p-4 rounded-xl text-lg font-medium italic border-l-4",
                            isNight
                                ? "bg-indigo-500/10 border-indigo-400 text-indigo-200"
                                : "bg-indigo-50 border-indigo-500 text-indigo-900"
                        )}>
                            {newsItem.summary}
                        </div>

                        {/* Paragraphs */}
                        <div className={cn(
                            "space-y-6 text-base leading-relaxed",
                            isNight ? "text-slate-300" : "text-slate-700"
                        )}>
                            {newsItem.paragraphs?.map((paragraph, idx) => (
                                <p key={idx}>{paragraph}</p>
                            ))}
                        </div>

                        {/* Citations / Links */}
                        {newsItem.referenceUrl && (
                            <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full sm:w-auto",
                                        isNight ? "border-slate-700 text-slate-300 hover:bg-slate-800" : ""
                                    )}
                                    onClick={() => window.open(newsItem.referenceUrl!, "_blank")}
                                >
                                    Read original source
                                </Button>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
