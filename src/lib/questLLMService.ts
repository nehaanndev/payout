import { QuestMilestone, ClarifyingQuestion } from "@/types/quest";
import { generateId } from "@/lib/id";
import { getLocalDateKey, parseLocalDate } from "@/lib/dateUtils";

// Generate clarifying questions based on quest type and title
export async function generateClarifyingQuestions(
    title: string,
    type: "known" | "unknown",
    endDate: string
): Promise<ClarifyingQuestion[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        // Fallback questions if no API key
        return getDefaultQuestions(type);
    }

    const systemPrompt =
        type === "known"
            ? `You are helping a user plan a goal where they know exactly what to do (e.g., watch a playlist, read a book).
Generate 3 - 5 clarifying questions to understand the scope.Return JSON array with:
- id: unique string
    - question: the question text
        - inputType: "text" | "number" | "select" | "days"
            - options: array of options if inputType is "select"
                - required: boolean

Ask about: total units(videos / pages / chapters), unit duration, daily time commitment, available days.`
            : `You are helping a user plan a goal where they need guidance on HOW to achieve it(e.g., learn piano, understand ML).
    Generate 3 - 5 clarifying questions to understand their level and preferences.Return JSON array with:
    - id: unique string
        - question: the question text
            - inputType: "text" | "number" | "select" | "days"
                - options: array of options if inputType is "select"
                    - required: boolean

Ask about: current skill level, learning style preference, daily time commitment, specific focus areas.`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey} `,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemPrompt },
                    {
                        role: "user",
                        content: `Goal: "${title}".Target completion: ${endDate}. Generate clarifying questions.`,
                    },
                ],
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            console.error("OpenAI API error:", response.status);
            return getDefaultQuestions(type);
        }

        const result = await response.json();
        const content = result?.choices?.[0]?.message?.content;
        if (!content) return getDefaultQuestions(type);

        const parsed = JSON.parse(content);
        return parsed.questions || parsed || getDefaultQuestions(type);
    } catch (error) {
        console.error("Failed to generate questions:", error);
        return getDefaultQuestions(type);
    }
}

// Generate book/resource suggestions for unknown-type quests
export async function generateResourceSuggestions(
    title: string,
    feedback?: string
): Promise<QuestMilestone[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return buildFallbackBookSuggestions(title);
    }

    const systemPrompt = `You are an expert book and learning resource recommender.

Based on the user's goal, suggest 4-6 REAL, well-known books or resources. Focus on quality over quantity.

Return JSON with "suggestions" array.Each item:
- title: string(exact book title + author, e.g., "Atomic Habits by James Clear")
    - description: string(1 - 2 sentence summary of why this book helps)
        - estimatedPages: number(approximate page count)
            - durationMinutes: number(estimated reading time, ~2 min per page)
                - resourceType: "book" | "video" | "article" | "course"

IMPORTANT: Only suggest real, published books or resources.No made - up titles.`;

    const userPrompt = `Goal: "${title}"
${feedback ? `User wants: ${feedback}` : ""}

Suggest 5 books or resources to help achieve this goal.`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey} `,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.5,
            }),
        });

        if (!response.ok) {
            console.error("OpenAI suggestions API error:", response.status);
            return buildFallbackBookSuggestions(title);
        }

        const result = await response.json();
        const content = result?.choices?.[0]?.message?.content;
        if (!content) {
            return buildFallbackBookSuggestions(title);
        }

        const parsed = JSON.parse(content);
        const suggestions = parsed.suggestions || [];

        return suggestions.map(
            (item: {
                title?: string;
                description?: string;
                estimatedPages?: number;
                durationMinutes?: number;
                resourceType?: string;
            }, index: number): QuestMilestone => ({
                id: generateId(),
                day: index + 1,
                title: item.title ?? `Resource ${index + 1} `,
                description: item.description ?? "",
                durationMinutes: item.durationMinutes ?? (item.estimatedPages ? item.estimatedPages * 2 : 360),
                resourceType: (item.resourceType as QuestMilestone["resourceType"]) ?? "article",
                status: "pending",
            })
        );
    } catch (error) {
        console.error("Failed to generate suggestions:", error);
        return buildFallbackBookSuggestions(title);
    }
}

// Fallback book suggestions for common goals
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildFallbackBookSuggestions(_title: string): QuestMilestone[] {
    // Generic personal development books as fallback
    const fallbackBooks = [
        {
            title: "Atomic Habits by James Clear",
            description: "Build good habits and break bad ones with this #1 bestseller",
            durationMinutes: 480,
        },
        {
            title: "The 7 Habits of Highly Effective People by Stephen Covey",
            description: "Classic principles for personal effectiveness",
            durationMinutes: 560,
        },
        {
            title: "Deep Work by Cal Newport",
            description: "Rules for focused success in a distracted world",
            durationMinutes: 440,
        },
        {
            title: "Mindset by Carol Dweck",
            description: "The psychology of success through growth mindset",
            durationMinutes: 420,
        },
        {
            title: "The Power of Now by Eckhart Tolle",
            description: "A guide to spiritual enlightenment and presence",
            durationMinutes: 360,
        },
    ];

    return fallbackBooks.map((book, index) => ({
        id: generateId(),
        day: index + 1,
        title: book.title,
        description: book.description,
        durationMinutes: book.durationMinutes,
        resourceType: "article" as const,
        status: "pending" as const,
    }));
}

// Generate syllabus/curriculum for unknown-type quests
export async function generateSyllabus(
    title: string,
    answers: Record<string, string | number | string[]>,
    startDate: string,
    endDate: string,
    availableDays: string[],
    dailyMinutes: number,
    feedback?: string
): Promise<QuestMilestone[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return buildFallbackSyllabus(title, startDate, endDate, dailyMinutes);
    }

    const dayCount = getDaysBetween(startDate, endDate, availableDays);

    const systemPrompt = `You are an expert curriculum designer.Create a practical learning syllabus.

    IMPORTANT: Use REAL YouTube videos and articles where possible.For each milestone, suggest concrete resources.

Return JSON with "syllabus" array.Each item:
- day: number(1 to ${dayCount})
    - title: string(specific lesson title)
        - description: string(what they'll learn)
            - durationMinutes: number(realistic duration)
        - resourceUrl: string(YouTube URL or article link if known, or "search:[query]" for user to find)
    - resourceType: "video" | "article" | "practice"

Make the syllabus comprehensive but achievable within ${dailyMinutes} minutes per day.`;

    const userPrompt = `Create a syllabus for: "${title}"
User context: ${JSON.stringify(answers)}
Available: ${dayCount} days, ${dailyMinutes} min / day
Days: ${availableDays.join(", ")}
${feedback ? `User feedback: ${feedback}` : ""} `;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey} `,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.4,
            }),
        });

        if (!response.ok) {
            console.error("OpenAI syllabus API error:", response.status);
            return buildFallbackSyllabus(title, startDate, endDate, dailyMinutes);
        }

        const result = await response.json();
        const content = result?.choices?.[0]?.message?.content;
        if (!content) {
            return buildFallbackSyllabus(title, startDate, endDate, dailyMinutes);
        }

        const parsed = JSON.parse(content);
        const rawSyllabus = parsed.syllabus || [];

        return rawSyllabus.map(
            (item: {
                day?: number;
                title?: string;
                description?: string;
                durationMinutes?: number;
                resourceUrl?: string;
                resourceType?: string;
            }, index: number): QuestMilestone => ({
                id: generateId(),
                day: item.day ?? index + 1,
                title: item.title ?? `Lesson ${index + 1} `,
                description: item.description ?? "",
                durationMinutes: item.durationMinutes ?? dailyMinutes,
                resourceUrl: item.resourceUrl,
                resourceType: (item.resourceType as QuestMilestone["resourceType"]) ?? "other",
                status: "pending",
            })
        );
    } catch (error) {
        console.error("Failed to generate syllabus:", error);
        return buildFallbackSyllabus(title, startDate, endDate, dailyMinutes);
    }
}

// Distribute milestones across available days
export function distributeMilestones(
    milestones: QuestMilestone[],
    startDate: string,
    endDate: string,
    availableDays: string[],
    dailyMinutes: number
): QuestMilestone[] {
    const dates = getAvailableDates(startDate, endDate, availableDays);
    const distributed: QuestMilestone[] = [];

    let dateIndex = 0;
    let dayMinutesUsed = 0;

    for (const milestone of milestones) {
        if (dateIndex >= dates.length) {
            // No more dates, assign to last date
            distributed.push({
                ...milestone,
                assignedDate: dates[dates.length - 1],
            });
            continue;
        }

        // Check if this milestone fits in current day
        if (dayMinutesUsed + milestone.durationMinutes > dailyMinutes) {
            // Move to next day
            dateIndex++;
            dayMinutesUsed = 0;
            if (dateIndex >= dates.length) {
                dateIndex = dates.length - 1; // Stay on last day
            }
        }

        distributed.push({
            ...milestone,
            assignedDate: dates[dateIndex],
        });
        dayMinutesUsed += milestone.durationMinutes;
    }

    return distributed;
}

// Helper: Get default questions
function getDefaultQuestions(type: "known" | "unknown"): ClarifyingQuestion[] {
    if (type === "known") {
        return [
            {
                id: "units",
                question: "How many items total? (videos, pages, chapters, etc.)",
                inputType: "number",
                required: true,
            },
            {
                id: "unitLabel",
                question: "What are you counting?",
                inputType: "select",
                options: ["videos", "pages", "chapters", "lessons", "other"],
                required: true,
            },
            {
                id: "unitDuration",
                question: "Average time per item (in minutes)?",
                inputType: "number",
                required: true,
            },
            {
                id: "dailyTime",
                question: "How much time can you dedicate daily?",
                inputType: "select",
                options: ["30 minutes", "1 hour", "2 hours", "3+ hours"],
                required: true,
            },
            {
                id: "days",
                question: "Which days work for you?",
                inputType: "days",
                required: true,
            },
        ];
    }

    return [
        {
            id: "level",
            question: "What's your current level?",
            inputType: "select",
            options: ["Complete beginner", "Some experience", "Intermediate", "Advanced"],
            required: true,
        },
        {
            id: "focus",
            question: "Any specific areas you want to focus on?",
            inputType: "text",
            required: false,
        },
        {
            id: "dailyTime",
            question: "How much time can you dedicate daily?",
            inputType: "select",
            options: ["30 minutes", "1 hour", "2 hours", "3+ hours"],
            required: true,
        },
        {
            id: "days",
            question: "Which days work for you?",
            inputType: "days",
            required: true,
        },
    ];
}

// Helper: Build fallback syllabus
function buildFallbackSyllabus(
    title: string,
    startDate: string,
    endDate: string,
    dailyMinutes: number
): QuestMilestone[] {
    const days = getDaysBetween(startDate, endDate, [
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
    ]);

    return Array.from({ length: Math.min(days, 14) }, (_, i) => ({
        id: generateId(),
        day: i + 1,
        title: `${title}: Session ${i + 1} `,
        description: `Work on ${title} `,
        durationMinutes: dailyMinutes,
        status: "pending" as const,
    }));
}

// Helper: Get days between dates that match available days
function getDaysBetween(
    startDate: string,
    endDate: string,
    availableDays: string[]
): number {
    return getAvailableDates(startDate, endDate, availableDays).length;
}

// Helper: Get list of available dates
function getAvailableDates(
    startDate: string,
    endDate: string,
    availableDays: string[]
): string[] {
    const dayNames = [
        "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"
    ];
    const dates: string[] = [];
    // Use parseLocalDate to avoid UTC interpretation issues
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayName = dayNames[d.getDay()];
        if (availableDays.length === 0 || availableDays.includes(dayName)) {
            // Use getLocalDateKey for consistent YYYY-MM-DD formatting
            dates.push(getLocalDateKey(d));
        }
    }

    return dates;
}
