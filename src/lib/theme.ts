/**
 * Centralized theme utilities for consistent styling across the app
 * Based on the dashboard night mode styles
 * 
 * @example
 * ```tsx
 * import { useToodlTheme } from "@/hooks/useToodlTheme";
 * import { theme } from "@/lib/theme";
 * 
 * function MyComponent() {
 *   const { isNight } = useToodlTheme();
 *   
 *   return (
 *     <div className={theme.card(isNight)}>
 *       <h1 className={theme.text.primary(isNight)}>Title</h1>
 *       <p className={theme.text.secondary(isNight)}>Description</p>
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example Using theme classes helper
 * ```tsx
 * import { themeClasses } from "@/lib/theme";
 * 
 * <div className={themeClasses.page(isNight)}>
 *   <header className={themeClasses.topBar(isNight)}>...</header>
 * </div>
 * ```
 */

import { cn } from "@/lib/utils";

/**
 * Theme-aware class utilities
 * These return the appropriate classes based on whether it's night or morning theme
 */
export const theme = {
  /**
   * Background colors
   */
  bg: {
    page: (isNight: boolean) =>
      isNight ? "bg-slate-950" : "bg-slate-50",
    card: (isNight: boolean) =>
      isNight ? "bg-slate-900/70" : "bg-white",
    cardHover: (isNight: boolean) =>
      isNight ? "hover:bg-slate-900/80" : "hover:bg-slate-50",
    surface: (isNight: boolean) =>
      isNight ? "bg-slate-900/70" : "bg-white/95",
    surfaceSubtle: (isNight: boolean) =>
      isNight ? "bg-slate-900/50" : "bg-slate-50",
    overlay: (isNight: boolean) =>
      isNight ? "bg-slate-900/95" : "bg-white/95",
    backdrop: (isNight: boolean) =>
      isNight ? "bg-slate-950" : "bg-white",
  },

  /**
   * Text colors
   */
  text: {
    primary: (isNight: boolean) =>
      isNight ? "text-white" : "text-slate-900",
    secondary: (isNight: boolean) =>
      isNight ? "text-slate-200" : "text-slate-700",
    tertiary: (isNight: boolean) =>
      isNight ? "text-slate-300" : "text-slate-600",
    muted: (isNight: boolean) =>
      isNight ? "text-slate-400" : "text-slate-500",
    subtle: (isNight: boolean) =>
      isNight ? "text-slate-500" : "text-slate-400",
    inverse: (isNight: boolean) =>
      isNight ? "text-slate-900" : "text-white",
  },

  /**
   * Border colors
   */
  border: {
    default: (isNight: boolean) =>
      isNight ? "border-white/15" : "border-slate-200",
    subtle: (isNight: boolean) =>
      isNight ? "border-white/10" : "border-slate-100",
    strong: (isNight: boolean) =>
      isNight ? "border-white/25" : "border-slate-300",
    hover: (isNight: boolean) =>
      isNight ? "hover:border-white/25" : "hover:border-slate-300",
  },

  /**
   * Common component styles
   */
  card: (isNight: boolean, className?: string) =>
    cn(
      "rounded-2xl border transition-colors",
      theme.border.default(isNight),
      theme.bg.card(isNight),
      theme.text.primary(isNight),
      className
    ),

  button: {
    primary: (isNight: boolean, className?: string) =>
      cn(
        "rounded-xl border font-semibold transition-colors",
        isNight
          ? "border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/15"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900",
        className
      ),
    secondary: (isNight: boolean, className?: string) =>
      cn(
        "rounded-xl border font-semibold transition-colors",
        isNight
          ? "border-white/15 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
          : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50",
        className
      ),
    ghost: (isNight: boolean, className?: string) =>
      cn(
        "rounded-xl transition-colors",
        isNight
          ? "text-white hover:bg-white/10"
          : "text-slate-700 hover:bg-slate-100",
        className
      ),
  },

  input: (isNight: boolean, className?: string) =>
    cn(
      "rounded-xl border bg-transparent px-3 py-2 transition-colors",
      theme.border.default(isNight),
      isNight ? "text-white placeholder:text-slate-400" : "text-slate-900 placeholder:text-slate-500",
      className
    ),

  badge: (isNight: boolean, className?: string) =>
    cn(
      "rounded-full px-2 py-0.5 text-xs font-medium",
      isNight
        ? "bg-white/10 text-slate-300"
        : "bg-slate-100 text-slate-500",
      className
    ),

  /**
   * Container/panel styles
   */
  container: (isNight: boolean, className?: string) =>
    cn(
      "rounded-3xl border backdrop-blur transition-colors",
      theme.border.default(isNight),
      theme.bg.surface(isNight),
      theme.text.primary(isNight),
      className
    ),

  panel: (isNight: boolean, className?: string) =>
    cn(
      "rounded-2xl border transition-colors",
      theme.border.subtle(isNight),
      theme.bg.card(isNight),
      className
    ),

  /**
   * Gradient backgrounds
   */
  gradient: {
    page: (isNight: boolean) =>
      isNight
        ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
        : "bg-gradient-to-br from-amber-50 via-white to-emerald-50",
    hero: (isNight: boolean) =>
      isNight
        ? "bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900"
        : "bg-gradient-to-br from-amber-100/40 via-white to-emerald-100/30",
  },

  /**
   * Shadow styles
   */
  shadow: (isNight: boolean) =>
    isNight
      ? "shadow-2xl shadow-slate-900/50"
      : "shadow-2xl shadow-slate-900/15",
};

/**
 * Helper function to get theme-aware classes
 * Usage: themeClass(isNight, "text-primary", "bg-card")
 */
export function themeClass(
  isNight: boolean,
  ...classes: Array<string | ((isNight: boolean) => string)>
): string {
  const resolvedClasses = classes.map((cls) => 
    typeof cls === "function" ? cls(isNight) : cls
  );
  return cn(...resolvedClasses);
}

/**
 * Common theme-aware class combinations
 */
export const themeClasses = {
  /**
   * Page wrapper
   */
  page: (isNight: boolean) =>
    cn(
      theme.gradient.page(isNight),
      theme.text.primary(isNight),
      "min-h-screen"
    ),

  /**
   * Top bar / header
   */
  topBar: (isNight: boolean) =>
    cn(
      "rounded-3xl border backdrop-blur px-4 py-6 md:px-6",
      isNight
        ? "border-slate-800/70 bg-slate-950/70 text-white shadow-[0_25px_60px_-35px_rgba(15,23,42,0.85)]"
        : "border-slate-200 bg-white/80 text-slate-900 shadow-[0_15px_45px_-25px_rgba(15,23,42,0.45)]"
    ),

  /**
   * Card with hover
   */
  cardInteractive: (isNight: boolean) =>
    cn(
      theme.card(isNight),
      theme.border.hover(isNight),
      theme.bg.cardHover(isNight),
      "cursor-pointer"
    ),

  /**
   * Section divider
   */
  divider: (isNight: boolean) =>
    cn(
      "border-t",
      theme.border.subtle(isNight)
    ),
};

