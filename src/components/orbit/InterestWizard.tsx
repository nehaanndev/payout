"use client";

import { useState, useCallback } from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { saveUserInterests, getUserInterests } from "@/lib/orbitSummaryService";

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
    if (interests.length === 0) {
      return;
    }
    setSaving(true);
    try {
      await saveUserInterests(userId, interests);
      onComplete();
    } catch (error) {
      console.error("Failed to save interests", error);
      setSaving(false);
    }
  }, [userId, interests, onComplete]);

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
              Tell us what you're interested in, and we'll curate daily article summaries just for you.
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

        <div className="flex justify-end gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={interests.length === 0 || saving}
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

