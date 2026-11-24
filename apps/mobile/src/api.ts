/* Local Runtime HTTP contract for ClearWrite Mobile.
 * Same endpoints as the desktop client, but a completely independent client
 * implementation: no imports from apps/web. */
import { store } from "./core";

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  constructor(message: string, code = "NETWORK_ERROR", retryable = true) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export type JsonInit = RequestInit & { timeoutMs?: number; modelPage?: string };

function modelHeader(page?: string): string {
  try {
    // Reuse the desktop client's per-page model choices so settings carry over.
    const selections = JSON.parse(localStorage.getItem("clearwrite.page-models") || "{}") as Record<string, string>;
    const chosen = page && selections[page];
    const fallback = store.read<string>("defaultProfile", "");
    const value = chosen || fallback;
    return typeof value === "string" && value.length <= 80 ? value : "";
  } catch { return ""; }
}

function qs(values: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export async function requestJson<T>(url: string, init: JsonInit = {}): Promise<T> {
  const { timeoutMs = 30_000, modelPage, signal: external, headers, ...rest } = init;
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (external) {
    if (external.aborted) onAbort();
    else external.addEventListener("abort", onAbort, { once: true });
  }
  const timer = timeoutMs > 0 ? setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs) : undefined;
  const profile = !url.startsWith("/settings/") ? modelHeader(modelPage) : "";
  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(profile ? { "X-IGT-Model-Profile": profile } : {}),
        ...(headers as Record<string, string> | undefined),
      },
    });
    const payload = await response.json().catch((error: unknown) => {
      if (!(error instanceof SyntaxError)) throw error;
      if (response.ok) throw new ApiError("Local Runtime returned invalid JSON.", "INVALID_RESPONSE", false);
      return undefined;
    });
    if (!response.ok) {
      const failure = payload?.error;
      if (failure && typeof failure === "object") {
        throw new ApiError(failure.message || `HTTP ${response.status}`, failure.code || `HTTP_${response.status}`, Boolean(failure.retryable));
      }
      throw new ApiError(typeof failure === "string" ? failure : `HTTP ${response.status}`,
        response.status >= 500 ? "HTTP_ERROR" : "INVALID_REQUEST", response.status >= 500);
    }
    return payload as T;
  } catch (error) {
    if (timedOut) throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)}s`, "REQUEST_TIMEOUT", true);
    if (external?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError("Cannot reach the Local Runtime", "NETWORK_ERROR", true);
  } finally {
    if (timer) clearTimeout(timer);
    external?.removeEventListener("abort", onAbort);
  }
}

export type PracticeQuestion = {
  id: string;
  kind: string;
  prompt_zh: string;
  difficulty: string;
  style: string;
  context: string;
  focus: string;
  hints: Record<string, string>;
  metadata: Record<string, unknown>;
  target_error_type?: string;
};

export type PracticeEvaluation = {
  score: number;
  verdict: string;
  corrected_answer: string;
  feedback_zh: string;
  strengths_zh: string[];
  improvements_zh: string[];
  reference_answer: string;
};

export type ReviewCard = {
  id: number;
  prompt: string;
  answer: string;
  word: string;
  pos: string;
  zh: string;
  meaning: string;
  example: string;
  note: string;
  masked_example: string;
  due_date: string;
  interval_days: number;
  total_reviews: number;
  vocab_details: Record<string, unknown> | null;
};

export type ReviewRating = "again" | "hard" | "good" | "easy";

export const api = {
  /* system */
  runtime: () => requestJson<any>("/runtime"),
  statusMessage: () => requestJson<any>("/status-message"),

  /* writing */
  checkGrammar: (text: string, signal?: AbortSignal) => requestJson<any>("/grammar", {
    method: "POST", body: JSON.stringify({ text }), modelPage: "grammar", timeoutMs: 90_000, signal,
  }),
  saveGrammar: (text: string, data: unknown) => requestJson<any>("/grammar/save", {
    method: "POST", body: JSON.stringify({ text, data }), modelPage: "grammar",
  }),
  translate: (text: string, direction: "zh2en" | "en2zh", signal?: AbortSignal) => requestJson<any>("/translation", {
    method: "POST", body: JSON.stringify({ text, direction }), modelPage: "translation", timeoutMs: 90_000, signal,
  }),

  /* ask */
  ask: (question: string, messages: Array<{ question: string; answer: string }>, language: "zh-CN" | "en") =>
    requestJson<any>("/ask", {
      method: "POST", body: JSON.stringify({ question, messages, language }),
      modelPage: "ask", timeoutMs: 180_000,
    }),
  saveAsk: (messages: Array<{ question: string; answer: string }>, language: "zh-CN" | "en") =>
    requestJson<any>("/ask/save", {
      method: "POST", body: JSON.stringify({ messages, language }), timeoutMs: 180_000,
    }),
  listAskNotes: () => requestJson<any>("/ask/notes"),
  readAskNote: (id: string) => requestJson<any>(`/ask/notes/read${qs({ id })}`),
  deleteAskNote: (id: string) => requestJson<any>("/ask/notes/delete", {
    method: "POST", body: JSON.stringify({ id }),
  }),

  /* vocabulary */
  lookupWord: (query: string, signal?: AbortSignal) => requestJson<any>(`/word/lookup${qs({ q: query })}`, {
    modelPage: "word-lookup", timeoutMs: 180_000, signal,
  }),
  addWord: (entry: unknown) => requestJson<any>("/word/add", {
    method: "POST", body: JSON.stringify({ entry }), modelPage: "word-lookup",
  }),
  seedVocabulary: () => requestJson<any>("/vocab/seed", { method: "POST", body: "{}" }),
  listWords: (options: { q?: string; sort?: string; schedule?: string; status?: string; offset?: number; limit?: number }, signal?: AbortSignal) =>
    requestJson<any>(`/vocab/words${qs({ q: options.q ?? "", sort: options.sort ?? "az", schedule: options.schedule ?? "all", status: options.status ?? "all", offset: options.offset ?? 0, limit: options.limit ?? 20 })}`, { signal }),
  wordHistory: (cardId: number, offset = 0, signal?: AbortSignal) =>
    requestJson<any>(`/vocab/history${qs({ card_id: cardId, offset })}`, { signal }),

  /* review */
  reviewDue: async (limit = 20, signal?: AbortSignal) => {
    await requestJson<any>("/vocab/seed", { method: "POST", body: "{}", signal });
    return requestJson<any>(`/review/due${qs({ limit, type: "vocab" })}`, { signal });
  },
  checkReview: (cardId: number, answer: string) => requestJson<any>("/review/check", {
    method: "POST", body: JSON.stringify({ card_id: cardId, answer }),
  }),
  gradeReview: (cardId: number, answer: string, requestId: string, audioPlayed: boolean, rating: ReviewRating) =>
    requestJson<any>("/review/grade", {
      method: "POST",
      body: JSON.stringify({ card_id: cardId, answer, request_id: requestId, audio_played: audioPlayed, rating }),
    }),
  deleteReview: (cardId: number) => requestJson<any>("/review/delete", {
    method: "POST", body: JSON.stringify({ card_id: cardId }),
  }),

  /* practice */
  generatePractice: (options: { count?: number; difficulty?: string; style?: string; context?: string; targetErrorType?: string } = {}) =>
    requestJson<any>("/practice/generate", {
      method: "POST",
      body: JSON.stringify({
        mode: "sentence",
        count: options.count ?? 1,
        difficulty: options.difficulty ?? "standard",
        style: options.style ?? "all",
        context: options.context ?? "all",
        ...(options.targetErrorType ? { targetErrorType: options.targetErrorType } : {}),
      }),
      modelPage: "practice",
      timeoutMs: 60_000,
    }),
  evaluatePractice: (question: PracticeQuestion, answer: string, hintsUsed: number) =>
    requestJson<any>("/practice/evaluate", {
      method: "POST",
      body: JSON.stringify({ question, answer, hints_used: hintsUsed }),
      modelPage: "practice",
      timeoutMs: 60_000,
    }),

  /* learning */
  dashboard: (options: { days?: number; offset?: number; limit?: number } = {}, signal?: AbortSignal) =>
    requestJson<any>(`/dashboard${qs({ days: options.days ?? 30, offset: options.offset ?? 0, limit: options.limit ?? 12 })}`, { signal }),
  growth: (filters: Record<string, string | number> = {}, signal?: AbortSignal) =>
    requestJson<any>(`/dashboard/growth${qs(filters)}`, { signal }),
  records: (filters: Record<string, string | number> = {}, signal?: AbortSignal) =>
    requestJson<any>(`/dashboard/records${qs(filters)}`, { signal }),
  record: (key: string, historyOffset = 0, signal?: AbortSignal) =>
    requestJson<any>(`/dashboard/record${qs({ key, historyOffset })}`, { signal }),
  practiceLog: () => requestJson<any>("/dashboard/practice-log"),

  /* handbook + coach */
  handbook: (options: Record<string, string | number> = {}, signal?: AbortSignal) =>
    requestJson<any>(`/handbook${qs({ days: 90, search: "", errorType: "", diagnosis: "all", limit: 10, offset: 0, ...options })}`, { signal }),
  handbookRule: (errorType: string, days: number, version: string) =>
    requestJson<any>("/handbook/rule", {
      method: "POST", body: JSON.stringify({ errorType, days, version }), timeoutMs: 180_000,
    }),
  deleteHandbookCheck: (entryId: string) => requestJson<any>("/handbook/delete", {
    method: "POST", body: JSON.stringify({ entryId }),
  }),
  coach: (days = 90, signal?: AbortSignal) => requestJson<any>(`/coach${qs({ days })}`, { signal, modelPage: "coach" }),
  coachReports: () => requestJson<any>("/coach/reports"),
  explainCoach: (errorType: string, days: number, version: string, refresh = false) =>
    requestJson<any>("/coach/explain", {
      method: "POST", body: JSON.stringify({ errorType, days, version, refresh }),
      modelPage: "coach", timeoutMs: 180_000,
    }),
  generateCoachReport: (days: number, language: string, refresh = false) =>
    requestJson<any>("/coach/report", {
      method: "POST", body: JSON.stringify({ days, language, refresh }), timeoutMs: 0,
    }),

  /* settings */
  llmSettings: () => requestJson<any>("/settings/llm"),
  saveLlmSettings: (body: unknown) => requestJson<any>("/settings/llm", {
    method: "POST", body: JSON.stringify(body),
  }),
  testLlmConnection: (body: unknown) => requestJson<any>("/settings/llm/test", {
    method: "POST", body: JSON.stringify(body), timeoutMs: 20_000,
  }),
  fileSettings: () => requestJson<any>("/settings/files"),
};
