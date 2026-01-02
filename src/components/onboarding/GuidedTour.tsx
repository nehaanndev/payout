"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    ChevronRight,
    X,
    Play,
    Wallet,
    Activity,
    NotebookPen,
    Workflow,
    Globe,
    Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VideoTourModal } from "./VideoTourModal";
import Image from "next/image";

const TOUR_COMPLETED_KEY = "toodl_tour_completed";

interface SlideData {
    id: string;
    title: string;
    tagline: string;
    description: string;
    features: string[];
    icon?: React.ElementType;
    logoSrc?: string;
    gradient: string;
    iconGradient: string;
    videoId?: string;
}

const SLIDES: SlideData[] = [
    {
        id: "welcome",
        title: "Welcome to Toodl",
        tagline: "Your life, organized.",
        description:
            "An AI-powered suite of tools designed to simplify how you manage money, time, goals, and ideas.",
        features: [
            "Split expenses with friends",
            "Track budgets that adapt",
            "Plan your days & journal",
            "Save links & learn anything",
            "Achieve goals with AI guidance",
        ],
        logoSrc: "/brand/toodl-logo.png",
        gradient: "from-slate-900 via-indigo-900 to-slate-900",
        iconGradient: "from-indigo-400 to-purple-400",
    },
    {
        id: "split",
        title: "Split",
        tagline: "Split bills, not friendships.",
        description:
            "Share expenses with roommates, friends, or travel buddies. Track who paid, who owes, and settle up with one tap.",
        features: [
            "Create groups for any occasion",
            "Log expenses in seconds",
            "Smart settlement suggestions",
            "PayPal, Venmo & Zelle links",
        ],
        icon: Wallet,
        gradient: "from-rose-700 via-orange-600 to-rose-700",
        iconGradient: "from-rose-200 to-orange-100",
        videoId: "split",
    },
    {
        id: "pulse",
        title: "Pulse",
        tagline: "Budgets that breathe.",
        description:
            "Set a monthly allowance and track spending as you go. AI keeps you informed if you're on pace or slipping.",
        features: [
            "Monthly budget tracking",
            "AI-powered projections",
            "Category breakdowns",
            "Streak rewards for discipline",
        ],
        icon: Activity,
        gradient: "from-purple-600 via-violet-500 to-purple-600",
        iconGradient: "from-purple-300 to-violet-200",
        videoId: "pulse",
    },
    {
        id: "story",
        title: "Story",
        tagline: "Write your story.",
        description:
            "Capture meaningful reflections about work, family, growth, and everything in between. Your private journal.",
        features: [
            "Rich text entries",
            "Photo memories",
            "Tag & organize",
            "Search your history",
        ],
        icon: NotebookPen,
        gradient: "from-amber-700 via-orange-600 to-amber-700",
        iconGradient: "from-amber-100 to-orange-50",
        videoId: "story",
    },
    {
        id: "flow",
        title: "Flow",
        tagline: "Plan today, reflect tonight.",
        description:
            "Start mornings with intention, end evenings with gratitude. A simple ritual for a more mindful life.",
        features: [
            "Morning task planning",
            "Category organization",
            "Evening mood & reflection",
            "Build reflection streaks",
        ],
        icon: Workflow,
        gradient: "from-emerald-600 via-teal-500 to-emerald-600",
        iconGradient: "from-emerald-300 to-teal-200",
        videoId: "flow",
    },
    {
        id: "orbit",
        title: "Orbit",
        tagline: "Your personal universe.",
        description:
            "An AI-curated news feed based on your interests, plus a place to save and organize links you discover.",
        features: [
            "Personalized news feed",
            "Save & tag links",
            "Learning tracks",
            "Daily micro-lessons",
        ],
        icon: Globe,
        gradient: "from-indigo-600 via-blue-500 to-indigo-600",
        iconGradient: "from-indigo-300 to-blue-200",
        videoId: "orbit",
    },
    {
        id: "quest",
        title: "Quest",
        tagline: "Turn dreams into done.",
        description:
            "Tell AI your goal and watch it create a roadmap with milestones, daily commitments, and progress tracking.",
        features: [
            "AI-generated roadmaps",
            "Milestone tracking",
            "Daily focus commitments",
            "Visual progress charts",
        ],
        icon: Target,
        gradient: "from-rose-600 via-pink-500 to-rose-600",
        iconGradient: "from-rose-300 to-pink-200",
        videoId: "quest",
    },
    {
        id: "getstarted",
        title: "Ready to begin?",
        tagline: "Your journey starts now.",
        description:
            "Explore at your own pace. Every feature is designed to work together, but you can use just what you need.",
        features: [],
        logoSrc: "/brand/toodl-logo.png",
        gradient: "from-slate-900 via-purple-900 to-indigo-900",
        iconGradient: "from-purple-400 to-indigo-400",
    },
];

interface GuidedTourProps {
    onComplete: () => void;
}

export function GuidedTour({ onComplete }: GuidedTourProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [direction, setDirection] = useState(0);
    const [videoModalOpen, setVideoModalOpen] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

    const isLastSlide = currentSlide === SLIDES.length - 1;
    const slide = SLIDES[currentSlide];

    const goToSlide = useCallback(
        (index: number) => {
            if (index < 0 || index >= SLIDES.length) return;
            setDirection(index > currentSlide ? 1 : -1);
            setCurrentSlide(index);
        },
        [currentSlide]
    );

    const nextSlide = useCallback(() => {
        if (currentSlide < SLIDES.length - 1) {
            goToSlide(currentSlide + 1);
        }
    }, [currentSlide, goToSlide]);

    const prevSlide = useCallback(() => {
        if (currentSlide > 0) {
            goToSlide(currentSlide - 1);
        }
    }, [currentSlide, goToSlide]);

    const handleComplete = useCallback(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem(TOUR_COMPLETED_KEY, "true");
        }
        onComplete();
    }, [onComplete]);

    const openVideo = useCallback((videoId: string) => {
        setActiveVideoId(videoId);
        setVideoModalOpen(true);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (videoModalOpen) return;
            if (e.key === "ArrowRight" || e.key === " ") {
                e.preventDefault();
                nextSlide();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                prevSlide();
            } else if (e.key === "Escape") {
                e.preventDefault();
                handleComplete();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [nextSlide, prevSlide, handleComplete, videoModalOpen]);

    const slideVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? "100%" : "-100%",
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (dir: number) => ({
            x: dir > 0 ? "-100%" : "100%",
            opacity: 0,
        }),
    };

    return (
        <>
            <div className="fixed inset-0 z-50 overflow-hidden">
                {/* Animated gradient background */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={slide.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className={cn(
                            "absolute inset-0 bg-gradient-to-br",
                            slide.gradient
                        )}
                    />
                </AnimatePresence>

                {/* Skip button */}
                <button
                    onClick={handleComplete}
                    className="absolute right-4 top-4 z-50 flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
                >
                    Skip <X className="h-4 w-4" />
                </button>

                {/* Slide content */}
                <div className="relative flex h-full items-center justify-center px-4">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={slide.id}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.3 },
                            }}
                            className="w-full max-w-2xl"
                        >
                            {/* Glass card */}
                            <div className="rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-xl md:p-12">
                                {/* Icon / Logo */}
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="mb-6 flex justify-center"
                                >
                                    <div
                                        className={cn(
                                            "flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br shadow-2xl overflow-hidden",
                                            slide.iconGradient
                                        )}
                                    >
                                        {slide.logoSrc ? (
                                            <Image
                                                src={slide.logoSrc}
                                                alt={slide.title}
                                                width={48}
                                                height={48}
                                                className="h-12 w-12 object-contain"
                                            />
                                        ) : slide.icon ? (
                                            <slide.icon className="h-10 w-10 text-slate-900" />
                                        ) : null}
                                    </div>
                                </motion.div>

                                {/* Title */}
                                <motion.h1
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="mb-3 text-center text-4xl font-bold tracking-tight text-white md:text-5xl"
                                >
                                    {slide.title}
                                </motion.h1>

                                {/* Tagline */}
                                <motion.p
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="mb-6 text-center text-xl text-white/80"
                                >
                                    {slide.tagline}
                                </motion.p>

                                {/* Description */}
                                <motion.p
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="mb-8 text-center text-base leading-relaxed text-white/70"
                                >
                                    {slide.description}
                                </motion.p>

                                {/* Features list */}
                                {slide.features.length > 0 && (
                                    <motion.ul
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.6 }}
                                        className="mb-8 space-y-2"
                                    >
                                        {slide.features.map((feature, index) => (
                                            <li
                                                key={index}
                                                className="flex items-center justify-center gap-2 text-sm text-white/70"
                                            >
                                                <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
                                                {feature}
                                            </li>
                                        ))}
                                    </motion.ul>
                                )}

                                {/* Action buttons */}
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.7 }}
                                    className="flex flex-col items-center gap-3"
                                >
                                    {slide.videoId && (
                                        <Button
                                            variant="outline"
                                            onClick={() => openVideo(slide.videoId!)}
                                            className="gap-2 rounded-full border-white/30 bg-white/10 px-6 text-white hover:bg-white/20 hover:text-white"
                                        >
                                            <Play className="h-4 w-4" />
                                            Watch Tour
                                        </Button>
                                    )}

                                    {isLastSlide && (
                                        <Button
                                            onClick={handleComplete}
                                            className="rounded-full bg-white px-8 py-3 text-base font-semibold text-slate-900 shadow-xl hover:bg-white/90"
                                        >
                                            Get Started
                                        </Button>
                                    )}
                                </motion.div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Navigation */}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 pb-8">
                    {/* Previous button */}
                    <button
                        onClick={prevSlide}
                        disabled={currentSlide === 0}
                        className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition",
                            currentSlide === 0
                                ? "cursor-not-allowed opacity-30"
                                : "hover:bg-white/20"
                        )}
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>

                    {/* Dots */}
                    <div className="flex items-center gap-2">
                        {SLIDES.map((s, index) => (
                            <button
                                key={s.id}
                                onClick={() => goToSlide(index)}
                                className={cn(
                                    "h-2.5 rounded-full transition-all duration-300",
                                    index === currentSlide
                                        ? "w-8 bg-white"
                                        : "w-2.5 bg-white/30 hover:bg-white/50"
                                )}
                            />
                        ))}
                    </div>

                    {/* Next button */}
                    <button
                        onClick={isLastSlide ? handleComplete : nextSlide}
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </button>
                </div>
            </div>

            {/* Video Modal */}
            <VideoTourModal
                open={videoModalOpen}
                videoId={activeVideoId}
                onClose={() => {
                    setVideoModalOpen(false);
                    setActiveVideoId(null);
                }}
            />
        </>
    );
}

export { TOUR_COMPLETED_KEY };
