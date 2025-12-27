/**
 * Centralized date utilities for consistent day/time handling across the app.
 * These utilities are used to ensure consistent day advancement logic for
 * learning tracks and time-of-day detection for morning/night themes.
 */

/**
 * Get a date string in YYYY-MM-DD format using local timezone.
 * This is the canonical format for day-based comparisons.
 */
export function getLocalDateKey(date: Date = new Date()): string {
    return date.toLocaleDateString("en-CA"); // YYYY-MM-DD format
}

/**
 * Check if two date keys represent the same calendar day.
 */
export function isSameDay(dateKey1: string | undefined, dateKey2: string | undefined): boolean {
    if (!dateKey1 || !dateKey2) return false;
    return dateKey1 === dateKey2;
}

/**
 * Check if we are in "morning" hours (before 5 PM / 17:00).
 * Used for dashboard theming and morning-only features.
 */
export function isMorningHours(hour: number = new Date().getHours()): boolean {
    return hour < 17;
}

/**
 * Parse a YYYY-MM-DD date string as a local date (not UTC).
 * This avoids timezone issues where `new Date("2024-01-01")` is interpreted as UTC midnight.
 */
export function parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
}
