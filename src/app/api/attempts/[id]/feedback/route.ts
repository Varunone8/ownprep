import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attempts, type SavedResponse } from "@/db/schema";

const ALLOWED_FEELINGS = ["too-easy", "about-right", "too-hard", "un-gate-like"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "A valid saved-session ID is required." }, { status: 400 });
    }

    const body = await request.json();
    const { questionId, feeling } = body ?? {};
    if (typeof questionId !== "string" || !ALLOWED_FEELINGS.includes(feeling)) {
      return NextResponse.json({ error: "Choose a question and one of the available feedback labels." }, { status: 400 });
    }

    const [session] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1);
    if (!session) return NextResponse.json({ error: "That practice session was not found." }, { status: 404 });
    const responses: SavedResponse[] = [...(session.responses ?? [])];
    const responseIndex = responses.findIndex((response) => response.questionId === questionId);
    if (responseIndex < 0) return NextResponse.json({ error: "That question was not part of this session." }, { status: 404 });

    responses[responseIndex] = { ...responses[responseIndex], feeling };
    await db.update(attempts).set({ responses }).where(eq(attempts.id, id));
    return NextResponse.json({ saved: true, questionId, feeling });
  } catch (error) {
    console.error("Question feedback could not be saved", error);
    return NextResponse.json({ error: "Question feedback could not be saved." }, { status: 500 });
  }
}
