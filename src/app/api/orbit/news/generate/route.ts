import { NextRequest, NextResponse } from "next/server";
import { generateDailyNews, generateNewsFeed } from "@/lib/newsService";

export async function POST(request: NextRequest) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        // Agentic News Logic
        console.log(`[API] Generating news feed for user: ${userId}`);
        const cards = await generateNewsFeed(userId);

        return NextResponse.json({ news: cards });
    } catch (error) {
        console.error("Error generating news in API:", error);
        return NextResponse.json(
            { error: "Failed to generate news" },
            { status: 500 }
        );
    }
}
