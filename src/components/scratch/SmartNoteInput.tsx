"use client";

import { useState } from "react";
import { Sparkles, RotateCcw, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TagInput } from "@/components/orbit/TagInput";

interface SmartNoteInputProps {
    noteBody: string;
    setNoteBody: (value: string) => void;
    noteTags: string;
    setNoteTags: (value: string) => void;
    tagSuggestions: string[];
    disabled?: boolean;
    isNight?: boolean;
}

export function SmartNoteInput({
    noteBody,
    setNoteBody,
    noteTags,
    setNoteTags,
    tagSuggestions,
    disabled,
    isNight,
}: SmartNoteInputProps) {
    const [mode, setMode] = useState<"write" | "preview">("write");
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRawText, setLastRawText] = useState<string | null>(null);

    const handleSmartFormat = async () => {
        if (!noteBody.trim()) return;

        // Save raw text to allow undo
        setLastRawText(noteBody);
        setProcessing(true);
        setError(null);

        try {
            const response = await fetch("/api/orbit/smart-note", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: noteBody }),
            });

            if (!response.ok) {
                throw new Error("Failed to format note");
            }

            const data = await response.json();
            if (data.markdown) {
                setNoteBody(data.markdown);
                setMode("preview");
            }
        } catch (err) {
            console.error(err);
            setError("Couldn't format note right now. Try again later.");
        } finally {
            setProcessing(false);
        }
    };

    const handleUndo = () => {
        if (lastRawText !== null) {
            setNoteBody(lastRawText);
            setLastRawText(null);
            setMode("write");
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Tabs value={mode} onValueChange={(v) => setMode(v as "write" | "preview")} className="w-40">
                    <TabsList className={cn("grid w-full grid-cols-2 h-8", isNight ? "bg-slate-800" : "")}>
                        <TabsTrigger value="write" className="text-xs h-6">Write</TabsTrigger>
                        <TabsTrigger value="preview" className="text-xs h-6" disabled={!noteBody.trim()}>Preview</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2">
                    {lastRawText && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-slate-500"
                            onClick={handleUndo}
                            disabled={disabled || processing}
                        >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Undo
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSmartFormat}
                        disabled={disabled || processing || !noteBody.trim()}
                        className={cn(
                            "h-8 text-xs transition-all",
                            isNight
                                ? "border-indigo-400/30 text-indigo-300 hover:bg-indigo-500/20"
                                : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        )}
                    >
                        {processing ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Smart Format
                    </Button>
                </div>
            </div>

            <div className={cn(
                "relative rounded-md border transition-all",
                isNight ? "border-slate-800" : "border-slate-200",
                mode === "preview" ? (isNight ? "bg-slate-900/50" : "bg-slate-50") : ""
            )}>
                {mode === "write" ? (
                    <Textarea
                        value={noteBody}
                        onChange={(event) => setNoteBody(event.target.value)}
                        placeholder="What do you want to remember? (e.g. 'buy milk, eggs, meeting with Sarah')"
                        className={cn(
                            "min-h-[160px] resize-y border-0 bg-transparent focus-visible:ring-0",
                            isNight ? "placeholder:text-slate-500" : ""
                        )}
                        disabled={disabled || processing}
                    />
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none p-3 min-h-[160px] overflow-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteBody}</ReactMarkdown>
                    </div>
                )}
            </div>

            {error && (
                <p className="text-xs text-rose-500">{error}</p>
            )}

            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="smart-note-tags">
                    Tags (optional)
                </label>
                <TagInput
                    id="smart-note-tags"
                    value={noteTags}
                    onValueChange={setNoteTags}
                    suggestions={tagSuggestions}
                    placeholder="brainstorm, follow-up"
                    disabled={disabled || processing}
                />
            </div>
        </div>
    );
}
