import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { starterQuestions } from "@/lib/question-bank";

export const dynamic = "force-dynamic";

async function makeSureStarterBankExists() {
  await db
    .insert(questions)
    .values(starterQuestions)
    .onConflictDoNothing({ target: questions.seedKey });
}

export async function GET(request: Request) {
  try {
    await makeSureStarterBankExists();
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const subject = url.searchParams.get("subject")?.trim();
    const topic = url.searchParams.get("topic")?.trim();
    const questionId = url.searchParams.get("id")?.trim();
    const source = url.searchParams.get("source")?.trim();
    const includeAnswers = url.searchParams.get("includeAnswers") === "true";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
    const filters = [];

    if (search) {
      filters.push(
        or(
          ilike(questions.question, `%${search}%`),
          ilike(questions.topic, `%${search}%`),
          ilike(questions.subject, `%${search}%`),
        ),
      );
    }
    if (subject && subject !== "All subjects") filters.push(ilike(questions.subject, subject));
    if (topic && topic !== "All topics") filters.push(ilike(questions.topic, topic));
    if (source) filters.push(eq(questions.source, source));
    if (questionId) filters.push(eq(questions.id, questionId));

    const whereClause = filters.length ? and(...filters) : undefined;
    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(questions)
        .where(whereClause)
        .orderBy(desc(questions.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(questions)
        .where(whereClause),
    ]);

    const visibleQuestions = includeAnswers
      ? rows
      : rows.map((row) => {
          const { answer, ...publicQuestion } = row;
          void answer;
          return publicQuestion;
        });
    return NextResponse.json({ questions: visibleQuestions, total: countResult[0]?.count ?? 0, limit, offset });
  } catch (error) {
    console.error("Question bank could not be loaded", error);
    return NextResponse.json({ error: "The question bank is temporarily unavailable." }, { status: 500 });
  }
}

function normaliseQuestion(raw: Record<string, unknown>) {
  const question = typeof raw.question === "string" ? raw.question.trim() : "";
  const subject = typeof raw.subject === "string" && raw.subject.trim() ? raw.subject.trim() : "Imported questions";
  const topic = typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim() : "Unsorted";
  const type = String(raw.type ?? "MCQ").toUpperCase();
  const options = Array.isArray(raw.options)
    ? raw.options.map((option) => String(option).trim()).filter(Boolean)
    : typeof raw.options === "string"
      ? raw.options.split("|").map((option) => option.trim()).filter(Boolean)
      : [];
  const answer = Array.isArray(raw.answer)
    ? raw.answer.map((item) => String(item).trim()).filter(Boolean)
    : String(raw.answer ?? "").trim();

  if (!question || question.length > 12000) throw new Error("Each question needs text (up to 12,000 characters). ");
  if (!["MCQ", "MSQ", "NAT"].includes(type)) throw new Error("Question type must be MCQ, MSQ or NAT.");
  if (!answer || (Array.isArray(answer) && !answer.length)) throw new Error("Each question needs a correct answer.");
  if (type === "MCQ" && Array.isArray(answer)) throw new Error("MCQ answers must be a single option.");
  if (type === "MSQ" && !Array.isArray(answer)) throw new Error("MSQ answers must be an array of options.");
  if (type !== "NAT" && options.length < 2) throw new Error("MCQ and MSQ questions need at least two options.");
  if (type === "MCQ" && typeof answer === "string" && !options.includes(answer)) throw new Error("Correct MCQ answer must exactly match one of the listed options.");
  if (type === "MSQ" && Array.isArray(answer) && answer.some((item) => !options.includes(item))) throw new Error("Every correct MSQ answer must exactly match a listed option.");

  const boundedNumber = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
  };
  const commonMistakes = Array.isArray(raw.commonMistakes)
    ? raw.commonMistakes.map((mistake) => String(mistake)).filter(Boolean).slice(0, 8)
    : [];

  return {
    seedKey: typeof raw.seedKey === "string" && raw.seedKey.trim() ? raw.seedKey.trim().slice(0, 150) : null,
    question,
    subject: subject.slice(0, 100),
    topic: topic.slice(0, 100),
    subtopic: typeof raw.subtopic === "string" ? raw.subtopic.slice(0, 150) : "",
    type,
    marks: Math.round(boundedNumber(raw.marks, 1, 1, 2)),
    difficulty: boundedNumber(raw.difficulty, 0.7, -3, 3),
    discrimination: boundedNumber(raw.discrimination, 1.15, 0, 3),
    guessing: boundedNumber(raw.guessing, type === "MCQ" ? 0.25 : type === "MSQ" ? 0.03 : 0, 0, 1),
    bloom: Math.round(boundedNumber(raw.bloom, 3, 3, 5)),
    estimatedSeconds: Math.round(boundedNumber(raw.estimatedSeconds, type === "NAT" ? 180 : 90, 30, 1800)),
    options,
    answer,
    explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    commonMistakes,
    source: typeof raw.source === "string" && raw.source.trim() ? raw.source.trim().slice(0, 120) : "Imported by you",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawQuestions: unknown[] = Array.isArray(body?.questions) ? body.questions : [body];
    if (rawQuestions.length < 1 || rawQuestions.length > 3000) {
      return NextResponse.json({ error: "Import between 1 and 3,000 questions at a time." }, { status: 400 });
    }

    const prepared = rawQuestions.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Each imported item must be a question object.");
      return normaliseQuestion(raw as Record<string, unknown>);
    });
    const inserted = await db.insert(questions).values(prepared).onConflictDoNothing({ target: questions.seedKey }).returning();
    return NextResponse.json({ imported: inserted.length, questions: inserted }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The questions could not be imported.";
    const status = error instanceof SyntaxError ? 400 : message.startsWith("Each ") || message.startsWith("MCQ") || message.startsWith("MSQ") || message.startsWith("Import") || message.startsWith("Question type") || message.startsWith("Correct ") || message.startsWith("Every correct ") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id } = body ?? {};
    if (typeof id !== "string" || !/^[\\da-f]{8}-[\\da-f]{4}-[\\da-f]{4}-[\\da-f]{4}-[\\da-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "A valid question ID is required." }, { status: 400 });
    }
    const [existing] = await db.select({ seedKey: questions.seedKey }).from(questions).where(eq(questions.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "That question is no longer in your bank." }, { status: 404 });
    const updatedValues = normaliseQuestion({ ...body, seedKey: body.seedKey ?? existing.seedKey });
    const [updated] = await db.update(questions).set(updatedValues).where(eq(questions.id, id)).returning();
    return NextResponse.json({ question: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The question could not be updated.";
    const isValidation = message.startsWith("Each ") || message.startsWith("MCQ") || message.startsWith("MSQ") || message.startsWith("Question type") || message.startsWith("Correct ") || message.startsWith("Every correct ");
    console.error("Question update failed", error);
    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (typeof id !== "string") return NextResponse.json({ error: "A question ID is required." }, { status: 400 });
    const deleted = await db.delete(questions).where(sql`${questions.id} = ${id}::uuid`).returning({ id: questions.id });
    return NextResponse.json({ deleted: deleted.length > 0 });
  } catch (error) {
    console.error("Question could not be deleted", error);
    return NextResponse.json({ error: "The question could not be deleted." }, { status: 500 });
  }
}
