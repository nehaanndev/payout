import { NextRequest, NextResponse } from "next/server";

import { ToodlMindOrchestrator } from "@/lib/mind/orchestrator";
import { MindRequest } from "@/lib/mind/types";

const orchestrator = new ToodlMindOrchestrator();

export async function POST(request: NextRequest) {
  let body: MindRequest;
  try {
    body = (await request.json()) as MindRequest;
  } catch {
    return NextResponse.json(
      {
        status: "failed",
        error: "Unable to parse request body as JSON.",
      },
      { status: 400 }
    );
  }

  try {
    const response = await orchestrator.handle(body);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[mind] orchestrator failure", error);
    return NextResponse.json(
      {
        status: "failed",
        error:
          error instanceof Error ? error.message : "Unknown Toodl Mind error.",
      },
      { status: 500 }
    );
  }
}
