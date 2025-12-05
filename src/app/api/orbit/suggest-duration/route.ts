import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { topic } = await request.json();

        if (!topic) {
            return NextResponse.json({ error: "Topic is required" }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            // Fallback if no API key
            return NextResponse.json({ days: 14 });
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert curriculum designer. Determine the optimal number of days (between 5 and 60) to learn the topic "${topic}" effectively. Return a JSON object with a single key "days" containing the integer number of days.`,
                    },
                ],
                response_format: { type: "json_object" },
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return NextResponse.json({ days: 14 });
        }

        const parsed = JSON.parse(content);
        const days = typeof parsed.days === 'number' ? parsed.days : 14;

        // Clamp between 5 and 60 just in case
        const clampedDays = Math.max(5, Math.min(60, days));

        return NextResponse.json({ days: clampedDays });

    } catch (error) {
        console.error("Failed to suggest duration", error);
        return NextResponse.json({ days: 14 }, { status: 500 });
    }
}
