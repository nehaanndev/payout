"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToodlTheme = "morning" | "night";

const STORAGE_KEY = "toodl-theme";

const isTheme = (value: unknown): value is ToodlTheme =>
  value === "morning" || value === "night";

const getPreferredTheme = (fallback: ToodlTheme): ToodlTheme => {
  if (typeof window === "undefined") {
    return fallback;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isTheme(stored)) {
    return stored;
  }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "night" : fallback;
};

const syncDocumentTheme = (theme: ToodlTheme, broadcast: boolean) => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window.document.documentElement;
  const isNight = theme === "night";
  root.classList.toggle("dashboard-night", isNight);
  root.classList.toggle("dark", isNight);
  window.localStorage.setItem(STORAGE_KEY, theme);
  if (broadcast) {
    window.dispatchEvent(
      new CustomEvent("toodl-theme-change", { detail: theme })
    );
  }
};

export const useToodlTheme = (defaultTheme: ToodlTheme = "morning") => {
  const initial = useRef(defaultTheme);
  const [theme, setTheme] = useState<ToodlTheme>(defaultTheme);

  const applyTheme = useCallback((next: ToodlTheme, broadcast = true) => {
    setTheme(next);
    syncDocumentTheme(next, broadcast);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const preferred = getPreferredTheme(initial.current);
    applyTheme(preferred, false);
  }, [applyTheme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = (event: Event) => {
      const next = (event as CustomEvent<ToodlTheme>).detail;
      if (isTheme(next)) {
        applyTheme(next, false);
      }
    };
    window.addEventListener("toodl-theme-change", handler as EventListener);
    return () => window.removeEventListener("toodl-theme-change", handler as EventListener);
  }, [applyTheme]);

  return {
    theme,
    setTheme: applyTheme,
    isNight: theme === "night",
  } as const;
};
