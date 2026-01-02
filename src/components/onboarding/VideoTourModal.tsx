"use client";

import { X, Play, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoTourModalProps {
    open: boolean;
    videoId: string | null;
    onClose: () => void;
}

// Placeholder video URLs - replace with actual YouTube/Loom embeds
const VIDEO_CONFIG: Record<
    string,
    { title: string; duration: string; embedUrl?: string }
> = {
    split: {
        title: "Split Tour",
        duration: "~60 seconds",
    },
    pulse: {
        title: "Pulse Tour",
        duration: "~75 seconds",
    },
    story: {
        title: "Story Tour",
        duration: "~60 seconds",
    },
    flow: {
        title: "Flow Tour",
        duration: "~75 seconds",
    },
    orbit: {
        title: "Orbit Tour",
        duration: "~90 seconds",
    },
    quest: {
        title: "Quest Tour",
        duration: "~90 seconds",
    },
};

export function VideoTourModal({ open, videoId, onClose }: VideoTourModalProps) {
    if (!open || !videoId) return null;

    const config = VIDEO_CONFIG[videoId];
    if (!config) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-3xl mx-4">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute -right-2 -top-12 flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/20 hover:text-white"
                >
                    Close <X className="h-4 w-4" />
                </button>

                {/* Video container */}
                <div className="overflow-hidden rounded-2xl border border-white/20 bg-slate-900">
                    {config.embedUrl ? (
                        // Actual video embed
                        <div className="aspect-video">
                            <iframe
                                src={config.embedUrl}
                                className="h-full w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        // Placeholder state
                        <div className="flex aspect-video flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-8">
                            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
                                <Play className="h-12 w-12 text-white/60" />
                            </div>
                            <h3 className="mb-2 text-2xl font-bold text-white">
                                {config.title}
                            </h3>
                            <div className="mb-4 flex items-center gap-2 text-white/60">
                                <Clock className="h-4 w-4" />
                                <span>{config.duration}</span>
                            </div>
                            <p className="max-w-md text-center text-white/50">
                                Video coming soon! This tutorial will guide you through all the
                                features of this app.
                            </p>
                            <button
                                onClick={onClose}
                                className={cn(
                                    "mt-8 rounded-full bg-white/10 px-6 py-2.5 text-sm font-medium text-white",
                                    "transition hover:bg-white/20"
                                )}
                            >
                                Got it, continue tour
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
