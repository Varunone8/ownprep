import { desc, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attempts, questions, type SavedResponse } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [rows, aggregate] = await Promise.all([
      db.select().from(attempts).orderBy(desc(attempts.createdAt)).limit(50),
      db
        .select({
          sessions: sql<number>`count(*)::int`,
          totalCorrect: sql<number>`coalesce(sum(${attempts.correctCount}), 0)::int`,
          totalWrong: sql<number>`coalesce(sum(${attempts.wrongCount}), 0)::int`,
          totalQuestions: sql<number>`coalesce(sum(${attempts.questionCount}), 0)::int`,
          averageAccuracy: sql<number>`coalesce(avg(${attempts.accuracy}), 0)::real`,
          totalStudySeconds: sql<number>`coalesce(sum(${attempts.durationSeconds}), 0)::int`,
        })
        .from(attempts),
    ]);
    return NextResponse.json({ attempts: rows, summary: aggregate[0] });
  } catch (error) {
    console.error("Practice history could not be loaded", error);
    return NextResponse.json({ error: "Practice history is temporarily unavailable." }, { status: 500 });
  }
}

function normaliseResponse(value: unknown): string | string[] {
  if (Array.isArray(value)) return value.map((part) => String(part).trim());
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function isCorrect(expected: string | string[], response: string | string[], type: string) {
  if (type === "MSQ") {
    if (!Array.isArray(expected) || !Array.isArray(response)) return false;
    const correctSet = new Set(expected.map((value) => value.trim().toLowerCase()));
    const responseSet = new Set(response.map((value) => value.trim().toLowerCase()));
    return correctSet.size === responseSet.size && [...correctSet].every((value) => responseSet.has(value));
  }
  if (Array.isArray(expected) || Array.isArray(response)) return false;
  if (type === "NAT") {
    const expectedNumber = Number(expected.replace(/,/g, ""));
    const responseNumber = Number(response.replace(/,/g, ""));
    return Number.isFinite(expectedNumber) && Number.isFinite(responseNumber) && Math.abs(expectedNumber - responseNumber) <= 0.011;
  }
  return expected.trim().toLowerCase() === response.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawResponses: Array<{ questionId?: unknown; response?: unknown; markedForReview?: boolean; visited?: boolean }> = Array.isArray(body?.responses) ? body.responses : [];
    const uniqueIds: string[] = [...new Set<string>(rawResponses.map((entry) => entry.questionId).filter((id): id is string => typeof id === "string"))];
    if (rawResponses.length < 1 || rawResponses.length > 200 || uniqueIds.length !== rawResponses.length) {
      return NextResponse.json({ error: "A test needs 1–200 unique question responses." }, { status: 400 });
    }

    const bankRows = await db.select().from(questions).where(inArray(questions.id, uniqueIds));
    const byId = new Map(bankRows.map((question) => [question.id, question]));
    if (byId.size !== rawResponses.length) {
      return NextResponse.json({ error: "One or more questions are no longer in your bank." }, { status: 400 });
    }

    let score = 0;
    let maximumMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    const gradedResponses: SavedResponse[] = rawResponses.map((entry) => {
      const question = byId.get(String(entry.questionId))!;
      const response = normaliseResponse(entry.response);
      const unanswered = Array.isArray(response) ? response.length === 0 : response.length === 0;
      const correct = !unanswered && isCorrect(question.answer, response, question.type);
      let marksAwarded = 0;
      maximumMarks += question.marks;

      if (unanswered) {
        unansweredCount += 1;
      } else if (correct) {
        correctCount += 1;
        marksAwarded = question.marks;
      } else {
        wrongCount += 1;
        if (question.type === "MCQ") marksAwarded = question.marks === 1 ? -1 / 3 : -2 / 3;
      }
      score += marksAwarded;
      return {
        questionId: question.id,
        response,
        correct,
        marksAwarded,
        markedForReview: Boolean(entry.markedForReview),
        visited: Boolean(entry.visited),
      };
    });

    const answeredCount = correctCount + wrongCount;
    const accuracy = answeredCount ? (correctCount / answeredCount) * 100 : 0;
    const durationSeconds = Math.round(Math.min(Math.max(Number(body?.durationSeconds) || 0, 0), 64800));
    const mode = typeof body?.mode === "string" ? body.mode.slice(0, 40) : "practice";
    const title = typeof body?.title === "string" ? body.title.slice(0, 120) : "Practice session";
    const [saved] = await db.insert(attempts).values({
      title,
      mode,
      questionCount: rawResponses.length,
      correctCount,
      wrongCount,
      unansweredCount,
      score: Number(score.toFixed(2)),
      maximumMarks,
      accuracy: Number(accuracy.toFixed(2)),
      durationSeconds,
      responses: gradedResponses,
    }).returning();

    const reviewedResponses = gradedResponses.map((response) => ({
      ...response,
      expectedAnswer: byId.get(response.questionId)!.answer,
    }));
    return NextResponse.json({ attempt: saved, responses: reviewedResponses }, { status: 201 });
  } catch (error) {
    console.error("Practice attempt could not be saved", error);
    return NextResponse.json({ error: "Your practice attempt could not be saved." }, { status: 500 });
  }
}
