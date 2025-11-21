import { NextRequest, NextResponse } from "next/server";

import { createSharedLink } from "@/lib/shareService";
import type { OrbitInsightCard } from "@/types/orbit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body?.userId;
    const insight: OrbitInsightCard | undefined = body?.insight;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (!insight || typeof insight !== "object") {
      return NextResponse.json({ error: "insight payload is required" }, { status: 400 });
    }

    const title = insight.title?.trim();
    if (!title) {
      return NextResponse.json({ error: "insight title is required" }, { status: 400 });
    }

    const descriptionParts = [
      insight.summary?.trim() ?? "",
      "",
      ...(Array.isArray(insight.paragraphs) ? insight.paragraphs : []),
    ]
      .filter((part) => typeof part === "string" && part.length > 0)
      .join("\n\n");

    const tags = [
      "dashboard-insight",
      insight.type === "concept" ? "concept" : "news",
      insight.topic?.toLowerCase?.() ?? undefined,
    ].filter(Boolean) as string[];

    const shareId = await createSharedLink(userId, {
      title,
      description: descriptionParts,
      url: insight.referenceUrl ?? null,
      sourceApp: "dashboard",
      platform: "web",
      contentType: insight.referenceUrl ? "article" : "note",
      tags,
    });

    return NextResponse.json({ shareId });
  } catch (error) {
    console.error("Failed to save insight to Orbit", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
