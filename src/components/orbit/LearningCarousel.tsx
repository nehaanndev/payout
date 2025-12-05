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
    const tone = isNight ? "text-indigo-200" : "text-slate-600";
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
        <div className="relative w-full">
            <div className="overflow-hidden">
                <div
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {plans.map((plan, index) => (
                        <div key={plan.id} className="w-full flex-shrink-0 px-1">
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
            {totalPlans > 1 && (
                <>
                    <div className="flex items-center justify-between px-2 absolute top-0 left-0 right-0 pointer-events-none">
                        <p className={cn("text-xs font-semibold uppercase tracking-[0.35em]", tone)}>
                            Your Learning Paths ({currentIndex + 1}/{totalPlans})
                        </p>
                        <div className="flex items-center gap-2 pointer-events-auto">
                            <Button
                                size="icon"
                                variant={isNight ? "secondary" : "outline"}
                                className="h-8 w-8 rounded-full"
                                onClick={handlePrev}
                                aria-label="Previous lesson"
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                size="icon"
                                variant={isNight ? "secondary" : "outline"}
                                className="h-8 w-8 rounded-full"
                                onClick={handleNext}
                                aria-label="Next lesson"
                                disabled={currentIndex === totalPlans - 1}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Dots indicator */}
                    <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-2">
                        {plans.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? "w-6 bg-indigo-500" : "w-1.5 bg-slate-300 dark:bg-slate-700"
                                    }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
