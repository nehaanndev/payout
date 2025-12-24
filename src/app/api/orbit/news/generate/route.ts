import { NextRequest, NextResponse } from "next/server";
import { generateDailyNews } from "@/lib/newsService";

export async function POST(request: NextRequest) {
    try {
        const { topic, userId } = await request.json();

        if (!topic || !userId) {
            return NextResponse.json(
                { error: "Topic and userId are required" },
                { status: 400 }
            );
        }

        const newsCard = await generateDailyNews(topic, userId);

        return NextResponse.json({ news: newsCard });
    } catch (error) {
        console.error("Error generating news in API:", error);
        return NextResponse.json(
            { error: "Failed to generate news" },
            { status: 500 }
        );
    }
}
