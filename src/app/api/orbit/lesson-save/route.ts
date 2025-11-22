import { NextRequest, NextResponse } from "next/server";

import { saveOrbitLesson } from "@/lib/orbitSummaryService";
import type { OrbitLearningLesson } from "@/types/orbit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body?.userId as string | undefined;
    const topic = body?.topic as string | undefined;
    const lesson = body?.lesson as OrbitLearningLesson | undefined;

    if (!userId || !lesson || !topic) {
      return NextResponse.json({ error: "userId, topic, and lesson are required" }, { status: 400 });
    }

    const saved = await saveOrbitLesson(userId, lesson, topic);
    return NextResponse.json({ lesson: saved });
  } catch (error) {
    console.error("Failed to save Orbit lesson", error);
    const message = error instanceof Error ? error.message : "Failed to save Orbit lesson";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
