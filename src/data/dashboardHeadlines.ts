/**
 * Dashboard Headlines
 * 
 * Provides variety in the dashboard greeting to prevent headline fatigue.
 * Uses a hybrid approach:
 * - Special dates (holidays) get fixed headlines
 * - Regular days rotate through a pool of motivational phrases
 */

/** Special date headlines - key is "MM-DD" format */
export const SPECIAL_HEADLINES: Record<string, string> = {
    // New Year
    "01-01": "happy new year 🎉",

    // Valentine's Day
    "02-14": "spread some love today 💕",

    // St. Patrick's Day
    "03-17": "feeling lucky? ☘️",

    // Earth Day
    "04-22": "one planet, one chance 🌍",

    // Mother's Day (approx - 2nd Sunday in May, using May 12)
    "05-12": "celebrate the ones who raised you 💐",

    // Father's Day (approx - 3rd Sunday in June, using June 16)
    "06-16": "cheers to the dads out there 👔",

    // Independence Day (US)
    "07-04": "enjoy the fireworks 🎆",

    // Halloween
    "10-31": "spooky season vibes 🎃",

    // Thanksgiving (approx - 4th Thursday in Nov, using Nov 28)
    "11-28": "grateful for you being here 🦃",

    // Christmas Eve
    "12-24": "the magic starts tonight ✨",

    // Christmas
    "12-25": "merry Christmas 🎄",

    // New Year's Eve
    "12-31": "one more day, make it count 🥂",
};

/** Regular motivational headlines (~100 phrases) */
export const REGULAR_HEADLINES: string[] = [
    // Encouragement & momentum
    "keep it flowing.",
    "one step at a time.",
    "make today count.",
    "you've got this.",
    "stay in the loop.",
    "small wins add up.",
    "progress over perfection.",
    "keep moving forward.",
    "trust the process.",
    "every day is a fresh start.",

    // Mindfulness & presence
    "be here now.",
    "take a breath.",
    "stay grounded today.",
    "pause when you need to.",
    "find your rhythm.",
    "embrace the moment.",
    "slow is smooth, smooth is fast.",
    "let it flow.",
    "stay present.",
    "feel the pace.",

    // Curiosity & growth
    "stay curious.",
    "learn something new today.",
    "growth takes time.",
    "ask the hard questions.",
    "explore a little.",
    "try something different.",
    "embrace the unknown.",
    "expand your horizons.",
    "keep an open mind.",
    "wonder more.",

    // Kindness & connection
    "be kind to yourself.",
    "spread a little joy.",
    "connect with someone.",
    "kindness is free.",
    "lift someone up today.",
    "listen more, talk less.",
    "a smile goes a long way.",
    "show up for others.",
    "gratitude changes everything.",
    "make someone's day.",

    // Focus & intentionality
    "set your intention.",
    "what matters most today?",
    "prioritize what counts.",
    "less but better.",
    "clear the clutter.",
    "focus on one thing.",
    "simplify your day.",
    "aim for clarity.",
    "mind over noise.",
    "do the next right thing.",

    // Energy & positivity
    "bring the energy.",
    "good vibes only.",
    "shine a little brighter.",
    "radiate positivity.",
    "find the silver lining.",
    "choose optimism.",
    "your energy matters.",
    "light up the room.",
    "positive ripples start here.",
    "own your vibe.",

    // Rest & balance
    "rest when you need it.",
    "balance is key.",
    "don't forget to recharge.",
    "you deserve a break.",
    "take care of you.",
    "refill your cup.",
    "pace yourself.",
    "wellness first.",
    "breathe in, breathe out.",
    "recovery is part of growth.",

    // Action & courage
    "just start.",
    "take the leap.",
    "dare to try.",
    "courage over comfort.",
    "action beats intention.",
    "don't wait, create.",
    "go for it.",
    "bet on yourself.",
    "make it happen.",
    "the time is now.",

    // Creativity & play
    "create something today.",
    "play a little more.",
    "embrace your weird.",
    "color outside the lines.",
    "imagination is power.",
    "let ideas flow.",
    "dream bigger.",
    "think different.",
    "innovate, don't imitate.",
    "have some fun with it.",

    // Resilience & grit
    "keep showing up.",
    "tough days build tough people.",
    "you're stronger than you think.",
    "bounce back.",
    "grit gets it done.",
    "setbacks are setups.",
    "persist through the noise.",
    "this too shall pass.",
    "stay in the fight.",
    "resilience is your superpower.",
];

/**
 * Get the headline for a given date.
 * - Checks for special dates first (holidays)
 * - Falls back to rotating through regular headlines (deterministic per day-of-year)
 */
export function getHeadline(date: Date = new Date()): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateKey = `${month}-${day}`;

    // Check for special date first
    const special = SPECIAL_HEADLINES[dateKey];
    if (special) {
        return special;
    }

    // Fall back to regular headline based on day of year
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    const index = dayOfYear % REGULAR_HEADLINES.length;
    return REGULAR_HEADLINES[index];
}
