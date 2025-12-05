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



    // We need to match the new signature: saveOrbitLesson(userId, topic, lesson, quiz)
    // Note: The previous signature was (userId, lesson, topic).
    // The new signature is (userId, topic, sanitizedLesson, sanitizedQuiz).
    // We should probably sanitize here or let the service handle it?
    // The service expects sanitizedLesson as OrbitLesson (which includes id?), wait.
    // Let's check the type in service.
    // The service signature is: saveOrbitLesson(userId, topic, sanitizedLesson: OrbitLesson, sanitizedQuiz: unknown)
    // But OrbitLesson has 'id'. The input 'lesson' is OrbitLearningLesson.
    // There is a type mismatch.
    // The service implementation constructs the payload.
    // Let's look at the service again.
    // It takes `sanitizedLesson: OrbitLesson`.
    // But inside it does `const lessonPayload = { ...sanitizedLesson, quiz: sanitizedQuiz }`.
    // And `OrbitLesson` extends `OrbitLearningLesson` but adds `id`, `topic`, `createdAt`.
    // The previous implementation of `saveOrbitLesson` took `OrbitLearningLesson`.
    // I changed the signature in `orbitSummaryService.ts` but maybe I messed up the types?
    // Let's fix the call here first, but I suspect I need to fix the service type definition too.

    // Actually, looking at the previous `saveOrbitLesson` implementation (which I replaced),
    // it took `lesson: OrbitLearningLesson`.
    // My new implementation takes `sanitizedLesson: OrbitLesson`. This is wrong.
    // It should take `OrbitLearningLesson` and sanitize it internally, OR I should sanitize here.
    // But I moved the sanitization logic INTO `saveOrbitLesson` (or so I thought).
    // Wait, I replaced the WHOLE function.
    // Let's check `orbitSummaryService.ts` content again.

    // I will revert the signature change in `orbitSummaryService.ts` to be compatible, 
    // OR update this caller to match.
    // Updating this caller is better if the service is now "dumber" (just saves).
    // But the service name `saveOrbitLesson` implies it does the work.

    // Let's assume I need to pass `lesson` and `quiz` separately now.
    // But `lesson` here is `OrbitLearningLesson`.
    // The service expects `OrbitLesson`.
    // I should cast or construct it.

    // Actually, it's better to fix `orbitSummaryService.ts` to accept `OrbitLearningLesson` again
    // and do the sanitization/conversion inside, like it used to.
    // That way I don't break other callers (if any).
    // But I already changed it.

    // Let's update this file to match the current service signature for now.
    // I need to construct an object that satisfies `OrbitLesson` (minus ID maybe? No, `OrbitLesson` has ID).
    // This seems messy. I should probably revert the signature change in service.

    // BUT, I can't revert easily without re-writing the file.
    // Let's just fix this call site.

    // Wait, `OrbitLesson` has `id`. I don't have an ID yet.
    // The service returns the ID.
    // So the input type in service should probably be `Omit<OrbitLesson, "id" | "createdAt" ...>` or just `OrbitLearningLesson`.

    // Let's look at `orbitSummaryService.ts` again.
    // It says: `sanitizedLesson: OrbitLesson`.
    // This is definitely a breaking change I made.

    // I will modify `orbitSummaryService.ts` to accept `OrbitLearningLesson` instead of `OrbitLesson`.
    // This is the correct fix.

    // I will use `multi_replace_file_content` to fix `orbitSummaryService.ts` first.
    // Then I will come back here if needed.

    // Wait, I can't use `multi_replace` on a different file in this turn if I want to be safe?
    // Actually I can.

    // I will fix `orbitSummaryService.ts` to accept `OrbitLearningLesson` and optional quiz.
    // And I will revert the signature to `(userId, lesson, topic)`.
    // And inside I will do the splitting/sanitizing.

    // Let's do that.

    const saved = await saveOrbitLesson(userId, lesson, topic);
    return NextResponse.json({ lesson: saved });
  } catch (error) {
    console.error("Failed to save Orbit lesson", error);
    const message = error instanceof Error ? error.message : "Failed to save Orbit lesson";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
