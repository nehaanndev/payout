"use client";

import { X, ExternalLink, Archive, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { SharedLink } from "@/types/share";
import type { OrbitSummary } from "@/types/orbit";

type LinkDetailPanelProps = {
  link: SharedLink | null;
  summary: OrbitSummary | null;
  summaryLoading: boolean;
  open: boolean;
  onClose: () => void;
  onArchive: (linkId: string) => Promise<void>;
  dark?: boolean;
};

export function LinkDetailPanel({
  link,
  summary,
  summaryLoading,
  open,
  onClose,
  onArchive,
  dark = false,
}: LinkDetailPanelProps) {
  if (!link) {
    return null;
  }

  const handleArchive = async () => {
    await onArchive(link.id);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-2xl overflow-y-auto",
          dark
            ? "border-white/10 bg-slate-900/95 text-white"
            : "border-slate-100 bg-white"
        )}
      >
        <SheetHeader className={cn("border-b pb-4", dark ? "border-white/10" : "border-slate-100")}>
          <div className="flex items-start justify-between gap-4">
            <SheetTitle className={cn("text-xl font-semibold", dark ? "text-white" : "text-slate-900")}>
              {link.title || "Untitled"}
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className={cn(dark ? "text-white hover:bg-white/10" : "")}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* URL and metadata */}
          <div className="space-y-3">
            {link.url ? (
              <div>
                <p className={cn("text-xs font-semibold uppercase tracking-[0.35em] mb-2", dark ? "text-slate-300" : "text-slate-500")}>
                  Link
                </p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 text-sm break-all hover:underline",
                    dark ? "text-indigo-300" : "text-indigo-600"
                  )}
                >
                  {link.url}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  dark
                    ? "border-white/20 bg-white/10 text-slate-300"
                    : "border-slate-200 text-slate-600"
                )}
              >
                {link.contentType}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  dark
                    ? "border-white/20 bg-white/10 text-slate-300"
                    : "border-slate-200 text-slate-600"
                )}
              >
                {link.status}
              </Badge>
              {link.summarizable ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    dark
                      ? "border-indigo-200/30 bg-indigo-500/20 text-indigo-200"
                      : "border-indigo-200 bg-indigo-50 text-indigo-700"
                  )}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Summarizable
                </Badge>
              ) : null}
            </div>
          </div>

          {/* Description */}
          {link.description ? (
            <div>
              <p className={cn("text-xs font-semibold uppercase tracking-[0.35em] mb-2", dark ? "text-slate-300" : "text-slate-500")}>
                Description
              </p>
              <p className={cn("text-sm whitespace-pre-line", dark ? "text-slate-200" : "text-slate-700")}>
                {link.description}
              </p>
            </div>
          ) : null}

          {/* Tags */}
          {link.tags && link.tags.length > 0 ? (
            <div>
              <p className={cn("text-xs font-semibold uppercase tracking-[0.35em] mb-2", dark ? "text-slate-300" : "text-slate-500")}>
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {link.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn(
                      "px-3 py-1 text-xs",
                      dark
                        ? "border-white/20 bg-white/5 text-indigo-100"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    )}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {/* AI Summary */}
          {link.summarizable ? (
            <div
              className={cn(
                "rounded-2xl border p-4",
                dark
                  ? "border-white/15 bg-white/5"
                  : "border-indigo-100 bg-indigo-50/70"
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className={cn("h-5 w-5", dark ? "text-indigo-300" : "text-indigo-500")} />
                <p className={cn("text-sm font-semibold", dark ? "text-indigo-100" : "text-indigo-700")}>
                  AI Summary
                </p>
              </div>
              {summaryLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Spinner size="sm" />
                  <span className={cn(dark ? "text-indigo-200" : "text-indigo-600")}>
                    Generating summary...
                  </span>
                </div>
              ) : summary ? (
                <div className="space-y-3">
                  <p className={cn("text-sm", dark ? "text-indigo-50/80" : "text-indigo-600")}>
                    {summary.summary}
                  </p>
                  {summary.keyPoints && summary.keyPoints.length > 0 ? (
                    <ul className={cn("list-disc list-inside space-y-1 text-xs", dark ? "text-indigo-100/80" : "text-indigo-600")}>
                      {summary.keyPoints.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <p className={cn("text-sm", dark ? "text-indigo-200" : "text-indigo-600")}>
                  Summary not available yet.
                </p>
              )}
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : undefined }}>
            {link.url ? (
              <Button
                variant="outline"
                onClick={() => {
                  if (typeof window !== "undefined" && link.url) {
                    window.open(link.url, "_blank", "noopener,noreferrer");
                  }
                }}
                className={cn(
                  dark
                    ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                    : "border-slate-200 text-slate-700 hover:bg-slate-100"
                )}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Link
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={handleArchive}
              className={cn(
                dark
                  ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100"
              )}
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

