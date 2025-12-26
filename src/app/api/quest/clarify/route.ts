import { NextRequest, NextResponse } from "next/server";
import { generateClarifyingQuestions } from "@/lib/questLLMService";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, type, endDate } = body;

        if (!title || !type) {
            return NextResponse.json(
                { error: "Missing required fields: title, type" },
                { status: 400 }
            );
        }

        const questions = await generateClarifyingQuestions(
            title,
            type as "known" | "unknown",
            endDate || new Date().toISOString().split("T")[0]
        );

        return NextResponse.json({ questions });
    } catch (error) {
        console.error("Failed to generate clarifying questions:", error);
        return NextResponse.json(
            { error: "Failed to generate questions" },
            { status: 500 }
        );
    }
}
