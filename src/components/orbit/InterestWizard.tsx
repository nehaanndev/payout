"use client";

import { useState, useCallback } from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { saveUserInterests, saveLearningPlan } from "@/lib/orbitSummaryService";
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
  const [learningTopic, setLearningTopic] = useState("");
  const [learningDepth, setLearningDepth] = useState<OrbitLearningPlan["depth"]>("standard");

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

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addInterest(inputValue);
    }
  }, [inputValue, addInterest]);

  const handleSave = useCallback(async () => {
    if (interests.length === 0 && !learningTopic.trim()) {
      return;
    }
    setSaving(true);
    try {
      if (interests.length) {
        await saveUserInterests(userId, interests);
      }
      if (learningTopic.trim()) {
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
  }, [userId, interests, learningTopic, learningDepth, onComplete]);

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

        <div className="rounded-2xl border border-dashed border-indigo-200/70 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className={cn("h-4 w-4", dark ? "text-indigo-200" : "text-indigo-500")} />
            <p className={cn("text-sm font-semibold", dark ? "text-white" : "text-slate-900")}>
              Learning mode (bite-sized lessons)
            </p>
          </div>
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
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={(interests.length === 0 && !learningTopic.trim()) || saving}
            className={cn(
              "text-white",
              dark ? "bg-indigo-500 hover:bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-500"
            )}
          >
            {saving ? "Saving..." : "Save Interests"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
