"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Bookmark,
  Brain,
  Calculator as CalculatorIcon,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudUpload,
  Code2,
  Database,
  Download,
  FileText,
  Filter,
  Flame,
  Flag,
  GraduationCap,
  Grid2X2,
  House,
  Layers,
  LoaderCircle,
  ListChecks,
  Menu,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trash2,
  Trophy,
  Upload,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import type { QuestionFormat, QuestionSeed } from "@/lib/question-bank";
import { generatePracticePack } from "@/lib/generated-pack";

type Question = {
  id: string;
  question: string;
  subject: string;
  topic: string;
  subtopic: string;
  type: QuestionFormat;
  marks: number;
  difficulty: number;
  discrimination: number;
  guessing: number;
  bloom: number;
  estimatedSeconds: number;
  options: string[];
  answer?: string | string[];
  explanation: string;
  commonMistakes: string[];
  source: string;
  createdAt: string;
};

type ResponseRecord = {
  questionId: string;
  response: string | string[];
  correct: boolean;
  marksAwarded: number;
  markedForReview: boolean;
  visited: boolean;
  feeling?: "too-easy" | "about-right" | "too-hard" | "un-gate-like";
};

type GradedResponse = ResponseRecord & { expectedAnswer: string | string[] };

type Attempt = {
  id: string;
  title: string;
  mode: string;
  questionCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  score: number;
  maximumMarks: number;
  accuracy: number;
  durationSeconds: number;
  responses: ResponseRecord[];
  createdAt: string;
};

type AttemptSummary = {
  sessions: number;
  totalCorrect: number;
  totalWrong: number;
  totalQuestions: number;
  averageAccuracy: number;
  totalStudySeconds: number;
};

type ActiveTest = {
  token: number;
  questions: Question[];
  mode: "practice" | "mock";
  title: string;
  allocatedSeconds: number;
  startedAt: number;
  deadline: number;
};

type PageName = "overview" | "practice" | "bank" | "studio" | "insights" | "syllabus" | "results";

type DraftState = {
  question: string;
  subject: string;
  topic: string;
  subtopic: string;
  type: QuestionFormat;
  marks: number;
  difficulty: number;
  discrimination: number;
  bloom: number;
  options: string;
  answer: string;
  explanation: string;
  commonMistakes: string;
  source: string;
};

const QUESTION_GOAL = 13000;
const SUBJECTS = [
  "General Aptitude",
  "Engineering Mathematics",
  "Programming & Data Structures",
  "Algorithms",
  "Theory of Computation",
  "Compiler Design",
  "Operating Systems",
  "Databases",
  "Computer Networks",
  "Computer Organization & Architecture",
  "Digital Logic",
];
const PLANNING_MIX = [
  { subject: "General Aptitude", share: 15, note: "Verbal + quantitative" },
  { subject: "Engineering Mathematics", share: 13, note: "Discrete + core math" },
  { subject: "Programming & Data Structures", share: 9, note: "C + DS" },
  { subject: "Algorithms", share: 8, note: "Analysis + design" },
  { subject: "Digital Logic", share: 5, note: "Boolean + circuits" },
  { subject: "Computer Organization & Architecture", share: 9, note: "Processor + memory" },
  { subject: "Operating Systems", share: 10, note: "Processes + systems" },
  { subject: "Databases", share: 8, note: "SQL + transactions" },
  { subject: "Theory of Computation", share: 9, note: "Automata + languages" },
  { subject: "Compiler Design", share: 6, note: "Parsing + translation" },
  { subject: "Computer Networks", share: 8, note: "Layers + protocols" },
];

const EMPTY_DRAFT: DraftState = {
  question: "",
  subject: "Algorithms",
  topic: "",
  subtopic: "",
  type: "MCQ",
  marks: 1,
  difficulty: 0.7,
  discrimination: 1.15,
  bloom: 3,
  options: "",
  answer: "",
  explanation: "",
  commonMistakes: "",
  source: "Created by you",
};

const NAV_ITEMS: { id: PageName; label: string; icon: LucideIcon; count?: string }[] = [
  { id: "overview", label: "Overview", icon: House },
  { id: "practice", label: "Test room", icon: Grid2X2 },
  { id: "bank", label: "Question bank", icon: BookOpen },
  { id: "studio", label: "Question studio", icon: Sparkles },
  { id: "insights", label: "Calibration lab", icon: BarChart3 },
  { id: "syllabus", label: "Syllabus map", icon: Layers },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(dateValue: string | Date) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDuration(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remaining = wholeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function difficultyLabel(value: number) {
  if (value < 0.4) return "Warm-up";
  if (value < 0.85) return "Standard";
  return "Stretch";
}

function downloadBlob(content: string, filename: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatQuestionExport(questions: Array<Question | QuestionSeed>, heading = "GATE CSE practice bank") {
  return [
    `${heading}`,
    "Generated/imported study material. Check official GATE notices for the current syllabus and use the source label on each item.",
    "Difficulty (b), discrimination (a), and guessing (c) are author priors unless enough cohort response data has been collected.",
    "",
    ...questions.flatMap((item, index) => {
      const answer = Array.isArray(item.answer) ? item.answer.join(" | ") : item.answer ?? "Answer hidden until review";
      return [
        `Q${String(index + 1).padStart(4, "0")} · ${item.subject} / ${item.topic} · ${item.type} · ${item.marks} mark${item.marks === 1 ? "" : "s"}`,
        item.question,
        ...(item.options.length ? item.options.map((option, optionIndex) => `  ${String.fromCharCode(65 + optionIndex)}. ${option}`) : []),
        `Answer: ${answer}`,
        item.explanation ? `Solution: ${item.explanation}` : "Solution: Add a worked explanation before using this item for formal assessment.",
        `Common mistakes: ${item.commonMistakes.join(" | ") || "Add distractor rationale during review."}`,
        `IRT design prior: b=${item.difficulty}; a=${item.discrimination}; c=${item.guessing}; Bloom ${item.bloom}; suggested time ${item.estimatedSeconds}s. Source: ${item.source}.`,
        "",
      ];
    }),
  ].join("\n");
}

function parseCsvRows(content: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"' && inQuotes && content[index + 1] === '"') {
      currentCell += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      currentRow.push(currentCell.trim());
      if (currentRow.some(Boolean)) rows.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += character;
    }
  }
  currentRow.push(currentCell.trim());
  if (currentRow.some(Boolean)) rows.push(currentRow);
  return rows;
}

function parseQuestionText(content: string) {
  const normalized = content.replace(/\r/g, "\n").replace(/\u00a0/g, " ");
  const sections = normalized
    .split(/(?=^\s*(?:Q(?:uestion)?\s*)?\d{1,4}\s*[).:\-])/gim)
    .map((section) => section.trim())
    .filter(Boolean);
  const questions: Record<string, unknown>[] = [];
  for (const section of sections) {
    const optionMatches = [...section.matchAll(/^\s*([A-D])\s*[).:]\s*(.+?)\s*$/gim)];
    const answerMatch = section.match(/(?:correct\s*)?answer\s*[:=\-]\s*(?:\(?\s*([A-D])\s*\)?|([^\n]+))/i)
      ?? section.match(/\bans\.?\s*[:=\-]\s*(?:\(?\s*([A-D])\s*\)?|([^\n]+))/i);
    if (!answerMatch) continue;

    const metadataStart = section.search(/^\s*(?:answer|explanation|subject|topic|type|marks)\s*[:=]/im);
    const preMetadata = metadataStart < 0 ? section : section.slice(0, metadataStart);
    const optionStart = optionMatches[0]?.index ?? -1;
    const promptRaw = optionStart >= 0 ? preMetadata.slice(0, optionStart) : preMetadata;
    const question = promptRaw.replace(/^\s*(?:Q(?:uestion)?\s*)?\d{1,4}\s*[).:\-]\s*/i, "").trim();
    if (question.length < 12) continue;

    const subject = section.match(/^\s*subject\s*[:=]\s*([^\n]+)/im)?.[1]?.trim() ?? "Imported PYQ · review source";
    const topic = section.match(/^\s*topic\s*[:=]\s*([^\n]+)/im)?.[1]?.trim() ?? "To classify";
    const explanation = section.match(/^\s*explanation\s*[:=]\s*([\s\S]*?)(?=\n\s*(?:subject|topic|type|marks)\s*[:=]|$)/im)?.[1]?.trim() ?? "";
    const answerLabel = (answerMatch[1] ?? "").toUpperCase();
    const answerText = (answerMatch[2] ?? "").trim().replace(/^\(?\s*([A-D])\s*\)?[.)]?\s*/, "");
    const options = optionMatches.map((match) => match[2].trim());
    let answer: string | string[];
    let type: QuestionFormat;
    if (options.length >= 2) {
      const correctOptionIndex = answerLabel ? answerLabel.charCodeAt(0) - 65 : -1;
      const selected = correctOptionIndex >= 0 ? options[correctOptionIndex] : answerText;
      if (!selected || !options.includes(selected)) continue;
      answer = selected;
      type = "MCQ";
    } else {
      if (!answerText) continue;
      answer = answerText;
      type = "NAT";
    }

    questions.push({
      question,
      subject,
      topic,
      subtopic: "",
      type,
      marks: Number(section.match(/^\s*marks\s*[:=]\s*(\d)/im)?.[1]) === 2 ? 2 : 1,
      options,
      answer,
      explanation,
      commonMistakes: [],
      source: "User-provided document · verify year and paper",
    });
  }
  return questions;
}

function parseImportRecords(content: string, fileType: string): Record<string, unknown>[] {
  if (fileType === "json") {
    const parsed: unknown = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    if (parsed && typeof parsed === "object" && "questions" in parsed && Array.isArray((parsed as { questions?: unknown }).questions)) {
      return (parsed as { questions: Record<string, unknown>[] }).questions;
    }
    throw new Error("JSON must be an array of question objects or an object with a questions array.");
  }
  if (fileType === "csv") {
    const [headerRow, ...dataRows] = parseCsvRows(content);
    if (!headerRow?.length) return [];
    const headers = headerRow.map((header) => header.toLowerCase().trim().replace(/[\s-]+/g, "_"));
    return dataRows.map((row) => {
      const value: Record<string, unknown> = {};
      headers.forEach((header, index) => { value[header] = row[index] ?? ""; });
      const type = String(value.type || "MCQ").toUpperCase();
      const options = Array.isArray(value.options) ? value.options : String(value.options ?? "").split("|").map((entry) => entry.trim()).filter(Boolean);
      const answerValue = String(value.answer ?? "").trim();
      return {
        ...value,
        type,
        options,
        answer: type === "MSQ" ? answerValue.split("|").map((entry) => entry.trim()).filter(Boolean) : answerValue,
        marks: Number(value.marks) || 1,
        difficulty: Number(value.difficulty) || 0.7,
        discrimination: Number(value.discrimination) || 1.15,
        guessing: value.guessing === "" ? undefined : Number(value.guessing),
        bloom: Number(value.bloom) || 3,
        estimatedSeconds: Number(value.estimated_seconds ?? value.estimatedseconds) || 90,
        commonMistakes: String(value.common_mistakes ?? "").split("|").map((entry) => entry.trim()).filter(Boolean),
      };
    });
  }
  return parseQuestionText(content);
}

function evaluateCalculator(expression: string, degrees: boolean) {
  const tokens = expression.match(/\s*(?:(?:\d+\.?\d*|\.\d+)|(?:sin|cos|tan|sqrt|log|ln|abs|pi)|[()+\-*/^])/gi);
  const remainder = expression.replace(/\s+/g, "").replace(/(?:\d+\.?\d*|\.\d+|sin|cos|tan|sqrt|log|ln|abs|pi|[()+\-*/^])/gi, "");
  if (!tokens?.length || remainder) throw new Error("Check the expression.");
  const clean = tokens.map((token) => token.trim().toLowerCase());
  let pointer = 0;
  const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };

  function parseExpression(minimumPrecedence = 0): number {
    const token = clean[pointer++];
    if (!token) throw new Error("Finish the expression.");
    let value: number;
    if (token === "+" || token === "-") {
      const inner = parseExpression(4);
      value = token === "-" ? -inner : inner;
    } else if (token === "(") {
      value = parseExpression(0);
      if (clean[pointer++] !== ")") throw new Error("Missing closing parenthesis.");
    } else if (token === "pi") {
      value = Math.PI;
    } else if (/^(sin|cos|tan|sqrt|log|ln|abs)$/.test(token)) {
      if (clean[pointer] === "(") pointer += 1;
      const argument = parseExpression(0);
      if (clean[pointer] === ")") pointer += 1;
      const angle = degrees && ["sin", "cos", "tan"].includes(token) ? argument * Math.PI / 180 : argument;
      const functions: Record<string, (input: number) => number> = {
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        sqrt: Math.sqrt,
        log: Math.log10,
        ln: Math.log,
        abs: Math.abs,
      };
      value = functions[token](angle);
    } else {
      value = Number(token);
      if (!Number.isFinite(value)) throw new Error("Use a supported number or function.");
    }

    while (pointer < clean.length) {
      const operator = clean[pointer];
      const level = precedence[operator];
      if (level === undefined || level < minimumPrecedence) break;
      pointer += 1;
      const right = parseExpression(operator === "^" ? level : level + 1);
      if (operator === "+") value += right;
      if (operator === "-") value -= right;
      if (operator === "*") value *= right;
      if (operator === "/") {
        if (right === 0) throw new Error("Cannot divide by zero.");
        value /= right;
      }
      if (operator === "^") value **= right;
    }
    return value;
  }

  const result = parseExpression();
  if (pointer !== clean.length || !Number.isFinite(result)) throw new Error("Check the expression.");
  return Number(result.toPrecision(10));
}

function ScientificCalculator({ onClose }: { onClose: () => void }) {
  const [expression, setExpression] = useState("");
  const [display, setDisplay] = useState("0");
  const [message, setMessage] = useState("");
  const [degrees, setDegrees] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const append = (value: string) => {
    setExpression((current) => current + value);
    setMessage("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const clear = () => { setExpression(""); setDisplay("0"); setMessage(""); };
  const solve = () => {
    try {
      const result = evaluateCalculator(expression, degrees);
      const rounded = Number(result.toPrecision(9)).toString();
      setDisplay(rounded);
      setHistory((items) => [expression, rounded].every(Boolean) ? [`${expression} = ${rounded}`, ...items].slice(0, 5) : items);
      setExpression(rounded);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Check the expression.");
    }
  };
  const keys = [
    ["sin", "cos", "tan", "(", ")"],
    ["7", "8", "9", "÷", "DEL"],
    ["4", "5", "6", "×", "√"],
    ["1", "2", "3", "−", "π"],
    ["0", ".", "^", "+", "="],
  ];

  return (
    <div className="calculator-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="calculator-card" aria-label="Scientific calculator">
        <div className="calculator-head">
          <div className="calculator-title"><span className="calculator-icon"><CalculatorIcon size={16} /></span><div><strong>Scientific calculator</strong><small>GATE-style working pad</small></div></div>
          <div className="calculator-head-actions"><button className={`degree-toggle ${degrees ? "is-on" : ""}`} onClick={() => setDegrees((value) => !value)}>{degrees ? "DEG" : "RAD"}</button><button className="icon-button" aria-label="Close calculator" onClick={onClose}><X size={18} /></button></div>
        </div>
        <div className="calculator-screen"><span className="calculator-screen-label">EXPRESSION</span><input ref={inputRef} aria-label="Calculator expression" value={expression} onChange={(event) => setExpression(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") solve(); }} placeholder="e.g. sin(30) + 4^2" /><div className="calculator-answer"><span>{message || "RESULT"}</span><strong>{message ? "" : display}</strong></div></div>
        <div className="calculator-keypad">
          {keys.flat().map((key) => <button key={key} className={`calc-key ${["÷", "×", "−", "+", "√", "π", "sin", "cos", "tan", "^"].includes(key) ? "calc-key-soft" : ""} ${key === "=" ? "calc-key-equals" : ""}`} onClick={() => {
            if (key === "=") solve();
            else if (key === "DEL") { setExpression((value) => value.slice(0, -1)); setMessage(""); }
            else if (key === "√") append("sqrt(");
            else if (key === "π") append("pi");
            else if (key === "÷") append("/");
            else if (key === "×") append("*");
            else if (key === "−") append("-");
            else append(key);
          }}>{key === "√" ? "√ x" : key}</button>)}
        </div>
        <div className="calculator-foot"><div className="calculator-history-label"><Clock3 size={13} /> RECENT</div>{history.length ? history.slice(0, 2).map((line, index) => <button key={`${line}-${index}`} className="calculator-history-row" onClick={() => { setExpression(line.split(" = ")[0]); }}>{line}</button>) : <span className="calculator-history-empty">Your calculations stay in this session.</span>}</div>
      </section>
    </div>
  );
}

export function GateStudyApp() {
  const [page, setPage] = useState<PageName>("overview");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [starterSet, setStarterSet] = useState<Question[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [summary, setSummary] = useState<AttemptSummary>({ sessions: 0, totalCorrect: 0, totalWrong: 0, totalQuestions: 0, averageAccuracy: 0, totalStudySeconds: 0 });
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupLength, setSetupLength] = useState(10);
  const [setupSubject, setSetupSubject] = useState("All subjects");
  const [setupMode, setSetupMode] = useState<"practice" | "mock">("practice");
  const [activeTest, setActiveTest] = useState<ActiveTest | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ attempt: Attempt; questions: Question[]; responses: GradedResponse[] } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [draftSaving, setDraftSaving] = useState(false);
  const [editQuestionId, setEditQuestionId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFileType, setImportFileType] = useState("txt");
  const [importFileLabel, setImportFileLabel] = useState("");
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMode, setImportMode] = useState<"add" | "review">("add");
  const [importNotice, setImportNotice] = useState("");
  const [searchText, setSearchText] = useState("");
  const [bankSubject, setBankSubject] = useState("All subjects");
  const [bankFormat, setBankFormat] = useState("All formats");
  const [preview, setPreview] = useState<Question | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [dailyTarget, setDailyTarget] = useState(30);
  const [todayLabel, setTodayLabel] = useState("");
  const [packBusy, setPackBusy] = useState(false);
  const [packMessage, setPackMessage] = useState("");
  const [chartPeriod, setChartPeriod] = useState<"week" | "month">("week");
  const [lowQuestionsOnly, setLowQuestionsOnly] = useState(false);
  const [testSearch, setTestSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef(0);
  const submittingRef = useRef(false);
  const finishTestRef = useRef<() => Promise<void>>(async () => {});

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [questionResponse, attemptResponse, starterResponse] = await Promise.all([
        fetch("/api/questions?limit=500&offset=0", { cache: "no-store" }),
        fetch("/api/attempts", { cache: "no-store" }),
        fetch("/api/questions?limit=10&source=Original%20practice", { cache: "no-store" }),
      ]);
      const [questionData, attemptData, starterData] = await Promise.all([questionResponse.json(), attemptResponse.json(), starterResponse.json()]);
      if (!questionResponse.ok) throw new Error(questionData.error || "Question bank could not be reached.");
      if (!attemptResponse.ok) throw new Error(attemptData.error || "Practice history could not be reached.");
      if (!starterResponse.ok) throw new Error(starterData.error || "The Round 1 baseline could not be reached.");
      setQuestions(questionData.questions as Question[]);
      setStarterSet(starterData.questions as Question[]);
      setTotalQuestions(Number(questionData.total) || 0);
      setAttempts((attemptData.attempts ?? []) as Attempt[]);
      setSummary({
        sessions: Number(attemptData.summary?.sessions) || 0,
        totalCorrect: Number(attemptData.summary?.totalCorrect) || 0,
        totalWrong: Number(attemptData.summary?.totalWrong) || 0,
        totalQuestions: Number(attemptData.summary?.totalQuestions) || 0,
        averageAccuracy: Number(attemptData.summary?.averageAccuracy) || 0,
        totalStudySeconds: Number(attemptData.summary?.totalStudySeconds) || 0,
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load your study data.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refreshData();
    setTodayLabel(new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()));
    try {
      const storedGoal = Number(window.localStorage.getItem("ranklab-daily-goal"));
      if (storedGoal >= 5 && storedGoal <= 200) setDailyTarget(storedGoal);
    } catch { /* local storage is an optional convenience */ }
  }, [refreshData]);

  const finishTest = useCallback(async () => {
    if (!activeTest || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const durationSeconds = Math.max(0, activeTest.allocatedSeconds - Math.max(0, Math.floor((activeTest.deadline - Date.now()) / 1000)));
    const submittedResponses = activeTest.questions.map((question) => ({
      questionId: question.id,
      response: answers[question.id] ?? (question.type === "MSQ" ? [] : ""),
      markedForReview: Boolean(marked[question.id]),
      visited: Boolean(visited[question.id]),
    }));
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: submittedResponses, durationSeconds, mode: activeTest.mode, title: activeTest.title }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your test could not be saved.");
      setResult({ attempt: data.attempt as Attempt, questions: activeTest.questions, responses: data.responses as GradedResponse[] });
      setActiveTest(null);
      setConfirmSubmit(false);
      setPage("results");
      setAnswers({});
      setVisited({});
      setMarked({});
      await refreshData();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not submit your test.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [activeTest, answers, marked, notify, refreshData, visited]);

  useEffect(() => {
    finishTestRef.current = finishTest;
  }, [finishTest]);

  useEffect(() => {
    if (!activeTest) return;
    const updateClock = () => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) void finishTestRef.current();
    };
    updateClock();
    const timer = window.setInterval(updateClock, 500);
    return () => window.clearInterval(timer);
  }, [activeTest?.token]);

  const solvedItems = summary.totalCorrect + summary.totalWrong;
  const accuracy = solvedItems ? Math.round(summary.totalCorrect / solvedItems * 100) : 0;
  const goalProgress = Math.min(100, Math.round(totalQuestions / QUESTION_GOAL * 100));
  const todayKey = dateKey(new Date());
  const todayCount = attempts.filter((attempt) => dateKey(attempt.createdAt) === todayKey).reduce((total, attempt) => total + attempt.questionCount - attempt.unansweredCount, 0);
  const daySet = new Set(attempts.map((attempt) => dateKey(attempt.createdAt)));
  const streak = (() => {
    const cursor = new Date();
    if (!daySet.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (daySet.has(dateKey(cursor))) { count += 1; cursor.setDate(cursor.getDate() - 1); }
    return count;
  })();

  const dayBars = useMemo(() => {
    const days = chartPeriod === "week" ? 7 : 28;
    return Array.from({ length: days }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (days - index - 1));
      const key = dateKey(day);
      const items = attempts.filter((attempt) => dateKey(attempt.createdAt) === key).reduce((total, attempt) => total + attempt.questionCount, 0);
      return { key, items, label: chartPeriod === "week" ? DAY_LABELS[(day.getDay() + 6) % 7] : String(day.getDate()) };
    });
  }, [attempts, chartPeriod]);
  const maxDayItems = Math.max(5, ...dayBars.map((day) => day.items));

  const filteredQuestions = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return questions.filter((question) => {
      const matchesText = !needle || `${question.question} ${question.subject} ${question.topic} ${question.subtopic} ${question.source}`.toLowerCase().includes(needle);
      const matchesSubject = bankSubject === "All subjects" || question.subject === bankSubject;
      const matchesFormat = bankFormat === "All formats" || question.type === bankFormat;
      const matchesStruggle = !lowQuestionsOnly || question.difficulty >= 0.8;
      return matchesText && matchesSubject && matchesFormat && matchesStruggle;
    });
  }, [bankFormat, bankSubject, lowQuestionsOnly, questions, searchText]);

  const beginTest = useCallback((requestedQuestions: Question[], mode: "practice" | "mock", title: string, announcedDuration?: number) => {
    if (!requestedQuestions.length) {
      notify("There are no questions in this selection yet. Import or create a few first.");
      return;
    }
    const allocatedSeconds = announcedDuration ?? (mode === "mock"
      ? Math.ceil(180 * 60 * Math.min(1, requestedQuestions.length / 65))
      : requestedQuestions.reduce((total, question) => total + (question.marks === 2 ? 180 : 90), 0));
    const now = Date.now();
    const session: ActiveTest = {
      token: now,
      questions: requestedQuestions,
      mode,
      title,
      allocatedSeconds,
      startedAt: now,
      deadline: now + allocatedSeconds * 1000,
    };
    deadlineRef.current = session.deadline;
    submittingRef.current = false;
    setActiveIndex(0);
    setSecondsLeft(allocatedSeconds);
    setAnswers({});
    setMarked({});
    setVisited({ [requestedQuestions[0].id]: true });
    setResult(null);
    setActiveTest(session);
    setSetupOpen(false);
    setPage("practice");
  }, [notify]);

  const openSetup = (subject = "All subjects") => {
    setSetupSubject(subject);
    setSetupOpen(true);
  };

  const startConfiguredTest = () => {
    const pool = questions.filter((question) => setupSubject === "All subjects" || question.subject === setupSubject);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(setupLength, shuffled.length));
    if (selected.length < setupLength) notify(`There are ${selected.length} matching questions in the bank; this set uses all ${selected.length}.`);
    beginTest(selected, setupMode, setupMode === "mock" ? "Full mock · GATE CSE" : `${setupSubject === "All subjects" ? "Mixed practice" : setupSubject} · focused set`);
  };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDraftSaving(true);
    try {
      const options = draft.options.split("\n").map((value) => value.trim()).filter(Boolean);
      const answer = draft.type === "MSQ" ? draft.answer.split("|").map((value) => value.trim()).filter(Boolean) : draft.answer.trim();
      const response = await fetch("/api/questions", {
        method: editQuestionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editQuestionId ? { id: editQuestionId } : {}),
          question: draft.question,
          subject: draft.subject,
          topic: draft.topic,
          subtopic: draft.subtopic,
          type: draft.type,
          marks: draft.marks,
          difficulty: draft.difficulty,
          discrimination: draft.discrimination,
          guessing: draft.type === "MCQ" ? 0.25 : draft.type === "MSQ" ? 0.03 : 0,
          bloom: draft.bloom,
          estimatedSeconds: draft.marks === 2 ? 180 : 90,
          options,
          answer,
          explanation: draft.explanation,
          commonMistakes: draft.commonMistakes.split("\n").map((value) => value.trim()).filter(Boolean),
          source: draft.source || "Created by you",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Question could not be saved.");
      setCreateOpen(false);
      setDraft(EMPTY_DRAFT);
      setPage("bank");
      await refreshData();
      notify("Question saved to your bank.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Question could not be saved.");
    } finally {
      setDraftSaving(false);
    }
  };

  const importPreview = useMemo(() => {
    if (!importText.trim()) return { records: [] as Record<string, unknown>[], error: "" };
    try {
      return { records: parseImportRecords(importText, importFileType), error: "" };
    } catch (error) {
      return { records: [] as Record<string, unknown>[], error: error instanceof Error ? error.message : "Could not read this file." };
    }
  }, [importFileType, importText]);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "txt";
    setImportFileLabel(file.name);
    setImportError("");
    setImportNotice("");
    if (extension === "pdf") {
      setImportFileType("txt");
      setImportBusy(true);
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
        }
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const pages: string[] = [];
        const maximumPages = Math.min(pdf.numPages, 250);
        for (let pageNumber = 1; pageNumber <= maximumPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          const lines = new Map<number, string[]>();
          for (const rawItem of content.items) {
            if (!("str" in rawItem) || !rawItem.str.trim()) continue;
            const y = Math.round(rawItem.transform?.[5] ?? 0);
            lines.set(y, [...(lines.get(y) ?? []), rawItem.str.trim()]);
          }
          const text = [...lines.entries()].sort((left, right) => right[0] - left[0]).map(([, pieces]) => pieces.join(" ")).join("\n");
          pages.push(text);
        }
        await pdf.destroy();
        const extracted = pages.join("\n\n").trim();
        setImportText(extracted);
        setImportNotice(`${maximumPages} page${maximumPages === 1 ? "" : "s"} of text extracted. Scanned image-only pages need OCR before they can be parsed.`);
        if (maximumPages < pdf.numPages) setImportNotice((value) => `${value} Only the first 250 pages were processed.`);
      } catch (error) {
        setImportError(error instanceof Error ? `PDF text extraction failed: ${error.message}` : "PDF text extraction failed. Try a text-searchable PDF or convert it to TXT.");
      } finally {
        setImportBusy(false);
      }
    } else if (["json", "csv", "txt", "md"].includes(extension)) {
      setImportFileType(extension === "md" ? "txt" : extension);
      try {
        setImportText(await file.text());
      } catch {
        setImportError("This file could not be read in the browser.");
      }
    } else {
      setImportError("Choose a PDF, JSON, CSV or TXT file.");
    }
    event.target.value = "";
  };

  const performImport = async () => {
    if (!importPreview.records.length) {
      setImportError(importPreview.error || "No structured questions were found. Check the import format below.");
      return;
    }
    setImportBusy(true);
    setImportError("");
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: importPreview.records }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Questions could not be imported.");
      setImportOpen(false);
      setImportText("");
      setImportFileLabel("");
      await refreshData();
      notify(`${data.imported} question${data.imported === 1 ? "" : "s"} added to the bank.`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed. Check that each answer matches the listed options.");
    } finally {
      setImportBusy(false);
    }
  };

  const openQuestionPreview = async (question: Question) => {
    setPreview(question);
    setPreviewBusy(true);
    try {
      const response = await fetch(`/api/questions?id=${encodeURIComponent(question.id)}&includeAnswers=true&limit=1`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.questions?.[0]) setPreview(data.questions[0] as Question);
    } catch { /* the question preview still works without its answer key */ }
    finally { setPreviewBusy(false); }
  };

  const openQuestionEditor = (question: Question) => {
    setDraft({
      question: question.question,
      subject: question.subject,
      topic: question.topic,
      subtopic: question.subtopic,
      type: question.type,
      marks: question.marks,
      difficulty: question.difficulty,
      discrimination: question.discrimination,
      bloom: question.bloom,
      options: question.options.join("\\n"),
      answer: Array.isArray(question.answer) ? question.answer.join(" | ") : question.answer ?? "",
      explanation: question.explanation,
      commonMistakes: question.commonMistakes.join("\\n"),
      source: question.source,
    });
    setEditQuestionId(question.id);
    setPreview(null);
    setCreateOpen(true);
  };

  const deleteQuestion = async (question: Question) => {
    if (!window.confirm("Remove this question from your bank? Past attempts will stay in your history.")) return;
    try {
      const response = await fetch("/api/questions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: question.id }) });
      if (!response.ok) throw new Error("Question could not be removed.");
      setPreview(null);
      await refreshData();
      notify("Question removed from the bank.");
    } catch (error) { notify(error instanceof Error ? error.message : "Question could not be removed."); }
  };

  const generatePack = async () => {
    if (packBusy) return;
    setPackBusy(true);
    setPackMessage("Preparing 3,000 checked parameter variants…");
    try {
      const pack = generatePracticePack(3000);
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: pack }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The practice pack could not be added.");
      setPackMessage(data.imported === 0 ? "This pack is already in your bank. Download it again or start practicing." : `${data.imported.toLocaleString()} new parameterized items added. The pack is saved in your PostgreSQL bank.`);
      await refreshData();
      notify(data.imported ? `${data.imported.toLocaleString()} generated questions added.` : "The 3,000-item pack is already in your bank.");
    } catch (error) {
      setPackMessage(error instanceof Error ? error.message : "The practice pack could not be created.");
    } finally {
      setPackBusy(false);
    }
  };

  const downloadGeneratedPack = () => {
    const pack = generatePracticePack(3000);
    downloadBlob(formatQuestionExport(pack, "GATE CSE · 3,000 parameterized practice questions"), "gate-cse-practice-3000.txt");
    notify("The 3,000-question text pack has been downloaded.");
  };

  const exportAllQuestions = async (format: "json" | "txt") => {
    try {
      const allQuestions: Question[] = [];
      let offset = 0;
      let expectedTotal = totalQuestions;
      while (offset < expectedTotal) {
        const response = await fetch(`/api/questions?limit=500&offset=${offset}&includeAnswers=true`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Bank export failed.");
        expectedTotal = Number(data.total) || 0;
        allQuestions.push(...data.questions);
        offset += 500;
      }
      if (format === "json") downloadBlob(JSON.stringify({ exportedAt: new Date().toISOString(), questions: allQuestions }, null, 2), "gate-cse-question-bank.json", "application/json");
      else downloadBlob(formatQuestionExport(allQuestions), "gate-cse-question-bank.txt");
      notify(`${allQuestions.length.toLocaleString()} questions exported.`);
    } catch (error) { notify(error instanceof Error ? error.message : "Bank export failed."); }
  };

  const openImport = (mode: "add" | "review" = "add") => {
    setImportMode(mode);
    setImportOpen(true);
    setImportError("");
  };

  const saveDailyGoal = (value: number) => {
    const safeValue = Math.min(200, Math.max(5, value));
    setDailyTarget(safeValue);
    try { window.localStorage.setItem("ranklab-daily-goal", String(safeValue)); } catch { /* optional preference */ }
    notify(`Daily target set to ${safeValue} questions.`);
  };

  const activeQuestion = activeTest?.questions[activeIndex];
  const activeQuestionCount = activeTest?.questions.length ?? 0;
  const answeredCount = activeTest?.questions.filter((question) => {
    const value = answers[question.id];
    return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
  }).length ?? 0;
  const reviewCount = activeTest?.questions.filter((question) => marked[question.id]).length ?? 0;

  const changeQuestion = (nextIndex: number) => {
    if (!activeTest) return;
    const clamped = Math.min(Math.max(nextIndex, 0), activeTest.questions.length - 1);
    setActiveIndex(clamped);
    setVisited((current) => ({ ...current, [activeTest.questions[clamped].id]: true }));
  };

  const toggleMsqAnswer = (question: Question, option: string) => {
    setAnswers((current) => {
      const prior = Array.isArray(current[question.id]) ? current[question.id] as string[] : [];
      const next = prior.includes(option) ? prior.filter((entry) => entry !== option) : [...prior, option];
      return { ...current, [question.id]: next };
    });
  };

  const navTo = (target: PageName) => {
    setPage(target);
    setMobileNavOpen(false);
  };

  const userDayStudy = summary.totalStudySeconds ? `${Math.floor(summary.totalStudySeconds / 3600)}h ${Math.floor((summary.totalStudySeconds % 3600) / 60)}m` : "0h 00m";
  const latestAttempts = attempts.slice(0, 4);

  const renderOverview = () => (
    <div className="view-stack">
      <div className="page-intro dashboard-intro">
        <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR PERSONAL STUDY DESK</div><h1>Small sessions.<br /><span>Serious momentum.</span></h1><p className="page-description">A calmer way to work through GATE CSE — one well-understood question at a time.</p></div>
        <div className="intro-actions"><span className="date-chip"><CalendarDays size={15} />{todayLabel || "GATE 2027 · CSE"}</span><button className="button button-primary" onClick={() => openSetup()}><PlayMark /> Start a practice set <ArrowRight size={15} /></button></div>
      </div>

      <section className="dashboard-hero">
        <div className="hero-card">
          <div className="hero-grid-pattern" />
          <div className="hero-card-top"><span className="hero-kicker"><Sparkles size={13} /> A PLAN, NOT A PROMISE</span><span className="hero-tag">GATE CSE <i /> 2027</span></div>
          <div className="hero-card-content"><div><p className="hero-pretitle">YOUR NORTH STAR</p><h2>95+ is a goal.<br /><span>Practice is the plan.</span></h2><p className="hero-description">Build coverage with original practice, your PYQs and tests that feel like the real CBT.</p><button className="button button-light" onClick={() => navTo("studio")}>Shape your question engine <ArrowRight size={15} /></button></div>
            <div className="hero-target" aria-label={`${goalProgress} percent of the 13,000-question bank target`}><div className="target-ring"><svg viewBox="0 0 110 110" aria-hidden="true"><circle className="ring-track" cx="55" cy="55" r="46" /><circle className="ring-value" cx="55" cy="55" r="46" style={{ strokeDasharray: `${goalProgress * 2.89} 289` }} /></svg><div className="target-ring-label"><strong>{totalQuestions.toLocaleString()}</strong><span>IN THE BANK</span></div></div><div className="hero-target-note"><span>{QUESTION_GOAL.toLocaleString()}</span> question roadmap</div></div>
          </div>
          <div className="hero-foot"><span><Check size={13} /> Mix of your own questions + PYQs</span><span><Check size={13} /> CBT-style practice, on your system</span><span className="hero-goal-percent">{goalProgress}% of target</span></div>
        </div>
        <div className="daily-card"><div className="daily-card-top"><span className="icon-tile icon-tile-peach"><Target size={17} /></span><span className="subtle-kicker">TODAY’S TARGET</span><button className="icon-button button-on-card" title="Adjust daily target" onClick={() => { const next = window.prompt("How many questions do you want to target each day?", String(dailyTarget)); if (next && Number(next)) saveDailyGoal(Number(next)); }}><Settings2 size={16} /></button></div><div className="daily-count"><strong>{Math.min(todayCount, dailyTarget)}</strong><span> / {dailyTarget}</span><small>questions solved</small></div><div className="progress-track daily-track"><span style={{ width: `${Math.min(100, todayCount / dailyTarget * 100)}%` }} /></div><div className="daily-bottom"><span>{todayCount >= dailyTarget ? "Daily target reached — lovely work." : `${dailyTarget - todayCount} more to meet your target`}</span><button onClick={() => openSetup()}>Keep going <ArrowRight size={13} /></button></div><div className="daily-divider" /><div className="daily-mini-stats"><span><Flame size={14} />{streak} day streak</span><span><Clock3 size={14} />{userDayStudy} studied</span></div></div>
      </section>

      <section className="metric-grid">
        <MetricCard icon={BookOpen} iconColor="green" label="QUESTION BANK" value={totalQuestions.toLocaleString()} caption={`of ${QUESTION_GOAL.toLocaleString()} planned`} trend={`${goalProgress}% of your roadmap`} progress={goalProgress} onClick={() => navTo("bank")} />
        <MetricCard icon={CheckCircle2} iconColor="blue" label="QUESTIONS SOLVED" value={solvedItems.toLocaleString()} caption={`${summary.sessions} completed ${summary.sessions === 1 ? "set" : "sets"}`} trend={summary.sessions ? `+${summary.totalCorrect} correct answers` : "Your first session starts here"} onClick={() => navTo("insights")} />
        <MetricCard icon={Activity} iconColor="orange" label="YOUR ACCURACY" value={solvedItems ? `${accuracy}%` : "—"} caption={solvedItems ? "across answered questions" : "start a test to measure"} trend={solvedItems ? accuracy >= 70 ? "A strong foundation" : "Keep building consistency" : "First attempt = baseline"} onClick={() => navTo("insights")} />
        <MetricCard icon={Flame} iconColor="yellow" label="STUDY STREAK" value={String(streak).padStart(2, "0")} caption={streak === 1 ? "consecutive study day" : "consecutive study days"} trend={streak ? "Small, regular sessions add up" : "Come back tomorrow to start a streak"} onClick={() => navTo("insights")} />
      </section>

      <section className="dashboard-columns">
        <div className="panel performance-panel"><div className="panel-heading"><div><div className="section-kicker">YOUR PRACTICE, OVER TIME</div><h3>Consistency counts.</h3><p className="panel-subtitle">Questions attempted in your saved sessions.</p></div><div className="segmented-control"><button className={chartPeriod === "week" ? "selected" : ""} onClick={() => setChartPeriod("week")}>7 days</button><button className={chartPeriod === "month" ? "selected" : ""} onClick={() => setChartPeriod("month")}>4 weeks</button></div></div><div className={`activity-chart ${chartPeriod === "month" ? "chart-month" : ""}`}>{dayBars.map((day) => <div key={day.key} className={`activity-column ${day.key === todayKey ? "activity-today" : ""}`}><div className="chart-track"><span className="chart-bar" style={{ height: `${Math.max(4, day.items / maxDayItems * 100)}%` }} title={`${day.items} questions`} /></div><span className="chart-label">{day.label}</span></div>)}</div><div className="chart-foot"><span><span className="legend-dot" />Practiced questions</span><span>{summary.totalQuestions.toLocaleString()} total attempts</span></div></div>

        <div className="panel subject-panel"><div className="panel-heading"><div><div className="section-kicker">SYLLABUS COVERAGE</div><h3>A little of everything.</h3><p className="panel-subtitle">Your current bank, by subject.</p></div><button className="inline-link" onClick={() => navTo("syllabus")}>Full map <ArrowUpRight size={14} /></button></div><div className="subject-preview-list">{PLANNING_MIX.slice(0, 5).map((item, index) => { const count = questions.filter((question) => question.subject === item.subject).length; return <button className="subject-preview" key={item.subject} onClick={() => { setBankSubject(item.subject); navTo("bank"); }}><span className={`subject-mini-icon color-${index % 5}`}>{subjectInitial(item.subject)}</span><span className="subject-preview-name">{item.subject}</span><span className="subject-preview-count">{count}</span><span className="subject-preview-line"><i style={{ width: `${Math.min(100, count / Math.max(1, totalQuestions) * 100)}%` }} /></span></button>; })}</div><div className="subject-panel-note"><ShieldCheck size={14} /> Planning mix is illustrative — not an official GATE 2027 prediction.</div></div>
      </section>

      <section className="bottom-grid"><div className="panel recent-panel"><div className="panel-heading"><div><div className="section-kicker">PICK UP WHERE YOU LEFT OFF</div><h3>Recent sessions</h3></div><button className="inline-link" onClick={() => navTo("insights")}>All results <ArrowUpRight size={14} /></button></div>{latestAttempts.length ? <div className="recent-list">{latestAttempts.map((attempt) => <button className="recent-row" key={attempt.id} onClick={() => navTo("insights")}><span className="recent-status-icon"><CheckCircle2 size={15} /></span><span className="recent-row-main"><strong>{attempt.title}</strong><small>{new Date(attempt.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })} · {attempt.questionCount} questions · {formatDuration(attempt.durationSeconds)}</small></span><span className="recent-score"><strong>{attempt.score}</strong><small>/ {attempt.maximumMarks} marks</small></span><ArrowRight className="recent-arrow" size={15} /></button>)}</div> : <EmptyState icon={ListChecks} title="Your first set is waiting." text="Finish any practice set and your results will appear here." action="Start a set" onClick={() => openSetup()} />}</div>
        <div className="study-cta-card"><div className="cta-orbit cta-orbit-one" /><div className="cta-orbit cta-orbit-two" /><div className="cta-icon"><Brain size={20} /></div><span className="section-kicker">ROUND 01 · GET A BASELINE</span><h3>Try 10 original<br />starter questions.</h3><p>Work the set like a CBT. Then tell the engine what felt easy, hard or unlike GATE.</p><button className="button button-primary" onClick={() => beginTest(starterSet.length ? starterSet : questions.slice(0, 10), "practice", "Round 01 · Starter baseline")}>Start round one <ArrowRight size={15} /></button><small>Answers stay hidden until you submit.</small></div></section>
      <div className="responsible-note"><ShieldCheck size={14} /><span>Original practice items are clearly labeled. IRT values are design priors, not empirical calibration.</span><button onClick={() => navTo("insights")}>How calibration works <ArrowRight size={12} /></button></div>
    </div>
  );

  const renderPracticeLobby = () => (
    <div className="view-stack">
      <PageHeader eyebrow="THE EXAM ROOM" title={<>Practice like<br /><span>it counts.</span></>} description="A quiet, timed CBT space with a question palette, review flags and an on-screen calculator." action={<button className="button button-primary" onClick={() => openSetup()}><PlayMark /> Set up a test <ArrowRight size={15} /></button>} />
      <section className="exam-lobby-banner"><div className="exam-lobby-copy"><span className="hero-kicker"><Grid2X2 size={14} /> CBT SIMULATOR</span><h2>Same focus.<br />Your pace.</h2><p>Navigate questions, flag tricky ones, track time and submit when you’re ready. No answer key appears until the attempt is saved.</p><button className="button button-light" onClick={() => openSetup()}>Configure your test <ArrowRight size={15} /></button></div><div className="cbt-preview"><div className="cbt-preview-head"><span><i /> LIVE PREVIEW</span><span>00:29:48</span></div><div className="cbt-preview-body"><div className="cbt-preview-q"><small>QUESTION 04 <span>2 MARKS</span></small><div className="preview-lines"><i /><i /><i className="short" /></div><div className="preview-options"><i /><i /><i /></div></div><div className="cbt-preview-palette"><strong>Question palette</strong><div className="preview-dots">{Array.from({ length: 15 }, (_, index) => <i key={index} className={index < 5 ? "is-filled" : index === 6 ? "is-review" : ""}>{index + 1}</i>)}</div><span><i className="palette-green" /> Answered　<i className="palette-amber" /> Review</span></div></div></div></section>
      <section className="lobby-info-grid"><div className="panel lobby-setting-card"><div className="panel-heading"><div><div className="section-kicker">YOUR NEXT SESSION</div><h3>Choose the kind of practice.</h3></div><Settings2 size={18} className="muted-icon" /></div><div className="mode-cards"><button className="mode-card" onClick={() => { setSetupMode("practice"); openSetup(); }}><span className="mode-icon mode-icon-green"><Target size={18} /></span><span className="mode-title">Focused practice</span><span className="mode-subtitle">5–20 questions · suggested time based on marks</span><ChevronRight size={16} /></button><button className="mode-card" onClick={() => { setSetupMode("mock"); setSetupLength(65); openSetup(); }}><span className="mode-icon mode-icon-peach"><Timer size={18} /></span><span className="mode-title">Full mock exam</span><span className="mode-subtitle">65 questions · 180-minute GATE-style timer</span><ChevronRight size={16} /></button></div><div className="lobby-footnote"><ShieldCheck size={14} /> A full 65-question mock needs a larger personal bank. Your set uses only questions that exist.</div></div>
        <div className="panel session-snapshot"><div className="panel-heading"><div><div className="section-kicker">YOUR BASELINE</div><h3>Progress, not pressure.</h3></div></div><div className="snapshot-metrics"><div><strong>{summary.sessions}</strong><span>sets finished</span></div><div><strong>{solvedItems}</strong><span>answered</span></div><div><strong>{solvedItems ? `${accuracy}%` : "—"}</strong><span>your accuracy</span></div></div><div className="snapshot-note">{summary.sessions ? "Your past attempts are saved automatically for review." : "After your first session, you’ll see a score, answer review and topic-by-topic patterns."}</div></div></section>
      <div className="section-heading-row"><div><span className="section-kicker">RECENT PRACTICE</span><h3>Sessions, saved for later.</h3></div><button className="inline-link" onClick={() => navTo("insights")}>View calibration lab <ArrowUpRight size={14} /></button></div>
      {latestAttempts.length ? <div className="session-table">{latestAttempts.map((attempt) => <button className="session-table-row" key={attempt.id} onClick={() => navTo("insights")}><span className="session-kind-dot" /><span className="session-table-title"><strong>{attempt.title}</strong><small>{new Date(attempt.createdAt).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></span><span>{attempt.questionCount} items</span><span>{attempt.correctCount} correct</span><strong>{attempt.score}/{attempt.maximumMarks}</strong><ArrowUpRight size={15} /></button>)}</div> : <EmptyState icon={Clock3} title="No completed sessions yet." text="Your tests are saved here after you submit them." />}
    </div>
  );

  const renderBank = () => (
    <div className="view-stack">
      <PageHeader eyebrow="ONE BANK · YOUR RULES" title={<>The question<br /><span>collection.</span></>} description="Browse, search, review and shape a private bank from your own work, imported material and generated practice." action={<><button className="button button-outline" onClick={() => openImport()}><Upload size={15} /> Import questions</button><button className="button button-primary" onClick={() => { setDraft(EMPTY_DRAFT); setCreateOpen(true); }}><Plus size={16} /> Add a question</button></>} />
      <section className="bank-summary-strip"><div className="bank-summary-primary"><div className="bank-summary-icon"><BookOpen size={18} /></div><div><strong>{totalQuestions.toLocaleString()}</strong><span>questions in your bank</span></div></div><div className="bank-stat"><span>MCQ</span><strong>{questions.filter((question) => question.type === "MCQ").length}</strong></div><div className="bank-stat"><span>MSQ</span><strong>{questions.filter((question) => question.type === "MSQ").length}</strong></div><div className="bank-stat"><span>NAT</span><strong>{questions.filter((question) => question.type === "NAT").length}</strong></div><button className="bank-summary-export" onClick={() => void exportAllQuestions("json")}><Download size={14} /> Export bank</button></section>
      <section className="panel bank-panel"><div className="bank-toolbar"><div className="bank-search"><Search size={16} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search concepts, topics or question text..." aria-label="Search question bank" />{searchText && <button onClick={() => setSearchText("")} aria-label="Clear search"><X size={14} /></button>}</div><div className="bank-filters"><label className="select-wrap"><Filter size={13} /><select value={bankSubject} onChange={(event) => setBankSubject(event.target.value)} aria-label="Filter by subject"><option>All subjects</option>{[...new Set(questions.map((question) => question.subject))].sort().map((subject) => <option key={subject}>{subject}</option>)}</select><ChevronDown size={13} /></label><label className="select-wrap"><select value={bankFormat} onChange={(event) => setBankFormat(event.target.value)} aria-label="Filter by question type"><option>All formats</option><option>MCQ</option><option>MSQ</option><option>NAT</option></select><ChevronDown size={13} /></label><button className={`filter-chip ${lowQuestionsOnly ? "active" : ""}`} onClick={() => setLowQuestionsOnly((value) => !value)}><Flag size={13} /> Stretch</button></div></div>
        <div className="bank-results-label"><span>{filteredQuestions.length} shown <i>·</i> {totalQuestions.toLocaleString()} total</span><span><ShieldCheck size={13} /> Answers reveal only in review</span></div>
        {loading ? <LoadingBlock label="Opening your question bank…" /> : filteredQuestions.length ? <div className="question-list">{filteredQuestions.slice(0, 60).map((question) => <button className="question-row" key={question.id} onClick={() => void openQuestionPreview(question)}><span className={`q-format-badge format-${question.type.toLowerCase()}`}>{question.type}</span><span className="question-row-main"><span className="question-row-meta">{question.subject} <i>·</i> {question.topic}</span><strong>{question.question}</strong><span className="question-row-source"><span className="source-bullet" />{question.source}</span></span><span className="question-row-difficulty"><b className={`difficulty-mark difficulty-${difficultyLabel(question.difficulty).toLowerCase()}`} />{difficultyLabel(question.difficulty)}</span><span className="question-row-marks">{question.marks} <small>mark{question.marks === 1 ? "" : "s"}</small></span><ChevronRight className="question-row-arrow" size={16} /></button>)}</div> : <EmptyState icon={Search} title="Nothing matches that search." text="Try another subject or add an item to your bank." action="Clear filters" onClick={() => { setSearchText(""); setBankSubject("All subjects"); setBankFormat("All formats"); setLowQuestionsOnly(false); }} />}
        {filteredQuestions.length > 60 && <div className="bank-list-more">Showing the first 60 matching items. Refine the filters to browse further.</div>}
        <div className="bank-footer-note"><ShieldCheck size={14} /> The starter set is original practice. Add your own PYQs and cite the year/source when you know it.</div>
      </section>
      <section className="bank-bottom-actions"><div><span className="section-kicker">HAVE YOUR OWN PDF OR QUESTION SET?</span><strong>Bring it into your study flow.</strong><span>Text-searchable PDFs can be extracted in your browser; scanned PDFs need OCR first.</span></div><button className="button button-primary" onClick={() => openImport()}><CloudUpload size={16} /> Import a file <ArrowRight size={14} /></button></section>
    </div>
  );

  const renderStudio = () => (
    <div className="view-stack">
      <PageHeader eyebrow="ROUND BY ROUND · YOUR QUESTION ENGINE" title={<>Build it to<br /><span>think like you.</span></>} description="Write your own questions, bring in two decades of PDFs and use the response data you actually have — not made-up calibration." action={<button className="button button-primary" onClick={() => { setDraft(EMPTY_DRAFT); setCreateOpen(true); }}><Plus size={16} /> Draft a question</button>} />
      <section className="studio-banner"><div className="studio-banner-copy"><span className="hero-kicker"><Sparkles size={13} /> QUESTION STUDIO</span><h2>Set an intention.<br /><span>Then test the question.</span></h2><p>Psychometric labels are useful design targets — empirical difficulty and discrimination only come after candidates have answered the items.</p><div className="studio-banner-actions"><button className="button button-light" onClick={() => { setDraft(EMPTY_DRAFT); setCreateOpen(true); }}><Plus size={15} /> Create one</button><button className="button button-glass" onClick={() => openImport()}><Upload size={14} /> Import your PYQs</button></div></div><div className="studio-steps-art"><div className="studio-art-circle"><Brain size={32} /></div><span className="studio-art-tag">DESIGN → SOLVE → LEARN</span><div className="studio-spark spark-a">✳</div><div className="studio-spark spark-b">✳</div></div></section>
      <div className="studio-columns"><div className="studio-rounds panel"><div className="panel-heading"><div><div className="section-kicker">YOUR PERSONALIZED LOOP</div><h3>Five rounds. Better items.</h3></div><span className="round-progress-badge">ROUND 01</span></div><div className="round-list">{[
        { number: "01", title: "Draft 10 original questions", desc: "Start with the cross-syllabus seed set, or add your own with a worked key.", icon: FileText, status: "Ready", action: () => beginTest(starterSet.length ? starterSet : questions.slice(0, 10), "practice", "Round 01 · Starter baseline") },
        { number: "02", title: "Solve before revealing", desc: "Use the CBT room. Flag anything that felt too obvious, too hard or unclear.", icon: Grid2X2, status: summary.sessions ? `${summary.sessions} set${summary.sessions === 1 ? "" : "s"}` : "Next", action: () => openSetup() },
        { number: "03", title: "Calibrate with responses", desc: "Update estimated b, a and c only after a meaningful candidate sample.", icon: Activity, status: "Needs data", action: () => navTo("insights") },
        { number: "04", title: "Compare with your PYQs", desc: "Import your PDF, verify the source and annotate style differences.", icon: BookOpen, status: totalQuestions > 10 ? "In progress" : "Your PDFs", action: () => openImport("review") },
        { number: "05", title: "Keep what works", desc: "Review explanations and tune your bank to the concepts you miss.", icon: Sparkles, status: "Ongoing", action: () => navTo("bank") },
      ].map((round, index) => <button className={`round-row ${index === 0 ? "round-row-active" : ""}`} key={round.number} onClick={round.action}><span className="round-number">{round.number}</span><span className="round-row-icon"><round.icon size={16} /></span><span className="round-row-copy"><strong>{round.title}</strong><small>{round.desc}</small></span><span className={`round-status ${index === 0 ? "round-status-ready" : ""}`}>{round.status}</span><ArrowRight className="round-arrow" size={15} /></button>)}</div></div>
        <div className="studio-side-stack"><div className="panel pack-card"><div className="pack-icon"><Layers size={19} /></div><div className="section-kicker">OPTIONAL · RULE-BASED PRACTICE</div><h3>3,000-item<br />practice pack.</h3><p>Parameter variants in 15 worked templates: stacks, subnetting, scheduling, automata, recurrences and more.</p><div className="pack-honesty"><ShieldCheck size={14} /> Not PYQs. Not an IIT Madras prediction. Template-based items need your own review.</div>{packMessage && <div className={`pack-message ${packMessage.includes("new") || packMessage.includes("added") ? "pack-message-good" : ""}`}>{packMessage}</div>}<button className="button button-primary pack-add-button" onClick={() => void generatePack()} disabled={packBusy}>{packBusy ? <><LoaderCircle size={15} className="spin-icon" /> Preparing your pack</> : <><Database size={15} /> Add all 3,000 to my bank <ArrowRight size={14} /></>}</button><button className="pack-download-link" onClick={downloadGeneratedPack}><Download size={14} /> Download the .txt question pack</button><small className="pack-note">Stable keys prevent accidental duplicate imports. Solutions + common mistakes included.</small></div>
          <div className="panel export-card"><div className="export-card-icon"><ArrowDownToLine size={17} /></div><div><strong>Your bank, your file.</strong><p>Take the questions and worked solutions with you as JSON or a readable text export.</p></div><div className="export-card-actions"><button onClick={() => void exportAllQuestions("json")}><FileText size={14} /> Export JSON</button><button onClick={() => void exportAllQuestions("txt")}><Download size={14} /> Export .txt</button></div></div></div></div>
      <section className="panel psychometric-principles"><div className="psychometric-heading"><div><div className="section-kicker">DESIGN TARGETS · ESTIMATES ARE NOT DATA</div><h3>What a useful question is trying to do.</h3></div><button className="inline-link" onClick={() => navTo("insights")}>See the data rules <ArrowRight size={13} /></button></div><div className="principle-grid"><PrincipleCard code="b" title="Difficulty" value="0.3 easy · 0.7 mid · 1.1 stretch" note="Author-set IRT-style prior; observed p comes from real responses." tone="green" /><PrincipleCard code="a" title="Discrimination" value="a > 1.0 target" note="A design goal only. D and point-biserial need a representative cohort." tone="blue" /><PrincipleCard code="c" title="Guessing" value="MCQ .25 · MSQ .03 · NAT 0" note="Starting assumptions for four-option items; edit when item format changes." tone="peach" /><PrincipleCard code="r" title="Reliability" value="KR-20 > .85 target" note="Measure only across a valid multi-item test with a real response sample." tone="yellow" /></div><div className="psychometric-foot"><span><Clock3 size={13} />Suggested time: 1.5 min for 1 mark · 3 min for 2 marks.</span><span><Brain size={13} />Bloom levels 3–5: apply · analyze · evaluate.</span></div></section>
    </div>
  );

  const itemPerformance = useMemo(() => {
    const performance = new Map<string, { attempts: number; correct: number }>();
    for (const attempt of attempts) {
      for (const response of attempt.responses ?? []) {
        const current = performance.get(response.questionId) ?? { attempts: 0, correct: 0 };
        current.attempts += 1;
        if (response.correct) current.correct += 1;
        performance.set(response.questionId, current);
      }
    }
    return performance;
  }, [attempts]);

  const renderInsights = () => (
    <div className="view-stack">
      <PageHeader eyebrow="HONEST DATA · USEFUL NEXT STEPS" title={<>Calibration<br /><span>takes evidence.</span></>} description="See your own response patterns. Cohort-level psychometrics stay marked as unavailable until you actually have a candidate sample." action={<button className="button button-outline" onClick={() => void exportAllQuestions("txt")}><Download size={15} /> Export review file</button>} />
      <section className="calibration-summary"><div className="calibration-summary-copy"><span className="hero-kicker"><Activity size={14} /> WHAT YOUR DATA SAYS</span><h2>{summary.sessions ? `${summary.sessions} session${summary.sessions === 1 ? "" : "s"}.` : "First, get a baseline."}<br /><span>{solvedItems ? `${accuracy}% your accuracy.` : "No invented benchmarks."}</span></h2><p>{solvedItems ? "This is a personal practice pattern, not a comparison against other candidates." : "Solve your own set to begin recording item-level responses. The metrics only become useful with honest input."}</p><button className="button button-light" onClick={() => openSetup()}>{summary.sessions ? "Continue practicing" : "Start a baseline set"} <ArrowRight size={14} /></button></div><div className="calibration-mini-stats"><div><strong>{summary.sessions}</strong><span>saved sessions</span></div><div><strong>{solvedItems}</strong><span>answered by you</span></div><div><strong>{itemPerformance.size}</strong><span>items with a response</span></div></div></section>
      <section className="formula-grid"><FormulaCard number="01" title="Item difficulty · p" formula="p = correct ÷ attempted" value={`${itemPerformance.size} items tracked`} note="Personal accuracy only. GATE item analysis uses a candidate cohort; one learner’s history is not a candidate distribution." icon={Target} tone="green" /><FormulaCard number="02" title="Discrimination · D" formula="D = pᵤₚₚₑᵣ − pₗₒwₑᵣ" value="Not estimable yet" note="Requires identified upper/lower groups (e.g. top and bottom 27%) on the same item. Do not infer this from one person." icon={Activity} tone="blue" /><FormulaCard number="03" title="Point-biserial · rₚᵦ" formula="(M₁ − M₀) / S × √(p × q)" value="Cohort data required" note="Needs total-test scores plus dichotomous item responses from a valid candidate sample." icon={BarChart3} tone="peach" /><FormulaCard number="04" title="Reliability · KR-20" formula="k/(k−1) × [1 − Σ(pᵢqᵢ)/S²]" value="A 65-item mock needs a cohort" note="KR-20 is a test-level estimate across examinees — not a score a local practice account can honestly supply." icon={ShieldCheck} tone="yellow" /></section>
      <section className="panel item-stats-panel"><div className="panel-heading"><div><div className="section-kicker">ITEM REVIEW · YOUR SAVED ANSWERS</div><h3>Which questions need a second look?</h3><p className="panel-subtitle">Empirical p is based only on your answers. The a, b and c columns are author-set priors.</p></div><button className="inline-link" onClick={() => navTo("bank")}>Open bank <ArrowRight size={13} /></button></div>{questions.filter((question) => itemPerformance.has(question.id)).length ? <div className="item-stats-list"><div className="item-stats-head"><span>ITEM / TOPIC</span><span>YOUR p · n</span><span>DESIGN a / b / c</span><span>REVIEW</span></div>{questions.filter((question) => itemPerformance.has(question.id)).slice(0, 15).map((question) => { const perf = itemPerformance.get(question.id)!; const rate = perf.attempts ? Math.round(perf.correct / perf.attempts * 100) : 0; return <button className="item-stats-row" key={question.id} onClick={() => void openQuestionPreview(question)}><span><strong>{question.topic}</strong><small>{question.subject} · {question.type}</small></span><span><strong>{rate}%</strong><small>{perf.attempts} of your attempts correct</small></span><span><strong>a {question.discrimination.toFixed(2)} · b {question.difficulty.toFixed(2)}</strong><small>c {question.guessing.toFixed(2)} · design prior</small></span><span className={`metric-observation ${perf.attempts < 30 ? "observation-low" : ""}`}>{perf.attempts < 30 ? "Small sample" : "Personal only"}</span></button>; })}</div> : <EmptyState icon={Activity} title="No item-level data yet." text="Submit a practice set and you’ll see which items you personally answered correctly." action="Start a set" onClick={() => openSetup()} />}<div className="calibration-caveat"><ShieldCheck size={15} /><span>Empirical b/a/c, top-vs-bottom D and KR-20 are not claimed from these data. A sample warning is not a quality verdict.</span></div></section>
      <div className="panel methodology-note"><div className="methodology-icon"><ShieldCheck size={19} /></div><div><span className="section-kicker">A NOTE ON 2027</span><strong>Use the official GATE 2027 syllabus and notification as the source of truth.</strong><p>These planning weights, original questions and IRT priors are a personal practice scaffold — not an IIT Madras endorsement, exam leak, or prediction of the final paper.</p></div></div>
    </div>
  );

  const renderSyllabus = () => (
    <div className="view-stack">
      <PageHeader eyebrow="MAP THE WORK · ADJUST AS YOU LEARN" title={<>Whole syllabus.<br /><span>Small clear steps.</span></>} description="Use this as a planning checklist, not a claim about what the 2027 paper will contain. Confirm every topic against the official notice." action={<button className="button button-primary" onClick={() => { setDraft(EMPTY_DRAFT); setCreateOpen(true); }}><Plus size={16} /> Write a question</button>} />
      <section className="syllabus-hero"><div><span className="hero-kicker"><GraduationCap size={15} /> GATE CSE PREP MAP</span><h2>Coverage comes before<br />cramming.</h2><p>The bank currently covers {new Set(questions.map((question) => question.subject)).size} of {SUBJECTS.length} planning buckets. Keep gaps visible; import your own questions as you fill them.</p></div><div className="syllabus-overall"><span>BANK COVERAGE</span><strong>{totalQuestions.toLocaleString()}<i> / {QUESTION_GOAL.toLocaleString()}</i></strong><div className="progress-track"><span style={{ width: `${goalProgress}%` }} /></div><small>{goalProgress}% of your question goal</small></div></section>
      <div className="syllabus-heading-row"><div><span className="section-kicker">ILLUSTRATIVE STUDY MIX</span><h3>Plan across the whole paper.</h3></div><span className="planning-disclaimer"><ShieldCheck size={13} /> Not a 2027 marks prediction</span></div>
      <section className="syllabus-grid">{PLANNING_MIX.map((item, index) => { const subjectQuestions = questions.filter((question) => question.subject === item.subject); const attempted = subjectQuestions.reduce((total, question) => total + (itemPerformance.get(question.id)?.attempts ?? 0), 0); const solvedHere = subjectQuestions.reduce((total, question) => total + (itemPerformance.get(question.id)?.correct ?? 0), 0); return <button key={item.subject} className="syllabus-card" onClick={() => { setBankSubject(item.subject); navTo("bank"); }}><div className="syllabus-card-head"><span className={`subject-mini-icon color-${index % 5}`}>{subjectInitial(item.subject)}</span><span className="syllabus-weight">~{item.share}<i>%</i> planning</span></div><strong className="syllabus-subject-name">{item.subject}</strong><span className="syllabus-subject-note">{item.note}</span><div className="syllabus-card-stats"><span><BookOpen size={13} /> {subjectQuestions.length} in your bank</span><span>{attempted ? `${solvedHere}/${attempted} correct` : "Not attempted yet"}</span></div><div className="progress-track syllabus-progress"><span className={`syllabus-color-${index % 5}`} style={{ width: `${Math.min(100, subjectQuestions.length / Math.max(1, totalQuestions) * 100)}%` }} /></div><span className="syllabus-card-link">Explore this subject <ArrowRight size={13} /></span></button>; })}</section>
      <section className="syllabus-note"><div className="syllabus-note-icon"><CalendarDays size={18} /></div><div><strong>Verify official syllabus updates before your next full mock.</strong><span>Question weights on this page are a revision-planning illustration only. They can change and do not represent an official GATE 2027 distribution.</span></div><button className="button button-outline" onClick={() => openImport("review")}>Bring in PYQs <Upload size={14} /></button></section>
    </div>
  );

  const renderResult = () => {
    if (!result) return <EmptyState icon={Trophy} title="No result selected." text="Finish a timed practice set to see your score and item review." action="Start a set" onClick={() => openSetup()} />;
    const { attempt, questions: resultQuestions, responses } = result;
    const responseMap = new Map(responses.map((response) => [response.questionId, response]));
    const resultQuestionsWithMisses = resultQuestions.filter((question) => !responseMap.get(question.id)?.correct);
    const scoreWidth = attempt.maximumMarks ? Math.max(0, Math.min(100, attempt.score / attempt.maximumMarks * 100)) : 0;
    return <div className="view-stack results-view"><div className="result-topline"><button className="back-link" onClick={() => navTo("overview")}><ArrowLeft size={15} /> Back to your desk</button><span className="date-chip"><CheckCircle2 size={15} /> SESSION SAVED</span></div><section className="result-hero"><div className="result-hero-copy"><span className="hero-kicker"><Trophy size={14} /> {attempt.title}</span><h1>One more step<br />closer.</h1><p>Here’s what happened in your {attempt.mode === "mock" ? "mock" : "practice"} session. Review the reasoning; the score is a snapshot, not a prediction.</p><div className="result-progress-line"><span style={{ width: `${scoreWidth}%` }} /></div><small>{attempt.questionCount} questions · {formatDuration(attempt.durationSeconds)} · {attempt.maximumMarks} available marks</small></div><div className="result-score-display"><span>SESSION SCORE</span><strong>{attempt.score}<i> / {attempt.maximumMarks}</i></strong><div className="result-grade-label">{attempt.accuracy}% personal accuracy</div><span className="score-divider" /><div className="result-mini-row"><span><CheckCircle2 size={13} />{attempt.correctCount} correct</span><span><XCircle size={13} />{attempt.wrongCount} incorrect</span><span><Minus size={13} />{attempt.unansweredCount} skipped</span></div></div></section>
      <section className="result-stat-grid"><MetricCard icon={CheckCircle2} iconColor="green" label="CORRECT" value={String(attempt.correctCount)} caption="answers matched" /><MetricCard icon={XCircle} iconColor="orange" label="INCORRECT" value={String(attempt.wrongCount)} caption="worth a careful review" /><MetricCard icon={Bookmark} iconColor="blue" label="FLAGGED" value={String(responses.filter((response) => response.markedForReview).length)} caption="saved for another look" /><MetricCard icon={Clock3} iconColor="yellow" label="TIME USED" value={formatDuration(attempt.durationSeconds)} caption="focused work" /></section>
      <section className="panel answer-review-panel"><div className="panel-heading"><div><div className="section-kicker">ANSWER REVIEW · WORK THE WHY</div><h3>Every question, explained.</h3><p className="panel-subtitle">Correct keys are revealed after your attempt has been saved.</p></div><button className="inline-link" onClick={() => void exportAllQuestions("txt")}><Download size={14} /> Export bank</button></div><div className="review-question-list">{resultQuestions.map((question, index) => { const response = responseMap.get(question.id); return <ReviewItem key={question.id} question={question} response={response} index={index + 1} attemptId={attempt.id} />; })}</div></section>
      <div className="result-bottom-actions"><button className="button button-outline" onClick={() => navTo("insights")}><BarChart3 size={15} /> Open calibration lab</button><button className="button button-primary" onClick={() => beginTest(resultQuestionsWithMisses, "practice", `Targeted review · ${resultQuestionsWithMisses.length} items`)} disabled={!resultQuestionsWithMisses.length}><RotateCcw size={15} /> Practice missed questions <ArrowRight size={15} /></button></div></div>;
  };

  const renderCBT = () => {
    if (!activeTest || !activeQuestion) return null;
    const response = answers[activeQuestion.id] ?? (activeQuestion.type === "MSQ" ? [] : "");
    const hasResponse = Array.isArray(response) ? response.length > 0 : Boolean(response.trim());
    const progress = (activeIndex + 1) / activeTest.questions.length * 100;
    const timerWarning = secondsLeft < 300;
    const selectedSubjectName = activeQuestion.subject;
    return <div className="cbt-fullscreen"><header className="cbt-topbar"><div className="cbt-brand"><button className="cbt-exit-icon" aria-label="Return to your study desk" onClick={() => setConfirmSubmit(true)}><ArrowLeft size={18} /></button><span className="cbt-brand-seal"><Code2 size={17} /></span><span><strong>ranklab<span>/</span>cse</strong><small>GATE 2027 · COMPUTER SCIENCE</small></span></div><div className="cbt-top-meta"><span className="cbt-mode-label"><i /> {activeTest.mode === "mock" ? "MOCK TEST" : "PRACTICE SESSION"}</span><span className="cbt-top-divider" /><span className={`cbt-clock ${timerWarning ? "timer-warning" : ""}`}><Timer size={16} /><span>{formatDuration(secondsLeft)}</span></span><button className="cbt-calculator-button" onClick={() => setCalculatorOpen(true)}><CalculatorIcon size={15} /> Calculator</button><button className="cbt-submit-top" onClick={() => setConfirmSubmit(true)}>Submit test <ArrowRight size={14} /></button></div></header>
      <div className="cbt-subbar"><span>{activeTest.title}</span><div className="cbt-subbar-right"><span><i /> SAVED LOCALLY</span><span>Standard GATE-style negative marking for MCQ</span></div></div>
      <div className="cbt-page-progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="cbt-workspace"><main className="cbt-question-area"><div className="cbt-question-heading"><div><div className="cbt-eyebrow">{selectedSubjectName.toUpperCase()} <i>·</i> {activeQuestion.topic.toUpperCase()}</div><h1>Question <span>{String(activeIndex + 1).padStart(2, "0")}</span><small> / {String(activeQuestionCount).padStart(2, "0")}</small></h1></div><div className="cbt-question-tags"><span className={`q-format-badge format-${activeQuestion.type.toLowerCase()}`}>{activeQuestion.type}</span><span className="cbt-marks-pill">{activeQuestion.marks} mark{activeQuestion.marks === 1 ? "" : "s"}</span><span className={`difficulty-pill difficulty-${difficultyLabel(activeQuestion.difficulty).toLowerCase()}`}><i />{difficultyLabel(activeQuestion.difficulty)}</span></div></div>
      <div className="cbt-question-card"><div className="cbt-q-card-top"><span>QUESTION {activeIndex + 1} <i>·</i> {activeQuestion.type === "MSQ" ? "SELECT ALL THAT APPLY" : activeQuestion.type === "NAT" ? "NUMERICAL ANSWER" : "SELECT ONE OPTION"}</span><span><Clock3 size={13} /> {activeQuestion.estimatedSeconds}s suggested</span></div><div className="cbt-question-text">{activeQuestion.question}</div>
      {activeQuestion.type === "NAT" ? <div className="nat-input-block"><label htmlFor="nat-answer">Your numerical answer</label><input id="nat-answer" type="text" inputMode="decimal" autoComplete="off" value={Array.isArray(response) ? "" : response} onChange={(event) => setAnswers((current) => ({ ...current, [activeQuestion.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") changeQuestion(activeIndex + 1); }} placeholder="Enter a numeric value" /><small>Use a decimal point if needed. Tolerance is checked on submission.</small></div> : <div className="cbt-options-list">{activeQuestion.options.map((option, optionIndex) => { const chosen = Array.isArray(response) ? response.includes(option) : response === option; return <button key={`${option}-${optionIndex}`} className={`cbt-option ${chosen ? "cbt-option-selected" : ""}`} onClick={() => activeQuestion.type === "MSQ" ? toggleMsqAnswer(activeQuestion, option) : setAnswers((current) => ({ ...current, [activeQuestion.id]: option }))}><span className={`option-selector ${activeQuestion.type === "MSQ" ? "option-checkbox" : ""} ${chosen ? "selected" : ""}`}>{chosen && <Check size={13} />}</span><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span className="option-copy">{option}</span></button>; })}</div>}
      <div className="cbt-hint-strip"><Brain size={15} /><span>{activeQuestion.type === "MSQ" ? "MSQ: Select every correct option. Partial selections are not scored as correct in this version." : activeQuestion.type === "MCQ" ? "MCQ: 1-mark wrong answers carry −1/3; 2-mark wrong answers carry −2/3." : "NAT: No guessing penalty. Enter your value, then review it before you submit."}</span></div></div>
      <div className="cbt-question-tools"><button className={`cbt-review-toggle ${marked[activeQuestion.id] ? "is-marked" : ""}`} onClick={() => setMarked((current) => ({ ...current, [activeQuestion.id]: !current[activeQuestion.id] }))}><Bookmark size={15} fill={marked[activeQuestion.id] ? "currentColor" : "none"} />{marked[activeQuestion.id] ? "Marked for review" : "Mark for review"}</button><button className="cbt-clear-response" onClick={() => { setAnswers((current) => { const next = { ...current }; delete next[activeQuestion.id]; return next; }); }}>Clear response</button></div>
      <div className="cbt-nav-row"><button className="cbt-nav-button cbt-previous" onClick={() => changeQuestion(activeIndex - 1)} disabled={activeIndex === 0}><ArrowLeft size={15} /> Previous</button><span className="cbt-save-label"><CheckCircle2 size={14} /> Your answer is saved as you go</span><button className="cbt-nav-button cbt-next" onClick={() => changeQuestion(activeIndex + 1)} disabled={activeIndex === activeQuestionCount - 1}>{hasResponse ? "Save & next" : "Next question"} <ArrowRight size={15} /></button></div>
      <div className="cbt-mobile-palette"><span><i className="palette-green" />{answeredCount} answered</span><button onClick={() => document.querySelector(".cbt-palette-panel")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Open question palette <ChevronDown size={14} /></button></div></main>
      <aside className="cbt-aside"><div className="cbt-aside-heading"><div><span className="section-kicker">NAVIGATE</span><h3>Question palette</h3></div><span className="cbt-completion"><strong>{answeredCount}</strong>/{activeQuestionCount}</span></div><div className="cbt-palette-panel"><div className="cbt-palette-grid">{activeTest.questions.map((question, index) => { const savedAnswer = answers[question.id]; const isAnswered = Array.isArray(savedAnswer) ? savedAnswer.length > 0 : Boolean(savedAnswer?.trim()); const state = marked[question.id] ? "review" : isAnswered ? "answered" : visited[question.id] ? "visited" : "unvisited"; return <button key={question.id} className={`cbt-palette-number palette-${state} ${index === activeIndex ? "palette-current" : ""}`} onClick={() => changeQuestion(index)} title={`Question ${index + 1}${marked[question.id] ? " · marked for review" : isAnswered ? " · answered" : " · not answered"}`}>{index + 1}</button>; })}</div><div className="cbt-legend-grid"><span><i className="legend-green" />Answered ({answeredCount})</span><span><i className="legend-lilac" />Marked ({reviewCount})</span><span><i className="legend-outline" />Not visited</span><span><i className="legend-grey" />Visited / blank</span></div></div><div className="cbt-session-progress"><div className="cbt-progress-head"><span>YOUR PROGRESS</span><strong>{Math.round(answeredCount / activeQuestionCount * 100)}%</strong></div><div className="progress-track"><span style={{ width: `${answeredCount / activeQuestionCount * 100}%` }} /></div><small>{answeredCount} answered · {reviewCount} marked · {activeQuestionCount - answeredCount} unanswered</small></div><div className="cbt-end-card"><div className="cbt-end-top"><span className="icon-tile icon-tile-peach"><Flag size={15} /></span><span>WHEN YOU’RE READY</span></div><strong>Review once.<br />Submit with intent.</strong><p>You can return to any question before the timer runs out.</p><button className="cbt-end-button" onClick={() => setConfirmSubmit(true)}>Review & submit <ArrowRight size={14} /></button></div><div className="cbt-aside-assurance"><ShieldCheck size={14} /> Score saved to your study history.</div></aside></div>
    </div>;
  };

  return <>
    <div className={`app-shell ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className="sidebar"><div className="brand-lockup"><div className="brand-symbol"><span /><span /><span /></div><div><strong>ranklab<span>/</span>cse</strong><small>YOUR GATE STUDY DESK</small></div><button className="sidebar-close icon-button" aria-label="Close sidebar" onClick={() => setMobileNavOpen(false)}><X size={17} /></button></div><div className="sidebar-exam-tag"><span className="sidebar-exam-icon"><Code2 size={15} /></span><span><strong>GATE 2027</strong><small>COMPUTER SCIENCE</small></span><ChevronDown size={14} /></div><div className="sidebar-nav-label">STUDY SPACE</div><nav className="sidebar-nav">{NAV_ITEMS.map((item, index) => <button key={item.id} className={`nav-item ${page === item.id || (page === "results" && item.id === "insights") ? "nav-item-active" : ""} ${item.id === "studio" ? "nav-item-studio" : ""}`} onClick={() => navTo(item.id)}><item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === "bank" && <span className="nav-count">{totalQuestions > 99 ? `${Math.floor(totalQuestions / 100) / 10}k` : totalQuestions}</span>}{item.id === "studio" && index === 3 && <span className="nav-spark"><Sparkles size={12} /></span>}</button>)}</nav><div className="sidebar-guide"><span className="guide-stroke" /><div className="sidebar-guide-copy"><span className="sidebar-guide-label">THE 13K QUESTION PLAN</span><div className="sidebar-guide-track"><i style={{ width: `${goalProgress}%` }} /></div><div className="sidebar-guide-stats"><strong>{totalQuestions.toLocaleString()}</strong><span>/ {QUESTION_GOAL.toLocaleString()}</span><button onClick={() => navTo("studio")}><ArrowUpRight size={13} /></button></div></div></div><div className="sidebar-bottom"><div className="sidebar-privacy"><span className="privacy-icon"><ShieldCheck size={14} /></span><span><strong>YOUR OWN WORKSPACE</strong><small>Practice data saves to your database.</small></span></div><div className="sidebar-bottom-brand"><span>Made for the long run.</span><span className="brand-dotmark">r.</span></div></div></aside>
      <div className="app-main"><header className="topbar"><div className="topbar-left"><button className="mobile-menu-button icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button><span className="topbar-breadcrumb">My workspace <ChevronRight size={13} /> <strong>{page === "results" ? "Test review" : NAV_ITEMS.find((item) => item.id === page)?.label ?? "Overview"}</strong></span></div><div className="topbar-right"><span className="local-badge"><span /> LOCAL STUDY SPACE</span><span className="topbar-divider" /><button className="topbar-calculator" onClick={() => setCalculatorOpen(true)}><CalculatorIcon size={15} /><span>Calculator</span></button><button className="topbar-avatar" title="GATE CSE aspirant"><GraduationCap size={16} /></button></div></header><main className={`app-content ${activeTest ? "app-content-exam" : ""}`}>{activeTest ? renderCBT() : page === "overview" ? renderOverview() : page === "practice" ? renderPracticeLobby() : page === "bank" ? renderBank() : page === "studio" ? renderStudio() : page === "insights" ? renderInsights() : page === "syllabus" ? renderSyllabus() : renderResult()}</main><footer className="app-footer"><span><span className="footer-dot" /> PRIVATE PRACTICE DESK</span><span>GATE® is an examination of the organizing institutes. This independent study tool is not affiliated with or endorsed by them.</span></footer></div>
    </div>

    {loading && !questions.length && <div className="loading-cover"><LoaderCircle className="spin-icon" size={19} /><span>Connecting your private question bank…</span></div>}

    {setupOpen && <ModalShell onClose={() => setSetupOpen(false)} size="setup-modal"><div className="modal-heading-row"><span className="modal-icon modal-icon-green"><Settings2 size={19} /></span><button className="icon-button" aria-label="Close test setup" onClick={() => setSetupOpen(false)}><X size={18} /></button></div><span className="section-kicker">BUILD YOUR NEXT SESSION</span><h2 className="modal-title">Set the room.<br /><span>Then focus.</span></h2><p className="modal-intro">Your question pool includes {questions.length} of {totalQuestions.toLocaleString()} questions currently loaded. Answers stay hidden until submission.</p><div className="setup-section"><label className="field-label">QUESTION COUNT</label><div className="length-picker">{[5, 10, 20, 65].map((length) => <button key={length} className={setupLength === length ? "length-selected" : ""} onClick={() => setSetupLength(length)}><strong>{length}</strong><small>{length === 65 ? "full mock" : length === 5 ? "quick" : "questions"}</small></button>)}</div><small className="setup-field-hint">You can start with fewer questions than selected when a filter limits the available pool.</small></div><div className="setup-row-fields"><label className="field-control"><span className="field-label">SUBJECT</span><span className="field-select"><select value={setupSubject} onChange={(event) => setSetupSubject(event.target.value)}><option>All subjects</option>{[...new Set(questions.map((question) => question.subject))].sort().map((subject) => <option key={subject}>{subject}</option>)}</select><ChevronDown size={14} /></span></label><div className="field-control"><span className="field-label">EXAM FEEL</span><div className="mode-toggle"><button className={setupMode === "practice" ? "active" : ""} onClick={() => setSetupMode("practice")}>Practice</button><button className={setupMode === "mock" ? "active" : ""} onClick={() => setSetupMode("mock")}>Mock</button></div></div></div><div className="setup-duration"><Clock3 size={16} /><div><strong>{setupMode === "mock" ? "Up to 180 minutes" : "Suggested time based on marks"}</strong><span>{setupMode === "mock" ? "A full 65-question paper uses the classic three-hour GATE timer. Shorter pools are scaled." : "1-mark questions: ~1.5 min · 2-mark questions: ~3 min"}</span></div></div><div className="setup-warning"><ShieldCheck size={15} /><span>{setupMode === "mock" ? "Unanswered questions score 0. MCQ wrong-answer penalties follow GATE-style marking." : "Your score is a practice snapshot, not a prediction of exam-day marks."}</span></div><button className="button button-primary setup-start-button" onClick={startConfiguredTest} disabled={!questions.length}><PlayMark /> Start session <ArrowRight size={15} /></button></ModalShell>}

    {createOpen && <ModalShell onClose={() => setCreateOpen(false)} size="create-modal"><div className="modal-heading-row"><span className="modal-icon modal-icon-peach"><Sparkles size={18} /></span><button className="icon-button" aria-label="Close question editor" onClick={() => setCreateOpen(false)}><X size={18} /></button></div><span className="section-kicker">YOUR QUESTION · YOUR KEY</span><h2 className="modal-title">Write an item<br /><span>worth reviewing.</span></h2><p className="modal-intro">Add a clear worked solution and common wrong turns. Your difficulty and discrimination values are design priors until candidate data exists.</p><form className="question-form" onSubmit={saveDraft}><label className="form-field form-field-full"><span className="field-label">QUESTION PROMPT <i>*</i></span><textarea required minLength={8} rows={4} value={draft.question} onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))} placeholder="State the context, constraints and what the candidate must find…" /></label><div className="form-two-col"><label className="form-field"><span className="field-label">SUBJECT</span><select value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}>{SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}</select></label><label className="form-field"><span className="field-label">TOPIC <i>*</i></span><input required value={draft.topic} onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))} placeholder="e.g. graph traversal" /></label></div><label className="form-field form-field-full"><span className="field-label">SUBTOPIC <small>OPTIONAL</small></span><input value={draft.subtopic} onChange={(event) => setDraft((current) => ({ ...current, subtopic: event.target.value }))} placeholder="e.g. BFS shortest paths" /></label><div className="form-two-col"><div className="form-field"><span className="field-label">QUESTION FORMAT</span><div className="format-switcher">{(["MCQ", "MSQ", "NAT"] as QuestionFormat[]).map((type) => <button type="button" key={type} className={draft.type === type ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, type, options: type === "NAT" ? "" : current.options }))}>{type}</button>)}</div></div><div className="form-field"><span className="field-label">MARKS</span><div className="format-switcher short-switcher">{[1, 2].map((marks) => <button type="button" key={marks} className={draft.marks === marks ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, marks }))}>{marks} mark{marks === 1 ? "" : "s"}</button>)}</div></div></div>{draft.type !== "NAT" && <label className="form-field form-field-full"><span className="field-label">ANSWER OPTIONS <small>ONE PER LINE</small></span><textarea required rows={4} value={draft.options} onChange={(event) => setDraft((current) => ({ ...current, options: event.target.value }))} placeholder={"Option one\nOption two\nOption three\nOption four"} /></label>}<label className="form-field form-field-full"><span className="field-label">CORRECT ANSWER <i>*</i> {draft.type === "MSQ" && <small>USE | BETWEEN ANSWERS</small>}</span><input required value={draft.answer} onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))} placeholder={draft.type === "MSQ" ? "e.g. Option one | Option three" : draft.type === "NAT" ? "e.g. 4.33" : "Copy the exact correct option above"} /></label><label className="form-field form-field-full"><span className="field-label">DETAILED SOLUTION</span><textarea rows={3} value={draft.explanation} onChange={(event) => setDraft((current) => ({ ...current, explanation: event.target.value }))} placeholder="Show the reasoning in steps, not just the answer…" /></label><label className="form-field form-field-full"><span className="field-label">COMMON MISTAKES <small>ONE PER LINE</small></span><textarea rows={3} value={draft.commonMistakes} onChange={(event) => setDraft((current) => ({ ...current, commonMistakes: event.target.value }))} placeholder="Boundary mistake\nConcept confusion\nCalculation slip" /></label><div className="form-two-col psych-inputs"><label className="form-field"><span className="field-label">DIFFICULTY PRIOR · b <strong>{draft.difficulty.toFixed(1)} · {difficultyLabel(draft.difficulty)}</strong></span><input type="range" min="-0.5" max="1.5" step="0.1" value={draft.difficulty} onChange={(event) => setDraft((current) => ({ ...current, difficulty: Number(event.target.value) }))} /></label><label className="form-field"><span className="field-label">DISCRIMINATION PRIOR · a <strong>{draft.discrimination.toFixed(2)}</strong></span><input type="range" min="0.6" max="2" step="0.05" value={draft.discrimination} onChange={(event) => setDraft((current) => ({ ...current, discrimination: Number(event.target.value) }))} /></label></div><div className="form-two-col"><label className="form-field"><span className="field-label">BLOOM LEVEL</span><select value={draft.bloom} onChange={(event) => setDraft((current) => ({ ...current, bloom: Number(event.target.value) }))}><option value={3}>3 · Apply</option><option value={4}>4 · Analyze</option><option value={5}>5 · Evaluate</option></select></label><label className="form-field"><span className="field-label">SOURCE LABEL</span><input value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))} placeholder="Original / year / paper" /></label></div><div className="answer-prior-note"><ShieldCheck size={14} /> Guessing prior: <strong>{draft.type === "MCQ" ? "0.25" : draft.type === "MSQ" ? "0.03" : "0.00"}</strong> · time: <strong>{draft.marks === 2 ? "3 min" : "1.5 min"}</strong> · review the answer before sharing.</div><button className="button button-primary save-question-button" disabled={draftSaving}>{draftSaving ? <><LoaderCircle className="spin-icon" size={16} /> Saving question…</> : <><Check size={16} /> Save to my question bank</>}</button></form></ModalShell>}

    {importOpen && <ModalShell onClose={() => setImportOpen(false)} size="import-modal"><div className="modal-heading-row"><span className="modal-icon modal-icon-blue"><CloudUpload size={18} /></span><button className="icon-button" aria-label="Close import questions" onClick={() => setImportOpen(false)}><X size={18} /></button></div><span className="section-kicker">KEEP YOUR SOURCES CLOSE</span><h2 className="modal-title">Bring your work<br /><span>into the bank.</span></h2><p className="modal-intro">Add structured questions from a file or paste a formatted question set. Your files are read in this browser; imported items are stored in your PostgreSQL database.</p><div className="import-mode-tabs"><button className={importMode === "add" ? "selected" : ""} onClick={() => setImportMode("add")}>Add to bank</button><button className={importMode === "review" ? "selected" : ""} onClick={() => setImportMode("review")}>Compare to PYQs</button></div>{importMode === "review" && <div className="import-review-note"><BookOpen size={15} /><span>Imported PYQs stay labeled as user-provided source material. Verify year, paper, answer key and permission before treating them as verified.</span></div>}
      <label className={`dropzone ${importBusy ? "dropzone-busy" : ""}`}><input ref={fileInputRef} type="file" accept=".pdf,.json,.csv,.txt,.md" onChange={(event) => void handleFileSelected(event)} /><span className="dropzone-icon">{importBusy ? <LoaderCircle size={19} className="spin-icon" /> : <Upload size={19} />}</span><strong>{importBusy ? "Reading your file…" : importFileLabel || "Choose a file or drop it here"}</strong><small>Text-searchable PDF · JSON · CSV · TXT</small><span className="dropzone-link">{importBusy ? "Extracting in this browser" : "Browse files"}</span></label>
      {importNotice && <div className="import-notice"><CheckCircle2 size={14} /> {importNotice}</div>}{importError && <div className="import-error"><XCircle size={14} /> {importError}</div>}
      <div className="import-paste-label"><label className="field-label" htmlFor="import-text">OR PASTE QUESTION DATA <small>{importFileLabel ? `· ${importFileLabel}` : "· QUESTION TEXT OR CSV"}</small></label><button className="template-download" onClick={() => downloadBlob(JSON.stringify({ questions: [{ question: "Question text…", subject: "Algorithms", topic: "Graph algorithms", type: "MCQ", marks: 1, difficulty: 0.7, discrimination: 1.2, guessing: 0.25, bloom: 3, estimatedSeconds: 90, options: ["Option A", "Option B", "Option C", "Option D"], answer: "Option A", explanation: "Worked solution…", commonMistakes: ["Common distractor misconception"], source: "Original" }] }, null, 2), "gate-cse-import-template.json", "application/json")}><Download size={13} /> Get JSON template</button></div><textarea id="import-text" className="import-textarea" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={"JSON / CSV fields or numbered text items with A) options and an Answer: line.\n\nFor CSV use columns: question,subject,topic,type,marks,options,answer,explanation. Separate options with |.\n\nUnstructured PDF text is extracted, then shown here for you to check — it is not silently turned into verified questions."} rows={9} />
      <div className="import-preview-summary"><span>{importPreview.records.length} structured question{importPreview.records.length === 1 ? "" : "s"} detected</span>{importPreview.records.length > 0 && <span>Preview first: {String(importPreview.records[0]?.question ?? "").slice(0, 72)}{String(importPreview.records[0]?.question ?? "").length > 72 ? "…" : ""}</span>}{importPreview.error && importText.trim() && <span className="import-preview-error">{importPreview.error}</span>}</div><div className="import-bottom-actions"><button className="button button-outline" onClick={() => setImportOpen(false)}>Cancel</button><button className="button button-primary" onClick={() => void performImport()} disabled={importBusy || importPreview.records.length === 0}>{importBusy ? <><LoaderCircle className="spin-icon" size={15} /> Importing</> : <><Database size={15} /> Import {importPreview.records.length.toLocaleString()} questions <ArrowRight size={14} /></>}</button></div><p className="import-privacy"><ShieldCheck size={13} /> Scanned PDFs need OCR before import. Check every extracted answer against your official key.</p></ModalShell>}

    {preview && <ModalShell onClose={() => setPreview(null)} size="preview-modal"><div className="modal-heading-row"><span className="q-format-badge format-modal">{preview.type}</span><button className="icon-button" aria-label="Close question review" onClick={() => setPreview(null)}><X size={18} /></button></div><div className="preview-meta"><span>{preview.subject} <i>·</i> {preview.topic}</span><span>{preview.marks} mark{preview.marks === 1 ? "" : "s"} <i>·</i> {difficultyLabel(preview.difficulty)}</span></div><h2 className="preview-question-title">{preview.question}</h2>{preview.options.length > 0 && <div className="preview-option-list">{preview.options.map((option, index) => <div className={`preview-option-item ${preview.answer && (Array.isArray(preview.answer) ? preview.answer.includes(option) : preview.answer === option) ? "preview-option-correct" : ""}`} key={`${option}-${index}`}><span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong>{preview.answer && (Array.isArray(preview.answer) ? preview.answer.includes(option) : preview.answer === option) && <CheckCircle2 size={15} />}</div>)}</div>}{previewBusy ? <div className="preview-loading"><LoaderCircle size={16} className="spin-icon" /> Opening the worked answer…</div> : preview.answer && <div className="preview-answer"><span className="section-kicker">CORRECT ANSWER</span><strong>{Array.isArray(preview.answer) ? preview.answer.join(" · ") : preview.answer}</strong></div>}{preview.explanation && <div className="preview-explanation"><span className="section-kicker">DETAILED SOLUTION</span><p>{preview.explanation}</p></div>}{preview.commonMistakes.length > 0 && <div className="preview-mistakes"><span className="section-kicker">COMMON MISCONCEPTIONS</span>{preview.commonMistakes.map((mistake, index) => <span key={`${mistake}-${index}`}><XCircle size={13} />{mistake}</span>)}</div>}<div className="preview-irt-strip"><span>b <strong>{preview.difficulty.toFixed(2)}</strong></span><span>a <strong>{preview.discrimination.toFixed(2)}</strong></span><span>c <strong>{preview.guessing.toFixed(2)}</strong></span><span>Bloom <strong>{preview.bloom}</strong></span><span className="preview-irt-note">Design priors · not calibrated</span></div><div className="preview-source"><FileText size={14} /><span>Source: {preview.source}</span><button onClick={() => void deleteQuestion(preview)} aria-label="Delete question"><Trash2 size={15} /></button></div></ModalShell>}

    {confirmSubmit && activeTest && <ModalShell onClose={() => setConfirmSubmit(false)} size="confirm-modal"><div className="modal-heading-row"><span className="modal-icon modal-icon-peach"><Flag size={18} /></span><button className="icon-button" aria-label="Keep practicing" onClick={() => setConfirmSubmit(false)}><X size={18} /></button></div><span className="section-kicker">BEFORE YOU SUBMIT</span><h2 className="modal-title">A quick look<br /><span>at your palette.</span></h2><p className="modal-intro">Your answers will be saved, graded and revealed with worked solutions. You can’t return to this timed set after submission.</p><div className="submit-check-grid"><div><strong>{answeredCount}</strong><span>answered</span></div><div><strong>{reviewCount}</strong><span>marked to revisit</span></div><div><strong>{activeQuestionCount - answeredCount}</strong><span>not answered</span></div></div>{activeQuestionCount - answeredCount > 0 && <div className="unanswered-notice"><Flag size={15} /> You still have {activeQuestionCount - answeredCount} unanswered question{activeQuestionCount - answeredCount === 1 ? "" : "s"}. They will score zero.</div>}<div className="confirm-actions"><button className="button button-outline" onClick={() => setConfirmSubmit(false)}>Keep practicing</button><button className="button button-primary" onClick={() => void finishTest()} disabled={submitting}>{submitting ? <><LoaderCircle className="spin-icon" size={15} /> Saving result…</> : <><Check size={15} /> Submit & review</>}</button></div></ModalShell>}

    {calculatorOpen && <ScientificCalculator onClose={() => setCalculatorOpen(false)} />}
    {toast && <div className="toast-message"><CheckCircle2 size={16} />{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}><X size={14} /></button></div>}
  </>;
}

function subjectInitial(subject: string) {
  if (subject.includes("Programming")) return "DS";
  if (subject.includes("Organization")) return "CO";
  if (subject.includes("Mathematics")) return "∑";
  if (subject.includes("Networks")) return "CN";
  if (subject.includes("Automata")) return "TO";
  if (subject.includes("General")) return "GA";
  return subject.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
}

function PlayMark() {
  return <span className="play-mark"><span /></span>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: ReactNode; description: string; action?: ReactNode }) {
  return <div className="page-intro subpage-intro"><div><div className="eyebrow"><span className="eyebrow-dot" /> {eyebrow}</div><h1>{title}</h1><p className="page-description">{description}</p></div>{action && <div className="intro-actions">{action}</div>}</div>;
}

function MetricCard({ icon: Icon, iconColor, label, value, caption, trend, progress, onClick }: { icon: LucideIcon; iconColor: string; label: string; value: string; caption: string; trend?: string; progress?: number; onClick?: () => void }) {
  const content = <><div className="metric-card-head"><span className={`metric-icon metric-icon-${iconColor}`}><Icon size={17} /></span><span className="metric-label">{label}</span><ArrowUpRight className="metric-card-arrow" size={15} /></div><div className="metric-main-value">{value}</div><div className="metric-caption">{caption}</div>{progress !== undefined && <div className="metric-progress-track"><span style={{ width: `${progress}%` }} /></div>}<div className="metric-trend">{trend && <><span className={`trend-dot trend-${iconColor}`} />{trend}</>}</div></>;
  return onClick ? <button className="metric-card metric-card-button" onClick={onClick}>{content}</button> : <div className="metric-card">{content}</div>;
}

function EmptyState({ icon: Icon, title, text, action, onClick }: { icon: LucideIcon; title: string; text: string; action?: string; onClick?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={19} /></span><strong>{title}</strong><p>{text}</p>{action && onClick && <button className="inline-link" onClick={onClick}>{action} <ArrowRight size={13} /></button>}</div>;
}

function LoadingBlock({ label }: { label: string }) {
  return <div className="loading-block"><LoaderCircle size={17} className="spin-icon" />{label}</div>;
}

function ModalShell({ children, onClose, size }: { children: ReactNode; onClose: () => void; size: string }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal-card ${size}`} role="dialog" aria-modal="true"><div className="modal-scroll-content">{children}</div></section></div>;
}

function PrincipleCard({ code, title, value, note, tone }: { code: string; title: string; value: string; note: string; tone: string }) {
  return <div className={`principle-card principle-${tone}`}><span className="principle-code">{code}</span><div><strong>{title}</strong><b>{value}</b><p>{note}</p></div></div>;
}

function FormulaCard({ number, title, formula, value, note, icon: Icon, tone }: { number: string; title: string; formula: string; value: string; note: string; icon: LucideIcon; tone: string }) {
  return <div className={`formula-card formula-${tone}`}><div className="formula-card-top"><span className="formula-index">{number}</span><span className="formula-icon"><Icon size={16} /></span></div><strong className="formula-title">{title}</strong><span className="formula-equation">{formula}</span><span className="formula-observation">{value}</span><p>{note}</p></div>;
}

function ReviewItem({ question, response, index, attemptId }: { question: Question; response?: GradedResponse; index: number; attemptId: string }) {
  const [expanded, setExpanded] = useState(index <= 2);
  const [feeling, setFeeling] = useState<ResponseRecord["feeling"]>(response?.feeling);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const status = response?.correct ? "review-correct" : response && (Array.isArray(response.response) ? response.response.length > 0 : Boolean(response.response.trim())) ? "review-wrong" : "review-skipped";
  const saveFeeling = async (nextFeeling: NonNullable<ResponseRecord["feeling"]>) => {
    setFeedbackSaving(true);
    setFeedbackError("");
    try {
      const saved = await fetch(`/api/attempts/${attemptId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, feeling: nextFeeling }),
      });
      const data = await saved.json();
      if (!saved.ok) throw new Error(data.error || "Feedback could not be saved.");
      setFeeling(nextFeeling);
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Feedback could not be saved.");
    } finally {
      setFeedbackSaving(false);
    }
  };
  const userResponse = response ? Array.isArray(response.response) ? response.response.join(" · ") : response.response : "Not answered";
  const correctAnswer = response ? Array.isArray(response.expectedAnswer) ? response.expectedAnswer.join(" · ") : response.expectedAnswer : "Not available";
  return <article className={`review-question ${expanded ? "review-question-open" : ""}`}><button className="review-question-header" onClick={() => setExpanded((value) => !value)}><span className={`review-status-icon ${status}`}>{response?.correct ? <Check size={14} /> : status === "review-wrong" ? <X size={14} /> : <Minus size={14} />}</span><span className="review-header-copy"><strong>Q{String(index).padStart(2, "0")} · {question.topic}</strong><small>{question.subject} · {question.type} · {question.marks} mark{question.marks === 1 ? "" : "s"}</small></span><span className={`review-award ${response?.marksAwarded && response.marksAwarded < 0 ? "negative-mark" : ""}`}>{response?.marksAwarded ? `${response.marksAwarded > 0 ? "+" : ""}${Number(response.marksAwarded.toFixed(2))}` : "0"}</span><ChevronDown className={`review-chevron ${expanded ? "rotated" : ""}`} size={16} /></button>{expanded && <div className="review-question-body"><p className="review-prompt">{question.question}</p>{question.options.length > 0 && <div className="review-choice-list">{question.options.map((option, optionIndex) => { const isAnswer = Array.isArray(response?.expectedAnswer) ? response.expectedAnswer.includes(option) : response?.expectedAnswer === option; const wasSelected = Array.isArray(response?.response) ? response.response.includes(option) : response?.response === option; return <div key={`${option}-${optionIndex}`} className={`review-choice ${isAnswer ? "choice-is-answer" : ""} ${wasSelected && !isAnswer ? "choice-is-wrong" : ""}`}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}{isAnswer && <CheckCircle2 size={14} />}{wasSelected && !isAnswer && <XCircle size={14} />}</div>; })}</div>}<div className="review-answer-pair"><div><span>YOUR ANSWER</span><strong>{userResponse}</strong></div><div><span>CORRECT ANSWER</span><strong>{correctAnswer}</strong></div></div><div className="review-solution-box"><span className="section-kicker">THE REASONING</span><p>{question.explanation || "Add a step-by-step worked solution for this item in the question studio."}</p></div>{question.commonMistakes.length > 0 && <div className="review-mistake-note"><span className="section-kicker">WATCH FOR</span>{question.commonMistakes.map((mistake, mistakeIndex) => <span key={`${mistake}-${mistakeIndex}`}><XCircle size={13} />{mistake}</span>)}</div>}{response && <div className="review-feedback"><span className="section-kicker">ROUND 02 · HOW DID THIS ITEM FEEL?</span><div className="feedback-buttons">{([["too-easy", "Too easy"], ["about-right", "About right"], ["too-hard", "Too hard"], ["un-gate-like", "Un-GATE-like"]] as const).map(([value, label]) => <button key={value} className={`feedback-chip ${feeling === value ? "feedback-selected" : ""}`} disabled={feedbackSaving} onClick={() => void saveFeeling(value)}>{feeling === value && <Check size={11} />}{label}</button>)}</div><span className="feedback-hint">{feedbackSaving ? "Saving your rating…" : feeling ? "Saved with this attempt — use it when recalibrating." : "Your honest first impression helps tune the next version."}</span>{feedbackError && <span className="feedback-error">{feedbackError}</span>}</div>}</div>}</article>;
}
