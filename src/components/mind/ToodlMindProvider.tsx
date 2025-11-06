"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  MindRequest,
  MindResponse,
  MindUserIdentity,
} from "@/lib/mind/types";

type AskArgs = {
  utterance: string;
  contextHints?: MindRequest["contextHints"];
  user?: MindUserIdentity;
};

type MindConversationTurn = {
  id: string;
  request: MindRequest;
  response?: MindResponse;
  error?: string;
  createdAt: number;
};

type ToodlMindContextValue = {
  identity: MindUserIdentity | null;
  setIdentity: (identity: MindUserIdentity | null) => void;
  ask: (args: AskArgs) => Promise<MindResponse>;
  pending: boolean;
  error: string | null;
  lastResponse: MindResponse | null;
  history: MindConversationTurn[];
  reset: () => void;
};

const ToodlMindContext = createContext<ToodlMindContextValue | undefined>(
  undefined
);

const ensureIdentity = (
  identity: MindUserIdentity | null,
  override?: MindUserIdentity
): MindUserIdentity => {
  const candidate = override ?? identity;
  if (!candidate || (!candidate.userId && !candidate.email)) {
    throw new Error(
      "Toodl Mind requires a user identity (userId or email) before making requests."
    );
  }
  return candidate;
};

const buildRequest = (
  identity: MindUserIdentity,
  args: AskArgs
): MindRequest => ({
  user: identity,
  utterance: args.utterance,
  contextHints: args.contextHints,
});

const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const mapError = async (response: Response) => {
  try {
    const data = await response.json();
    return data?.error ?? response.statusText;
  } catch {
    return response.statusText || "Unable to reach Toodl Mind.";
  }
};

export const useToodlMind = () => {
  const ctx = useContext(ToodlMindContext);
  if (!ctx) {
    throw new Error("useToodlMind must be used within a ToodlMindProvider");
  }
  return ctx;
};

type ProviderProps = {
  children: React.ReactNode;
  initialIdentity?: MindUserIdentity | null;
};

export default function ToodlMindProvider({
  children,
  initialIdentity = null,
}: ProviderProps) {
  const [identity, setIdentity] = useState<MindUserIdentity | null>(
    initialIdentity
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MindConversationTurn[]>([]);
  const [lastResponse, setLastResponse] = useState<MindResponse | null>(null);

  const ask = useCallback(
    async ({ user, ...rest }: AskArgs) => {
      const resolvedIdentity = ensureIdentity(identity, user);
      const requestPayload = buildRequest(resolvedIdentity, {
        ...rest,
        user: resolvedIdentity,
      });

      const turnId = randomId();
      const createdAt = Date.now();

      setPending(true);
      setError(null);
      setHistory((prev) => [
        ...prev,
        {
          id: turnId,
          request: requestPayload,
          createdAt,
        },
      ]);

      try {
        const response = await fetch("/api/mind/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        });

        if (!response.ok) {
          const message = await mapError(response);
          setError(message);
          setHistory((prev) =>
            prev.map((entry) =>
              entry.id === turnId
                ? { ...entry, error: message }
                : entry
            )
          );
          throw new Error(message);
        }

        const data = (await response.json()) as MindResponse;
        setLastResponse(data);
        setHistory((prev) =>
          prev.map((entry) =>
            entry.id === turnId
              ? {
                  ...entry,
                  response: data,
                }
              : entry
          )
        );

        return data;
      } finally {
        setPending(false);
      }
    },
    [identity]
  );

  const reset = useCallback(() => {
    setHistory([]);
    setLastResponse(null);
    setError(null);
  }, []);

  const value = useMemo<ToodlMindContextValue>(
    () => ({
      identity,
      setIdentity,
      ask,
      pending,
      error,
      lastResponse,
      history,
      reset,
    }),
    [ask, error, history, identity, lastResponse, pending, reset]
  );

  return (
    <ToodlMindContext.Provider value={value}>
      {children}
    </ToodlMindContext.Provider>
  );
}
