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
import { cn } from "@/lib/utils";
import { MindEditableMessageField } from "@/lib/mind/types";
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
        items.push({
          id: `${turn.id}-assistant`,
          role: "assistant",
          content: turn.response.message,
          responseStatus: turn.response.status,
          statusText: responseLabel(turn.response.status),
          editableMessage: turn.response.editableMessage,
          isLatest: turn.id === history[history.length - 1]?.id,
        });
      }

      return items;
    });
  }, [history]);

  const showConfirmControls =
    lastResponse?.status === "needs_confirmation" && !pending;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 via-indigo-500 to-violet-500 text-indigo-50 shadow-xl shadow-indigo-300/60 transition hover:from-indigo-500 hover:via-indigo-600 hover:to-violet-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2"
        aria-label="Open Toodl Mind"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full max-h-screen w-full flex-col gap-4 rounded-t-3xl bg-white p-0 shadow-[0_16px_48px_-12px_rgba(79,70,229,0.35)] sm:max-w-md"
        >
          <SheetHeader className="px-6 pt-6">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 via-indigo-500 to-violet-500 text-indigo-50">
                <Sparkles className="h-4 w-4" />
              </span>
              Toodl Mind
            </SheetTitle>
            <SheetDescription>
              Ask for help across expenses, budgets, flows, or links. Plan first,
              then confirm or dismiss.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6">
            <div className="flex flex-col space-y-4 pb-6">
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
              className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3"
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
