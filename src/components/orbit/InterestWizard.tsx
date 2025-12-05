"use client";

import { useState, useCallback, useEffect } from "react";
import { Trash2, X, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { saveUserInterests, saveLearningPlan, getUserInterests, getLearningPlans, deleteLearningPlan } from "@/lib/orbitSummaryService";
import type { OrbitLearningPlan } from "@/types/orbit";

type InterestWizardProps = {
  userId: string;
  onComplete: () => void;
  dark?: boolean;
};

const SUGGESTED_INTERESTS = [
  "Technology",
  "Science",
  "Business",
  "Design",
  "Health",
  "Finance",
  "Education",
  "Art",
  "Music",
  "Sports",
  "Travel",
  "Food",
  "Fitness",
  "Photography",
  "Writing",
  "Programming",
  "AI & Machine Learning",
  "Startups",
  "Productivity",
  "Philosophy",
];

export function InterestWizard({ userId, onComplete, dark = false }: InterestWizardProps) {
  const [interests, setInterests] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [learningTopic, setLearningTopic] = useState("");
  const [learningDepth, setLearningDepth] = useState<OrbitLearningPlan["depth"]>("standard");
  const [learningDays, setLearningDays] = useState(10);
  const [suggestedDays, setSuggestedDays] = useState<number | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [learningPlans, setLearningPlans] = useState<OrbitLearningPlan[]>([]);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  // Update days when depth changes
  useEffect(() => {
    switch (learningDepth) {
      case "light": setLearningDays(7); break;
      case "standard": setLearningDays(14); break;
      case "deep": setLearningDays(30); break;
      case "expert": setLearningDays(60); setSuggestedDays(null); break;
      case "auto":
        setLearningDays(0);
        // Trigger suggestion if topic is present
        if (learningTopic.trim().length > 2) {
          fetchSuggestion(learningTopic.trim());
        }
        break;
    }
  }, [learningDepth]);

  const fetchSuggestion = useCallback(async (topic: string) => {
    setIsSuggesting(true);
    try {
      const res = await fetch("/api/orbit/suggest-duration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (data.days) {
        setSuggestedDays(data.days);
        setLearningDays(data.days);
      }
    } catch (error) {
      console.error("Failed to get suggestion", error);
    } finally {
      setIsSuggesting(false);
    }
  }, []);

  // Debounce suggestion fetch when topic changes and mode is auto
  useEffect(() => {
    if (learningDepth === "auto" && learningTopic.trim().length > 2) {
      const timer = setTimeout(() => {
        fetchSuggestion(learningTopic.trim());
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [learningTopic, learningDepth, fetchSuggestion]);

  const addInterest = useCallback((interest: string) => {
    const trimmed = interest.trim().toLowerCase();
    if (trimmed && !interests.some((i) => i.toLowerCase() === trimmed)) {
      setInterests([...interests, trimmed]);
      setInputValue("");
    }
  }, [interests]);

  const removeInterest = useCallback((interest: string) => {
    setInterests(interests.filter((i) => i !== interest));
  }, [interests]);

  // Load existing interests and learning plan
  useEffect(() => {
    const loadExisting = async () => {
      setLoading(true);
      try {
        const [userInterests, plans] = await Promise.all([
          getUserInterests(userId),
          getLearningPlans(userId),
        ]);

        if (userInterests?.interests) {
          setInterests(userInterests.interests);
        }

        if (plans) {
          setLearningPlans(plans);
        }
      } catch (error) {
        console.error("Failed to load existing interests/learning plan", error);
      } finally {
        setLoading(false);
      }
    };

    loadExisting();
  }, [userId]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addInterest(inputValue);
    }
  }, [inputValue, addInterest]);

  const handleDeletePlan = useCallback(async (planId: string) => {
    if (!confirm("Are you sure you want to delete this learning topic? This cannot be undone.")) {
      return;
    }

    setDeletingPlanId(planId);
    try {
      await deleteLearningPlan(userId, planId);
      setLearningPlans(prev => prev.filter(p => p.id !== planId));
    } catch (error) {
      console.error("Failed to delete learning plan", error);
    } finally {
      setDeletingPlanId(null);
    }
  }, [userId]);

  const handleAddPlan = useCallback(async () => {
    if (!learningTopic.trim()) return;

    // Check if topic already exists
    if (learningPlans.some(p => p.topic.toLowerCase() === learningTopic.trim().toLowerCase())) {
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const plan: OrbitLearningPlan = {
        id: crypto.randomUUID(),
        topic: learningTopic.trim(),
        depth: learningDepth,
        totalLessons: learningDays,
        currentLesson: 0,
        startedAt: now,
        updatedAt: now,
        completedLessons: [],
      };
      await saveLearningPlan(userId, plan);
      setLearningPlans(prev => [...prev, plan]);
      setLearningTopic("");
      // Reset depth to standard or keep as is? Let's reset to standard/auto?
      // setLearningDepth("standard"); 
    } catch (error) {
      console.error("Failed to add learning plan", error);
    } finally {
      setSaving(false);
    }
  }, [userId, learningTopic, learningDepth, learningDays, learningPlans]);

  const handleSave = useCallback(async () => {
    if (interests.length === 0 && !learningTopic.trim()) {
      // Allow saving just interests if topic is empty
      if (interests.length > 0) {
        setSaving(true);
        try {
          await saveUserInterests(userId, interests);
          onComplete();
        } catch (e) {
          console.error(e);
          setSaving(false);
        }
      }
      return;
    }

    setSaving(true);
    try {
      // Always save interests if they exist
      if (interests.length) {
        await saveUserInterests(userId, interests);
      }

      // Add new plan if topic is provided
      if (learningTopic.trim()) {
        // Check if topic already exists
        if (!learningPlans.some(p => p.topic.toLowerCase() === learningTopic.trim().toLowerCase())) {
          const now = new Date().toISOString();
          const plan: OrbitLearningPlan = {
            id: crypto.randomUUID(),
            topic: learningTopic.trim(),
            depth: learningDepth,
            totalLessons: learningDays,
            currentLesson: 0,
            startedAt: now,
            updatedAt: now,
            completedLessons: [],
          };
          await saveLearningPlan(userId, plan);
        }
      }
      onComplete();
    } catch (error) {
      console.error("Failed to save interests/plan", error);
      setSaving(false);
    }
  }, [userId, interests, learningTopic, learningDepth, learningDays, learningPlans, onComplete]);

  return (
    <Card
      className={cn(
        "rounded-[28px] p-6 shadow-lg",
        dark
          ? "border-white/20 bg-slate-900/95 text-white"
          : "border-indigo-200 bg-white/95 text-slate-900"
      )}
    >
      <CardHeader className="p-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className={cn("h-5 w-5", dark ? "text-indigo-300" : "text-indigo-500")} />
              <CardTitle className={cn("text-xl", dark ? "text-white" : "text-slate-900")}>
                Set Your Interests
              </CardTitle>
            </div>
            <p className={cn("text-sm mt-2", dark ? "text-indigo-200" : "text-indigo-600")}>
              Tell us what you&rsquo;re interested in, and we&rsquo;ll curate daily article summaries just for you.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="mt-6 space-y-4">
        <div>
          <label
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.35em] mb-2 block",
              dark ? "text-indigo-200" : "text-indigo-500"
            )}
          >
            Add Interests
          </label>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type an interest and press Enter"
              className={cn(
                dark
                  ? "border-white/30 bg-slate-900/50 text-white placeholder:text-white/40"
                  : "border-indigo-200"
              )}
            />
            <Button
              onClick={() => addInterest(inputValue)}
              disabled={!inputValue.trim()}
              className={cn(
                "text-white",
                dark ? "bg-indigo-500 hover:bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-500"
              )}
            >
              Add
            </Button>
          </div>
        </div>

        {interests.length > 0 && (
          <div>
            <p className={cn("text-xs font-semibold uppercase tracking-[0.35em] mb-2", dark ? "text-indigo-200" : "text-indigo-500")}>
              Your Interests ({interests.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <Badge
                  key={interest}
                  variant="outline"
                  className={cn(
                    "px-3 py-1 text-sm font-medium flex items-center gap-2",
                    dark
                      ? "border-white/20 bg-white/10 text-indigo-100"
                      : "border-indigo-200 bg-indigo-50 text-indigo-700"
                  )}
                >
                  {interest}
                  <button
                    onClick={() => removeInterest(interest)}
                    className="ml-1 hover:opacity-70"
                    aria-label={`Remove ${interest}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className={cn("text-xs font-semibold uppercase tracking-[0.35em] mb-2", dark ? "text-indigo-200" : "text-indigo-500")}>
            Suggested
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_INTERESTS.filter((suggested) => !interests.some((i) => i.toLowerCase() === suggested.toLowerCase())).map((suggested) => (
              <Badge
                key={suggested}
                variant="outline"
                onClick={() => addInterest(suggested)}
                className={cn(
                  "px-3 py-1 text-sm font-medium cursor-pointer hover:opacity-80 transition",
                  dark
                    ? "border-white/15 bg-white/5 text-indigo-200 hover:bg-white/10"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                )}
              >
                + {suggested}
              </Badge>
            ))}
          </div>
        </div>

        {learningPlans.length > 0 && (
          <div className="mt-3 space-y-3">
            {learningPlans.map((plan) => (
              <div key={plan.id} className={cn(
                "rounded-xl border p-3 relative",
                dark ? "border-white/20 bg-white/5" : "border-amber-200 bg-white"
              )}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={cn("text-xs font-semibold uppercase tracking-[0.35em] mb-2", dark ? "text-amber-200" : "text-amber-600")}>
                      Active Topic
                    </p>
                    <p className={cn("text-sm font-semibold", dark ? "text-white" : "text-slate-900")}>
                      {plan.topic}
                    </p>
                    <p className={cn("text-xs mt-1", dark ? "text-slate-300" : "text-slate-600")}>
                      {plan.totalLessons} days ({plan.depth}) ·
                      Lesson {plan.currentLesson + 1} of {plan.totalLessons}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePlan(plan.id)}
                    disabled={deletingPlanId === plan.id}
                    className={cn(
                      "h-8 w-8 p-0",
                      dark ? "text-slate-400 hover:text-red-400" : "text-slate-400 hover:text-red-600"
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {learningPlans.length < 5 ? (
          <>
            <p className={cn("mt-4 text-xs", dark ? "text-indigo-200" : "text-slate-600")}>
              {learningPlans.length > 0 ? "Add another topic:" : "Set a topic and depth to get a daily micro-lesson and mini quiz in your dashboard."}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.35em]",
                    dark ? "text-indigo-200" : "text-indigo-500"
                  )}
                >
                  Topic
                </label>
                <Input
                  value={learningTopic}
                  onChange={(e) => setLearningTopic(e.target.value)}
                  placeholder="e.g., Neural networks basics"
                  className={cn(
                    dark
                      ? "border-white/30 bg-slate-900/50 text-white placeholder:text-white/40"
                      : "border-indigo-200"
                  )}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.35em]",
                    dark ? "text-indigo-200" : "text-indigo-500"
                  )}
                >
                  Expertise Level
                </label>
                <select
                  value={learningDepth}
                  onChange={(e) => setLearningDepth(e.target.value as OrbitLearningPlan["depth"])}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-sm",
                    dark ? "border-white/30 bg-slate-900/50 text-white" : "border-indigo-200 bg-white text-slate-700"
                  )}
                >
                  <option value="auto">Auto (AI Recommended)</option>
                  <option value="light">Basic (1 week)</option>
                  <option value="standard">Intermediate (2 weeks)</option>
                  <option value="deep">Advanced (30 days)</option>
                  <option value="expert">Expert (60 days)</option>
                </select>
                {learningDepth === "auto" && (
                  <p className={cn("text-xs mt-1", dark ? "text-indigo-300" : "text-indigo-600")}>
                    {isSuggesting ? (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 animate-pulse" /> AI is estimating duration...
                      </span>
                    ) : suggestedDays ? (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AI suggests {suggestedDays} days
                      </span>
                    ) : (
                      "AI will suggest a duration based on the topic."
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleAddPlan}
                disabled={!learningTopic.trim() || saving}
                size="sm"
                variant="outline"
                className={cn(
                  "gap-2",
                  dark ? "border-white/20 text-indigo-200 hover:bg-white/10" : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                )}
              >
                <Plus className="h-4 w-4" />
                Add Learning Path
              </Button>
            </div>
          </>
        ) : (
          <div className={cn(
            "mt-4 rounded-xl border p-3",
            dark ? "border-amber-200/30 bg-amber-500/10" : "border-amber-200 bg-amber-50"
          )}>
            <p className={cn("text-xs font-medium", dark ? "text-amber-200" : "text-amber-700")}>
              You have reached the maximum of 5 learning paths. Complete or delete one to add more.
            </p>
          </div>
        )}
        {loading ? (
          <div className={cn("flex items-center gap-3 py-4 text-sm", dark ? "text-slate-300" : "text-slate-600")}>
            <span>Loading your interests...</span>
          </div>
        ) : (
          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={
                Boolean(
                  (interests.length === 0 && !learningTopic.trim()) ||
                  saving ||
                  (learningTopic.trim() && learningPlans.some(p => p.topic.toLowerCase() === learningTopic.trim().toLowerCase()))
                )
              }
              className={cn(
                "text-white",
                dark ? "bg-indigo-500 hover:bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-500"
              )}
            >
              {saving ? "Saving..." : "Done"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card >
  );
}
