import { NextRequest, NextResponse } from "next/server";

import { recordInsightPreference } from "@/lib/orbitSummaryService";
import type { InsightVoteDirection } from "@/types/orbit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body?.userId;
    const topic = body?.topic;
    const vote: InsightVoteDirection = body?.vote;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }
    if (vote !== "more" && vote !== "less") {
      return NextResponse.json({ error: "vote must be \"more\" or \"less\"" }, { status: 400 });
    }

    await recordInsightPreference(userId, topic, vote);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to record insight feedback", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
