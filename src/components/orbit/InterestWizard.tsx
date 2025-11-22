"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { saveUserInterests, saveLearningPlan, getUserInterests, getLearningPlan } from "@/lib/orbitSummaryService";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  const [existingLearningPlan, setExistingLearningPlan] = useState<OrbitLearningPlan | null>(null);
  const [deletingLearningPlan, setDeletingLearningPlan] = useState(false);

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
        const [userInterests, learningPlan] = await Promise.all([
          getUserInterests(userId),
          getLearningPlan(userId),
        ]);
        
        if (userInterests?.interests) {
          setInterests(userInterests.interests);
        }
        
        if (learningPlan) {
          setExistingLearningPlan(learningPlan);
          setLearningTopic(learningPlan.topic);
          setLearningDepth(learningPlan.depth);
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

  const handleDeleteLearningPlan = useCallback(async () => {
    if (!existingLearningPlan) return;
    
    if (!confirm("Are you sure you want to delete your current learning topic? This cannot be undone.")) {
      return;
    }
    
    setDeletingLearningPlan(true);
    try {
      const ref = doc(db, "users", userId, "preferences", "orbit-learning-plan");
      await deleteDoc(ref);
      setExistingLearningPlan(null);
      setLearningTopic("");
      setLearningDepth("standard");
    } catch (error) {
      console.error("Failed to delete learning plan", error);
    } finally {
      setDeletingLearningPlan(false);
    }
  }, [userId, existingLearningPlan]);

  const handleSave = useCallback(async () => {
    if (interests.length === 0 && !learningTopic.trim()) {
      return;
    }
    
    // Prevent creating a new learning topic if one already exists
    if (existingLearningPlan && learningTopic.trim() && learningTopic.trim() !== existingLearningPlan.topic) {
      return;
    }
    
    setSaving(true);
    try {
      // Always save interests if they exist
      if (interests.length) {
        await saveUserInterests(userId, interests);
      }
      // Only create a new learning plan if one doesn't exist and a topic is provided
      if (learningTopic.trim() && !existingLearningPlan) {
        const now = new Date().toISOString();
        const totalLessons =
          learningDepth === "deep" ? 30 : learningDepth === "standard" ? 10 : 7;
        const plan: OrbitLearningPlan = {
          topic: learningTopic.trim(),
          depth: learningDepth,
          totalLessons,
          currentLesson: 0,
          startedAt: now,
          updatedAt: now,
          completedLessons: [],
        };
        await saveLearningPlan(userId, plan);
      }
      onComplete();
    } catch (error) {
      console.error("Failed to save interests", error);
      setSaving(false);
    }
  }, [userId, interests, learningTopic, learningDepth, existingLearningPlan, onComplete]);

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

        <div className={cn(
          "rounded-2xl border p-4",
          existingLearningPlan
            ? dark ? "border-amber-200/30 bg-amber-500/10" : "border-amber-200 bg-amber-50/60"
            : dark ? "border-dashed border-white/20" : "border-dashed border-indigo-200/70"
        )}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className={cn("h-4 w-4", dark ? "text-indigo-200" : "text-indigo-500")} />
              <p className={cn("text-sm font-semibold", dark ? "text-white" : "text-slate-900")}>
                Learning mode (bite-sized lessons)
              </p>
            </div>
            {existingLearningPlan && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteLearningPlan}
                disabled={deletingLearningPlan}
                className={cn(
                  "gap-1 text-xs",
                  dark ? "text-amber-200 hover:text-amber-100 hover:bg-amber-500/20" : "text-amber-700 hover:text-amber-800 hover:bg-amber-100"
                )}
              >
                <Trash2 className="h-3 w-3" />
                {deletingLearningPlan ? "Deleting..." : "Delete"}
              </Button>
            )}
          </div>
          
          {existingLearningPlan ? (
            <div className="mt-3 space-y-3">
              <div className={cn(
                "rounded-xl border p-3",
                dark ? "border-white/20 bg-white/5" : "border-amber-200 bg-white"
              )}>
                <p className={cn("text-xs font-semibold uppercase tracking-[0.35em] mb-2", dark ? "text-amber-200" : "text-amber-600")}>
                  Current Learning Topic
                </p>
                <p className={cn("text-sm font-semibold", dark ? "text-white" : "text-slate-900")}>
                  {existingLearningPlan.topic}
                </p>
                <p className={cn("text-xs mt-1", dark ? "text-slate-300" : "text-slate-600")}>
                  {existingLearningPlan.depth === "deep" ? "30 days (deep)" : existingLearningPlan.depth === "standard" ? "10 days (standard)" : "7 days (light)"} · 
                  Lesson {existingLearningPlan.currentLesson + 1} of {existingLearningPlan.totalLessons}
                </p>
              </div>
              <div className={cn(
                "rounded-xl border p-3",
                dark ? "border-amber-200/30 bg-amber-500/10" : "border-amber-200 bg-amber-50"
              )}>
                <p className={cn("text-xs font-medium", dark ? "text-amber-200" : "text-amber-700")}>
                  ⚠️ You can only have one active learning topic at a time. Delete the current topic to start a new one.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className={cn("mt-1 text-xs", dark ? "text-indigo-200" : "text-slate-600")}>
                Set a topic and depth to get a daily micro-lesson and mini quiz in your dashboard.
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
                <div className="space-y-1">
                  <label
                    className={cn(
                      "text-xs font-semibold uppercase tracking-[0.35em]",
                      dark ? "text-indigo-200" : "text-indigo-500"
                    )}
                  >
                    Depth
                  </label>
                  <select
                    value={learningDepth}
                    onChange={(e) => setLearningDepth(e.target.value as OrbitLearningPlan["depth"])}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-sm",
                      dark ? "border-white/30 bg-slate-900/50 text-white" : "border-indigo-200 bg-white text-slate-700"
                    )}
                  >
                    <option value="light">1 week (light)</option>
                    <option value="standard">10 days (standard)</option>
                    <option value="deep">30 days (deep)</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className={cn("flex items-center gap-3 py-4 text-sm", dark ? "text-slate-300" : "text-slate-600")}>
            <span>Loading your interests...</span>
          </div>
        ) : (
          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={
                (interests.length === 0 && !learningTopic.trim()) || 
                saving || 
                (existingLearningPlan && learningTopic.trim() && learningTopic.trim() !== existingLearningPlan.topic)
              }
              className={cn(
                "text-white",
                dark ? "bg-indigo-500 hover:bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-500"
              )}
            >
              {saving ? "Saving..." : "Save Interests"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
