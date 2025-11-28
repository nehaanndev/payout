"use client";

import { useState } from "react";
import {
    Split,
    Wallet,
    BookOpen,
    Link as LinkIcon,
    Sparkles,
    Check,
    ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";


export type ToodlIntent = "split" | "pulse" | "flow" | "orbit" | "all";

interface OnboardingWizardProps {
    onComplete: (intent: ToodlIntent) => void;
}

const INTENTS: {
    id: ToodlIntent;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    gradient: string;
}[] = [
        {
            id: "split",
            title: "Split Bills",
            description: "Share expenses with roommates or friends.",
            icon: Split,
            color: "text-orange-600",
            gradient: "from-orange-50 to-orange-100/50 hover:to-orange-100",
        },
        {
            id: "pulse",
            title: "Manage Budget",
            description: "Track monthly spending and stick to limits.",
            icon: Wallet,
            color: "text-purple-600",
            gradient: "from-purple-50 to-purple-100/50 hover:to-purple-100",
        },
        {
            id: "flow",
            title: "Journal & Plan",
            description: "Daily reflections and task planning.",
            icon: BookOpen,
            color: "text-emerald-600",
            gradient: "from-emerald-50 to-emerald-100/50 hover:to-emerald-100",
        },
        {
            id: "orbit",
            title: "Save Links",
            description: "Bookmark and organize things you find.",
            icon: LinkIcon,
            color: "text-indigo-600",
            gradient: "from-indigo-50 to-indigo-100/50 hover:to-indigo-100",
        },
        {
            id: "all",
            title: "Organize Everything",
            description: "I want the full Toodl experience.",
            icon: Sparkles,
            color: "text-slate-700",
            gradient: "from-slate-50 to-slate-100/50 hover:to-slate-100",
        },
    ];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
    const [step, setStep] = useState<"welcome" | "select">("welcome");
    const [selected, setSelected] = useState<ToodlIntent | null>(null);
    const [isExiting, setIsExiting] = useState(false);

    const handleSelect = (intent: ToodlIntent) => {
        setSelected(intent);
        // Add a small delay for visual feedback before completing
        setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => {
                onComplete(intent);
            }, 500); // Match exit animation duration
        }, 300);
    };

    if (isExiting) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity duration-500 opacity-0">
                {/* Fading out... */}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-md p-4 animate-in fade-in duration-500">
            <div className="w-full max-w-4xl mx-auto">
                {step === "welcome" ? (
                    <div className="text-center space-y-8 max-w-lg mx-auto animate-in slide-in-from-bottom-8 duration-700">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                                Welcome to Toodl.
                            </h1>
                            <p className="text-lg text-slate-600 leading-relaxed">
                                Toodl can do a lot, but let&apos;s start simple. <br />
                                What brings you here today?
                            </p>
                        </div>
                        <Button
                            size="lg"
                            onClick={() => setStep("select")}
                            className="rounded-full px-8 h-12 text-base bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200"
                        >
                            Let&apos;s get started <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-semibold text-slate-900">
                                Choose your focus
                            </h2>
                            <p className="text-slate-500">
                                Don&apos;t worry, you can always enable other features later.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {INTENTS.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item.id)}
                                    className={cn(
                                        "group relative flex flex-col items-start p-6 text-left rounded-2xl border transition-all duration-200",
                                        "hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
                                        "bg-gradient-to-br",
                                        item.gradient,
                                        selected === item.id ? "ring-2 ring-slate-900 ring-offset-2 border-transparent" : "border-slate-200/60"
                                    )}
                                >
                                    <div className={cn(
                                        "mb-4 rounded-xl p-3 bg-white shadow-sm ring-1 ring-black/5",
                                        item.color
                                    )}>
                                        <item.icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="font-semibold text-slate-900 mb-1">
                                        {item.title}
                                    </h3>
                                    <p className="text-sm text-slate-600 leading-snug">
                                        {item.description}
                                    </p>

                                    {selected === item.id && (
                                        <div className="absolute top-4 right-4 text-slate-900 animate-in zoom-in duration-200">
                                            <Check className="h-5 w-5" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
