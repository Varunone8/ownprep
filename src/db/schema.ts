import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  seedKey: text("seed_key").unique(),
  question: text("question").notNull(),
  subject: text("subject").notNull(),
  topic: text("topic").notNull(),
  subtopic: text("subtopic").notNull().default(""),
  type: text("type").notNull().default("MCQ"),
  marks: integer("marks").notNull().default(1),
  difficulty: real("difficulty").notNull().default(0.7),
  discrimination: real("discrimination").notNull().default(1.15),
  guessing: real("guessing").notNull().default(0.25),
  bloom: integer("bloom").notNull().default(3),
  estimatedSeconds: integer("estimated_seconds").notNull().default(90),
  options: jsonb("options").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  answer: jsonb("answer").$type<string | string[]>().notNull(),
  explanation: text("explanation").notNull().default(""),
  commonMistakes: jsonb("common_mistakes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  source: text("source").notNull().default("Original practice"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SavedResponse = {
  questionId: string;
  response: string | string[];
  correct: boolean;
  marksAwarded: number;
  markedForReview: boolean;
  visited: boolean;
  feeling?: "too-easy" | "about-right" | "too-hard" | "un-gate-like";
};

export const attempts = pgTable("attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull().default("Practice session"),
  mode: text("mode").notNull().default("practice"),
  questionCount: integer("question_count").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  wrongCount: integer("wrong_count").notNull().default(0),
  unansweredCount: integer("unanswered_count").notNull().default(0),
  score: real("score").notNull().default(0),
  maximumMarks: real("maximum_marks").notNull().default(0),
  accuracy: real("accuracy").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  responses: jsonb("responses").$type<SavedResponse[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
