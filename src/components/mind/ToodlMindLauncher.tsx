"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Send, Sparkles, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  MindDebugTrace,
  MindEditableMessageField,
  MindIntent,
  MindRequest,
  MindResponse,
} from "@/lib/mind/types";
import { useToodlMind } from "./ToodlMindProvider";

const responseLabel = (status: string) => {
  switch (status) {
    case "executed":
      return "Action completed";
    case "needs_confirmation":
      return "Review and confirm";
    case "failed":
      return "Something went wrong";
    default:
      return "Update";
  }
};

export default function ToodlMindLauncher() {
  const {
    ask,
    pending,
    error,
    lastResponse,
    history,
    identity,
    reset,
  } = useToodlMind();

  const [open, setOpen] = useState(false);
  const [utterance, setUtterance] = useState("");
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [editableTemplate, setEditableTemplate] = useState<string | null>(null);
  const [editableValues, setEditableValues] =
    useState<Record<string, string> | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const applyTemplate = useMemo(
    () => (template: string, values: Record<string, string>) =>
      template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? ""),
    []
  );

  useEffect(() => {
    if (open) {
      reset();
      setUtterance("");
      setLastPrompt(null);
      setEditableTemplate(null);
      setEditableValues(null);
    }
  }, [open, reset]);

  useEffect(() => {
    if (
      lastResponse?.status === "needs_confirmation" &&
      lastResponse.editableMessage
    ) {
      const nextValues: Record<string, string> = {};
      lastResponse.editableMessage.fields.forEach((field) => {
        nextValues[field.key] = field.value;
      });
      setEditableTemplate(lastResponse.editableMessage.template);
      setEditableValues(nextValues);
    } else {
      setEditableTemplate(null);
      setEditableValues(null);
    }
  }, [lastResponse]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleExternalOpen = () => setOpen(true);
    window.addEventListener("open-toodl-mind", handleExternalOpen);
    return () => {
      window.removeEventListener("open-toodl-mind", handleExternalOpen);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setDarkMode(window.document.documentElement.classList.contains("dashboard-night"));
    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setDarkMode(detail === "night");
    };
    window.addEventListener("toodl-theme-change", handleThemeChange);
    return () => window.removeEventListener("toodl-theme-change", handleThemeChange);
  }, []);

  const readyForCommands = useMemo(
    () => Boolean(identity?.userId || identity?.email),
    [identity]
  );

  const handlePlan = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = utterance.trim();
    if (!trimmed || pending) {
      return;
    }
    setLastPrompt(trimmed);
    await ask({ utterance: trimmed });
    setUtterance("");
  };

  const handleExecute = async () => {
    if (!lastResponse) {
      return;
    }
    const latestTurn = history[history.length - 1];
    const confirmUtterance =
      latestTurn?.request.utterance ?? lastPrompt ?? "";
    if (!confirmUtterance.trim()) {
      return;
    }

    const contextHints: Record<string, unknown> = { autoExecute: true };
    if (lastResponse.status === "needs_confirmation") {
      contextHints.intentOverride = JSON.parse(
        JSON.stringify(lastResponse.intent)
      );
      if (editableValues) {
        contextHints.editableOverrides = editableValues;
      }
      if (editableTemplate && editableValues) {
        contextHints.intentMessage = applyTemplate(
          editableTemplate,
          editableValues
        );
      }
    }

    await ask({
      utterance: confirmUtterance,
      contextHints,
    });
  };

  const handleDiscard = () => {
    reset();
    setEditableTemplate(null);
    setEditableValues(null);
    setLastPrompt(null);
  };

  const messages = useMemo(() => {
    return history.flatMap((turn) => {
      const items: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        responseStatus?: string;
        statusText?: string;
        editableMessage?: {
          template: string;
          fields: MindEditableMessageField[];
        };
        turnError?: string;
        isLatest?: boolean;
      }> = [];

      items.push({
        id: `${turn.id}-user`,
        role: "user",
        content: turn.request.utterance,
      });

      if (turn.error) {
        items.push({
          id: `${turn.id}-error`,
          role: "assistant",
          content: turn.error,
          turnError: turn.error,
          statusText: responseLabel("failed"),
          isLatest: turn.id === history[history.length - 1]?.id,
        });
      } else if (turn.response) {
        const response = turn.response;
        if (response.status === "failed") {
          items.push({
            id: `${turn.id}-assistant`,
            role: "assistant",
            content: response.error ?? "I ran into an unexpected error. Please try again.",
            responseStatus: response.status,
            statusText: responseLabel(response.status),
            turnError: response.error ?? undefined,
            isLatest: turn.id === history[history.length - 1]?.id,
          });
        } else {
          items.push({
            id: `${turn.id}-assistant`,
            role: "assistant",
            content: response.message,
            responseStatus: response.status,
            statusText: responseLabel(response.status),
            editableMessage: response.editableMessage,
            isLatest: turn.id === history[history.length - 1]?.id,
          });
        }
      }

      return items;
    });
  }, [history]);

  const debugEntries = useMemo(() => {
    return history
      .slice(-3)
      .map((turn) => {
        const response = turn.response;
        const intent =
          response && response.status === "needs_confirmation"
            ? response.intent
            : undefined;
        const status = response?.status ?? (turn.error ? "failed" : "pending");
        const responseError =
          response?.status === "failed" ? response.error : undefined;
        return {
          id: turn.id,
          utterance: turn.request.utterance,
          contextHints: turn.request.contextHints,
          status,
          error: turn.error ?? responseError,
          intent,
          response,
          createdAt: turn.createdAt,
          debugTrace: response?.debug ?? [],
        };
      })
      .reverse();
  }, [history]);

  const showConfirmControls =
    lastResponse?.status === "needs_confirmation" && !pending;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-[1500] flex h-14 w-14 items-center justify-center rounded-full text-indigo-50 shadow-xl transition focus:outline-none focus:ring-2 focus:ring-offset-2",
          darkMode
            ? "bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-900 shadow-slate-900/50"
            : "bg-gradient-to-br from-indigo-400 via-indigo-500 to-violet-500 shadow-indigo-300/60 hover:from-indigo-500 hover:via-indigo-600 hover:to-violet-600"
        )}
        aria-label="Open Toodl Mind"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className={cn(
            "flex h-full max-h-screen w-full flex-col gap-4 rounded-t-3xl p-0 sm:max-w-md",
            darkMode
              ? "bg-slate-900 text-white shadow-[0_16px_48px_-12px_rgba(2,6,23,0.7)]"
              : "bg-white text-slate-900 shadow-[0_16px_48px_-12px_rgba(79,70,229,0.35)]"
          )}
        >
          <SheetHeader className="px-6 pt-6">
            <SheetTitle
              className={cn(
                "flex items-center gap-2 text-base font-semibold",
                darkMode ? "text-white" : "text-slate-900"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  darkMode
                    ? "bg-gradient-to-br from-slate-700 via-slate-800 to-indigo-800 text-white"
                    : "bg-gradient-to-br from-indigo-400 via-indigo-500 to-violet-500 text-indigo-50"
                )}
              >
                <Sparkles className="h-4 w-4" />
              </span>
              Toodl Mind
            </SheetTitle>
            <SheetDescription className={cn(darkMode ? "text-slate-200" : "text-slate-500")}>
              Ask for help across expenses, budgets, flows, or links. Plan first,
              then confirm or dismiss.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6">
            <div className="flex flex-col space-y-4 pb-6">
              <div
                className={cn(
                  "rounded-xl border p-4",
                  darkMode
                    ? "border-slate-800 bg-slate-800/80 text-white"
                    : "border-indigo-100 bg-indigo-50/60"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={cn("text-sm font-semibold", darkMode ? "text-white" : "text-indigo-900")}>
                      Parser debug
                    </p>
                    <p className={cn("text-xs", darkMode ? "text-slate-300" : "text-indigo-700/70")}>
                      Toggle to inspect how Toodl Mind extracted intent details.
                    </p>
                  </div>
                  <Switch
                    checked={debugEnabled}
                    onCheckedChange={setDebugEnabled}
                    aria-label="Toggle parser debug"
                  />
                </div>
                {debugEnabled ? (
                  <div className="mt-4">
                    <MindDebugPanel entries={debugEntries} darkMode={darkMode} />
              </div>
                ) : null}
              </div>
              {messages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-muted p-4 text-sm text-muted-foreground">
                  Share what you need, like “Add $30 groceries at Safeway to Home
                  Budget” or “Plan a 45 minute yoga session tomorrow.”
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <MessageBubble
                      key={message.id}
                      role={message.role}
                      status={message.responseStatus}
                      isLatest={message.isLatest}
                      statusText={message.statusText}
                      error={message.turnError}
                    >
                    {message.responseStatus === "needs_confirmation" &&
                    message.editableMessage &&
                    message.isLatest &&
                    editableTemplate &&
                    editableValues ? (
                      <EditableConfirmationPreview
                        template={editableTemplate}
                        fields={message.editableMessage.fields}
                        values={editableValues}
                        onChange={(key, value) =>
                          setEditableValues((prev) =>
                            prev ? { ...prev, [key]: value } : prev
                          )
                        }
                      />
                    ) : (
                      <p
                        className={cn(
                          "text-sm leading-relaxed",
                          isUser ? "text-indigo-50" : "text-indigo-900/80"
                        )}
                      >
                        {message.content}
                      </p>
                    )}
                    {message.isLatest && message.turnError ? (
                      <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {message.turnError}
                      </p>
                    ) : null}
                    {message.isLatest &&
                    showConfirmControls &&
                    message.responseStatus === "needs_confirmation" ? (
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          className="gap-2 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-400/40 transition hover:brightness-105"
                          onClick={handleExecute}
                          disabled={pending}
                        >
                          {pending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Execute
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-indigo-500/60 text-indigo-600 hover:bg-indigo-50/70"
                          onClick={handleDiscard}
                          disabled={pending}
                        >
                          <X className="h-4 w-4" />
                          Discard
                        </Button>
                      </div>
                    ) : null}
                    </MessageBubble>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-muted px-6 pb-6">
            <form
              onSubmit={handlePlan}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl p-3",
                      darkMode ? "bg-slate-800/70" : "bg-muted/40"
                    )}
                  >
              <Textarea
                value={utterance}
                onChange={(event) => setUtterance(event.target.value)}
                placeholder='Try “Add $30 to Home Budget for groceries at Safeway.”'
                rows={3}
                disabled={pending || !readyForCommands}
                className="resize-none border-none bg-transparent focus-visible:ring-0"
              />
              {!readyForCommands ? (
                <p className="text-xs text-muted-foreground">
                  Sign in to route requests through Toodl Mind.
                </p>
              ) : null}
              {error ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setUtterance("")}
                  disabled={pending || !utterance}
                  aria-label="Clear"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={pending || !readyForCommands || !utterance.trim()}
                  className="gap-2 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white transition hover:brightness-105"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Plan
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

type MessageBubbleProps = {
  role: "user" | "assistant";
  status?: string;
  isLatest?: boolean;
  statusText?: string | null;
  error?: string;
  children: React.ReactNode;
};

const MessageBubble = ({
  role,
  status,
  isLatest,
  statusText,
  error,
  children,
}: MessageBubbleProps) => {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        isUser ? "items-end text-right" : "items-start text-left"
      )}
    >
      <div
        className={cn(
          "max-w-[90%] rounded-3xl border px-4 py-3 text-sm shadow-sm transition",
          isUser
            ? "rounded-br-none border-indigo-500/70 bg-indigo-600 text-white shadow-lg shadow-indigo-400/40"
            : "rounded-bl-none border-indigo-100 bg-indigo-50 text-indigo-900 shadow-md"
        )}
      >
        {!isUser && status && statusText ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-indigo-500">
            {statusText}
          </p>
        ) : null}
        <div className="space-y-1">{children}</div>
      </div>
      {error && !isUser ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      {isLatest && !isUser && status === "needs_confirmation" ? (
        <p className="text-xs text-muted-foreground">
          Adjust the highlights, then execute or discard.
        </p>
      ) : null}
    </div>
  );
};

type EditableConfirmationPreviewProps = {
  template: string;
  fields: MindEditableMessageField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

const EditableConfirmationPreview = ({
  template,
  fields,
  values,
  onChange,
}: EditableConfirmationPreviewProps) => {
  const fieldMap = new Map<string, MindEditableMessageField>();
  fields.forEach((field) => {
    fieldMap.set(field.key, field);
  });

  const segments: Array<string | React.ReactNode> = [];
  let lastIndex = 0;
  const regex = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    const [placeholder, key] = match;
    if (match.index > lastIndex) {
      segments.push(template.slice(lastIndex, match.index));
    }
    const field = fieldMap.get(key);
    if (field) {
      segments.push(
        <InlineEditableToken
          key={key}
          label={field.label}
          value={values[key] ?? field.value}
          onChange={(next) => onChange(key, next)}
        />
      );
    } else {
      segments.push(placeholder);
    }
    lastIndex = match.index + placeholder.length;
  }

  if (lastIndex < template.length) {
    segments.push(template.slice(lastIndex));
  }

  return (
    <p className="text-sm text-muted-foreground">
      {segments.map((segment, index) =>
        typeof segment === "string" ? (
          <span key={`text-${index}`}>{segment}</span>
        ) : (
          segment
        )
      )}
    </p>
  );
};

type InlineEditableTokenProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const InlineEditableToken = ({
  label,
  value,
  onChange,
}: InlineEditableTokenProps) => (
  <span className="mx-1 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      size={Math.max(value.length, label.length, 4)}
      className="w-auto appearance-none border-none bg-transparent text-sm font-medium text-primary outline-none focus:outline-none focus:ring-0"
    />
  </span>
);

type MindDebugEntry = {
  id: string;
  utterance: string;
  contextHints?: MindRequest["contextHints"];
  status: string;
  error?: string;
  intent?: MindIntent;
  response?: MindResponse | null;
  createdAt: number;
  debugTrace: MindDebugTrace[];
};

const MindDebugPanel = ({
  entries,
  darkMode,
}: {
  entries: MindDebugEntry[];
  darkMode: boolean;
}) => {
  if (!entries.length) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed p-4 text-xs",
          darkMode
            ? "border-slate-700 bg-slate-800/70 text-slate-200"
            : "border-indigo-200 bg-white/70 text-indigo-900/70"
        )}
      >
        No parser insights yet. Enter a request to see how intents are derived.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={cn(
            "rounded-lg border p-4 shadow-sm",
            darkMode ? "border-slate-800 bg-slate-800/70 text-slate-100" : "border-white/60 bg-white/90"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={cn("text-sm font-semibold", darkMode ? "text-white" : "text-indigo-900")}>
                {entry.utterance}
              </p>
              <p className={cn("text-xs", darkMode ? "text-slate-300" : "text-indigo-500")}>
                Status: {entry.status}
                {entry.error ? ` · ${entry.error}` : ""}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide",
                darkMode ? "bg-slate-700 text-slate-100" : "bg-indigo-100 text-indigo-700"
              )}
            >
              {entry.intent?.tool ?? "pending"}
            </span>
          </div>
          <div className="mt-3">
            <IntentDebugDetails intent={entry.intent} />
          </div>
          {entry.debugTrace.length ? (
            <div className="mt-3">
              <DebugTraceList traces={entry.debugTrace} />
            </div>
          ) : null}
          {entry.contextHints ? (
            <div
              className={cn(
                "mt-3 rounded-md p-2",
                darkMode ? "bg-slate-900/40" : "bg-slate-950/5"
              )}
            >
              <p className={cn("text-xs font-medium", darkMode ? "text-slate-200" : "text-indigo-700")}>
                contextHints
              </p>
              <pre
                className={cn(
                  "mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px]",
                  darkMode ? "text-slate-200" : "text-slate-700"
                )}
              >
                {JSON.stringify(entry.contextHints, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};

const IntentDebugDetails = ({ intent }: { intent?: MindIntent }) => {
  if (!intent) {
    return (
      <p className="text-xs text-indigo-700/70">
        Waiting for planner output. Once an intent is produced, its extracted
        fields will appear here.
      </p>
    );
  }
  switch (intent.tool) {
    case "add_expense":
      return <ExpenseIntentDebug input={intent.input} />;
    case "add_budget_entry":
      return <BudgetIntentDebug input={intent.input} />;
    case "add_flow_task":
      return <FlowIntentDebug input={intent.input} />;
    case "summarize_state":
    default:
      return (
        <p className="text-xs text-indigo-700/80">
          Summary request · focus:{" "}
          {(intent.input as { focus?: string })?.focus ?? "overview"}
        </p>
      );
  }
};

const DebugTraceList = ({ traces }: { traces: MindDebugTrace[] }) => (
  <div className="space-y-2">
    {traces.map((trace, index) => (
      <div
        key={`${trace.phase}-${index}`}
        className="rounded-md border border-indigo-100 bg-indigo-50/80 p-2"
      >
        <p className="text-xs font-semibold text-indigo-800">
          {trace.description}
        </p>
        <TraceDataView trace={trace} />
      </div>
    ))}
  </div>
);

const TraceDataView = ({ trace }: { trace: MindDebugTrace }) => {
  if (!trace.data) {
    return (
      <p className="text-[11px] text-indigo-700/80">
        No structured data captured for this step.
      </p>
    );
  }
  if (trace.phase === "group_resolution") {
    return <GroupResolutionTrace data={trace.data} />;
  }
  return (
    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px] text-indigo-900">
      {JSON.stringify(trace.data, null, 2)}
    </pre>
  );
};

const ExpenseIntentDebug = ({
  input,
}: {
  input: Extract<MindIntent, { tool: "add_expense" }>["input"];
}) => {
  const steps = [
    {
      label: "Amount detected",
      value: formatMinorAmount(input.amountMinor, input.currency),
    },
    {
      label: "Group matched",
      value: input.groupName ?? "Not recognized",
    },
    {
      label: "Description / category",
      value: input.description ?? "Not inferred",
    },
    {
      label: "Occurred at",
      value: input.occurredAt ?? "Defaults to now",
    },
  ];
  return <DebugStepList steps={steps} />;
};

const BudgetIntentDebug = ({
  input,
}: {
  input: Extract<MindIntent, { tool: "add_budget_entry" }>["input"];
}) => {
  const steps = [
    {
      label: "Amount detected",
      value: formatMinorAmount(input.amountMinor, undefined),
    },
    {
      label: "Budget target",
      value: input.budgetId ?? input.requestedBudgetName ?? "Not recognized",
    },
    {
      label: "Merchant",
      value: input.merchant ?? "Not supplied",
    },
    {
      label: "Note",
      value: input.note ?? "None",
    },
  ];
  return <DebugStepList steps={steps} />;
};

const FlowIntentDebug = ({
  input,
}: {
  input: Extract<MindIntent, { tool: "add_flow_task" }>["input"];
}) => {
  const steps = [
    {
      label: "Title",
      value: input.title ?? "Not inferred",
    },
    {
      label: "Duration",
      value: input.durationMinutes
        ? `${input.durationMinutes} minutes`
        : "Default 30 minutes",
    },
    {
      label: "Scheduled for",
      value: input.scheduledFor ?? "today",
    },
    {
      label: "Category",
      value: input.category ?? "auto",
    },
  ];
  return <DebugStepList steps={steps} />;
};

const DebugStepList = ({ steps }: { steps: { label: string; value: string }[] }) => (
  <dl className="grid gap-1 text-xs text-indigo-900">
    {steps.map((step) => (
      <div key={step.label} className="flex items-center justify-between gap-4 rounded-md bg-indigo-100/60 px-2 py-1">
        <dt className="font-medium text-indigo-600">{step.label}</dt>
        <dd className="text-right text-indigo-900">{step.value}</dd>
      </div>
    ))}
  </dl>
);

const formatMinorAmount = (amountMinor?: number, currency?: string | null) => {
  if (typeof amountMinor !== "number") {
    return "Not detected";
  }
  const code = (currency ?? "USD").toUpperCase();
  return `${(amountMinor / 100).toFixed(2)} ${code}`;
};

const GroupResolutionTrace = ({ data }: { data: Record<string, unknown> }) => {
  const regexCandidates = Array.isArray(data.regexCandidates)
    ? (data.regexCandidates as string[])
    : [];
  const comparisons = Array.isArray(data.comparisons)
    ? (data.comparisons as Array<Record<string, unknown>>)
    : [];
  return (
    <div className="mt-2 space-y-2 rounded-md bg-white/80 p-2">
      <p className="text-[11px] text-indigo-900">
        utterance: <span className="font-semibold">{data.utterance as string}</span>
      </p>
      <p className="text-[11px] text-indigo-900">
        normalized:{" "}
        <span className="font-semibold">
          {data.normalizedUtterance as string}
        </span>
      </p>
      {regexCandidates.length ? (
        <div>
          <p className="text-[11px] font-semibold text-indigo-700">
            regex candidates
          </p>
          <ul className="list-disc pl-4 text-[11px] text-indigo-900">
            {regexCandidates.map((candidate) => (
              <li key={candidate}>{candidate}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <dl className="grid gap-1 text-[11px] text-indigo-900">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-indigo-700">trimmed</dt>
          <dd>{(data.trimmedCandidate as string) ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-indigo-700">normalized candidate</dt>
          <dd>{(data.normalizedCandidate as string) ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-indigo-700">match type</dt>
          <dd>{(data.matchType as string) ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-indigo-700">matched group</dt>
          <dd>{(data.matchedGroupName as string) ?? "None"}</dd>
        </div>
      </dl>
      {comparisons.length ? (
        <div>
          <p className="text-[11px] font-semibold text-indigo-700">
            fuzzy comparisons
          </p>
          <div className="max-h-32 overflow-auto rounded-md border border-indigo-100">
            <table className="w-full text-[11px]">
              <thead className="bg-indigo-100 text-left text-indigo-700">
                <tr>
                  <th className="px-2 py-1">Group</th>
                  <th className="px-2 py-1">Normalized</th>
                  <th className="px-2 py-1 text-right">Distance</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((comparison, index) => (
                  <tr key={`${comparison.groupId ?? index}`}>
                    <td className="px-2 py-1">
                      {(comparison.groupName as string) ?? "—"}
                    </td>
                    <td className="px-2 py-1">
                      {(comparison.normalized as string) ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {typeof comparison.distance === "number"
                        ? comparison.distance
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
};
