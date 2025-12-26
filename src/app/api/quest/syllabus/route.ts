import { NextRequest, NextResponse } from "next/server";
import {
    generateSyllabus,
    generateResourceSuggestions,
    distributeMilestones,
} from "@/lib/questLLMService";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            title,
            type,
            answers,
            startDate,
            endDate,
            availableDays,
            dailyMinutes,
            feedback,
            generateSuggestions,
        } = body;

        if (!title || !endDate) {
            return NextResponse.json(
                { error: "Missing required fields: title, endDate" },
                { status: 400 }
            );
        }

        const today = startDate || new Date().toISOString().split("T")[0];
        const days = availableDays || [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ];
        const minutes = dailyMinutes || 60;

        // For "unknown" type with generateSuggestions flag, generate book recommendations
        if (type === "unknown" && generateSuggestions) {
            const suggestions = await generateResourceSuggestions(title, feedback);
            return NextResponse.json({ syllabus: suggestions });
        }

        // Otherwise, generate full syllabus
        const syllabus = await generateSyllabus(
            title,
            answers || {},
            today,
            endDate,
            days,
            minutes,
            feedback
        );

        // Distribute across available dates
        const distributed = distributeMilestones(
            syllabus,
            today,
            endDate,
            days,
            minutes
        );

        return NextResponse.json({ syllabus: distributed });
    } catch (error) {
        console.error("Failed to generate syllabus:", error);
        return NextResponse.json(
            { error: "Failed to generate syllabus" },
            { status: 500 }
        );
    }
}
