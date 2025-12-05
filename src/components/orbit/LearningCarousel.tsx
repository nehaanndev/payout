"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { OrbitLearningPlan } from "@/types/orbit";
import { LearningCardLoader } from "./LearningCardLoader";

interface LearningCarouselProps {
    plans: OrbitLearningPlan[];
    isNight: boolean;
    userId?: string;
}

export function LearningCarousel({ plans, isNight, userId }: LearningCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setCurrentIndex(0);
    }, [plans.length]);

    const totalPlans = plans.length;

    const handlePrev = () => {
        if (totalPlans < 2) {
            return;
        }
        setCurrentIndex((prev) => (prev - 1 + totalPlans) % totalPlans);
    };

    const handleNext = () => {
        if (totalPlans < 2) {
            return;
        }
        setCurrentIndex((prev) => (prev + 1) % totalPlans);
    };

    if (!plans.length) return null;

    return (
        <div className="w-full space-y-4">
            {totalPlans > 0 && (
                <div className="flex items-center justify-between px-1">
                    <h2 className={cn("text-xs font-bold uppercase tracking-widest", isNight ? "text-indigo-300" : "text-slate-500")}>
                        Your Learning Paths <span className="opacity-50 ml-1">({currentIndex + 1}/{totalPlans})</span>
                    </h2>
                    {totalPlans > 1 && (
                        <div className="flex items-center gap-1">
                            <Button
                                size="icon"
                                variant="ghost"
                                className={cn("h-8 w-8 rounded-full transition-colors", isNight ? "text-indigo-200 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-900")}
                                onClick={handlePrev}
                                aria-label="Previous lesson"
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className={cn("h-8 w-8 rounded-full transition-colors", isNight ? "text-indigo-200 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-900")}
                                onClick={handleNext}
                                aria-label="Next lesson"
                                disabled={currentIndex === totalPlans - 1}
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <div className="overflow-hidden rounded-[24px]">
                <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {plans.map((plan, index) => (
                        <div key={plan.id} className="w-full flex-shrink-0">
                            <LearningCardLoader
                                plan={plan}
                                isNight={isNight}
                                userId={userId}
                                isVisible={index === currentIndex}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Dots indicator */}
            {totalPlans > 1 && (
                <div className="flex justify-center gap-1.5 pt-2">
                    {plans.map((_, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                idx === currentIndex
                                    ? isNight ? "w-6 bg-indigo-500" : "w-6 bg-emerald-500"
                                    : isNight ? "w-1.5 bg-slate-700" : "w-1.5 bg-slate-200"
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
