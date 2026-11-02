export type RequestJsonInit = RequestInit & { timeoutMs?: number };

export type GrammarHistory = {
  days: number; search: string; errorType: string; diagnosis: "all" | "with" | "none";
  coverage: { grammar: number; excludedOtherSources: number; unclassified: number; undated: number; legacyIncluded?: number };
  categories: Array<{ errorType: string; checks: number }>;
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  entries: Array<{ entryId: string; source?: string; timestamp: string; userInput: string; correction?: string | null;
    refine?: string | null; evaluate?: string | null; remember?: string | string[] | null;
    diagnoses: Array<{ error_type: string; severity?: string; explanation?: string; evidence?: string; suggestion?: string }> }>;
};

export type CoachPatterns = { days: number; checks: number; coverage: GrammarHistory["coverage"]; patterns: Array<{ errorType: string; checks: number; observations: number; latest: string; version: string }> };
export type CoachDetail = { errorType: string; days: number; version: string; sampled: boolean; cached: boolean; generatedAt: string;
  explanation: { observedPattern: string; principle: string; qualifications: string; possibleCauses: Array<{ hypothesis: string; evidenceIds: string[] }>; examples: Array<{ entryId: string; explanation: string }> };
  evidence: Array<{ entryId: string; timestamp: string; original: string; correction?: string | null }> };
export type LearningOverview = { days: number; summary: Array<{ type: string; label: string; count: number }>;
  events: Array<{ source: string; id: string; type: string; timestamp: string; precision?: string; title: string; score?: number; href?: string | null }>;
  pagination: GrammarHistory["pagination"]; coverage: Array<{ source: string; status: string; count?: number; note: string }>;
  undated: number; patterns: Array<{ errorType: string; checks: number }>;
  effort: { daily: Array<{ date: string; label: string; count: number }>; weekly: Array<{ start: string; count: number }>; monthly: Array<{ start: string; count: number }>;
    momentum: { current: number; previous: number; percent: number | null } };
  priorities: Array<{ errorType: string; hits: number; habit?: string }> };

function webError(code: string, message: string, retryable: boolean, cause?: unknown) {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  Object.assign(error, { code, retryable });
  return error;
}

export async function requestJson<T>(url: string, init: RequestJsonInit = {}): Promise<T> {
  const { timeoutMs = 30_000, signal: externalSignal, ...requestInit } = init;
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) abortFromCaller();
    else externalSignal.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timer = timeoutMs > 0 ? setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs) : undefined;
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(requestInit.headers || {}) },
      ...requestInit,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = payload.error;
      if (error && typeof error === "object") {
        throw webError(error.code || `HTTP_${response.status}`, error.message || `HTTP ${response.status}`, Boolean(error.retryable));
      }
      throw webError(response.status >= 500 ? "HTTP_ERROR" : "INVALID_REQUEST", error || `HTTP ${response.status}`, response.status >= 500);
    }
    return payload as T;
  } catch (error) {
    if (timedOut) throw webError("REQUEST_TIMEOUT", `Request timed out after ${timeoutMs} ms`, true, error);
    if (externalSignal?.aborted) throw webError("REQUEST_ABORTED", "Request was aborted", true, error);
    if (error && typeof error === "object" && "code" in error) throw error;
    throw webError("NETWORK_ERROR", "Unable to reach the Local Web Runtime", true, error);
  } finally {
    if (timer) clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export const webApi = {
  getRuntime: () => requestJson<any>("/runtime"),
  getLlmSettings: () => requestJson<any>("/settings/llm"),
  saveLlmSettings: (settings: unknown) => requestJson<any>("/settings/llm", { method: "POST", body: JSON.stringify(settings) }),
  testLlmConnection: (settings: unknown) => requestJson<any>("/settings/llm/test", { method: "POST", body: JSON.stringify(settings), timeoutMs: 20_000 }),
  getFileSettings: () => requestJson<any>("/settings/files"),
  saveFileSettings: (settings: unknown) => requestJson<any>("/settings/files", { method: "POST", body: JSON.stringify(settings) }),
  pickFileSetting: (kind: "file" | "folder") => requestJson<{ path: string }>("/settings/files/pick", { method: "POST", body: JSON.stringify({ kind }), timeoutMs: 0 }),
  getDashboard: (options: { days?: number; offset?: number; limit?: number } = {}) => requestJson<LearningOverview>(`/dashboard?${new URLSearchParams({ days: String(options.days ?? 30), offset: String(options.offset ?? 0), limit: String(options.limit ?? 10) })}`),
  checkGrammar: (text: string) => requestJson<any>("/grammar", { method: "POST", body: JSON.stringify({ text }) }),
  saveGrammar: (text: string, data: unknown) => requestJson<any>("/grammar/save", { method: "POST", body: JSON.stringify({ text, data }) }),
  translate: (text: string, direction: string) => requestJson<any>("/translation", { method: "POST", body: JSON.stringify({ text, direction }) }),
  ask: (question: string, messages: unknown[], language?: "zh-CN" | "en") => requestJson<any>("/ask", { method: "POST", body: JSON.stringify({ question, messages, language }) }),
  saveAsk: (messages: unknown[], language?: "zh-CN" | "en") => requestJson<any>("/ask/save", { method: "POST", body: JSON.stringify({ messages, language }), timeoutMs: 180_000 }),
  listAskNotes: () => requestJson<{ directory: string; notes: Array<{ id: string; modifiedAt: string; bytes: number; content?: string; title?: string; category?: string; tags?: string[] }> }>("/ask/notes"),
  readAskNote: (id: string) => requestJson<{ id: string; content: string; bytes: number }>(`/ask/notes/read?${new URLSearchParams({ id })}`),
  deleteAskNote: (id: string) => requestJson<{ deleted: boolean; id: string }>("/ask/notes/delete", { method: "POST", body: JSON.stringify({ id }) }),
  getReviewDue: async (limit = 20) => {
    await requestJson<any>("/vocab/seed", { method: "POST", body: "{}" });
    return requestJson<any>(`/review/due?limit=${limit}&type=vocab`);
  },
  checkReview: (cardId: number, answer: string) => requestJson<any>("/review/check", { method: "POST", body: JSON.stringify({ card_id: cardId, answer }) }),
  gradeReview: (cardId: number, answer: string, requestId: string, audioPlayed: boolean, rating: string) => requestJson<any>("/review/grade", { method: "POST", body: JSON.stringify({ card_id: cardId, answer, request_id: requestId, audio_played: audioPlayed, rating }) }),
  deleteReview: (cardId: number) => requestJson<any>("/review/delete", { method: "POST", body: JSON.stringify({ card_id: cardId }) }),
  listVocabularyWords: (options: { search: string; sort: string; schedule?: string; status?: string; offset: number; limit: number }, signal?: AbortSignal) => requestJson<import("../VocabularyLibrary").VocabularyLibraryResult>(`/vocab/words?${new URLSearchParams({ q: options.search, sort: options.sort, schedule: options.schedule || "all", status: options.status || "all", offset: String(options.offset), limit: String(options.limit) })}`, { signal }),
  vocabularyHistory: (cardId: number, offset: number, signal?: AbortSignal) => requestJson<import("../VocabularyLibrary").VocabularyHistoryResult>(`/vocab/history?${new URLSearchParams({ card_id: String(cardId), offset: String(offset) })}`, { signal }),
  getCoach: (days = 90) => requestJson<CoachPatterns>(`/coach?days=${days}`),
  explainCoach: (errorType: string, days: number, version: string, refresh = false) => requestJson<CoachDetail>("/coach/explain", { method: "POST", body: JSON.stringify({ errorType, days, version, refresh }), timeoutMs: 180_000 }),
  // Dictionary generation can outlast the generic 30-second deadline,
  // especially when the provider retries or a local model is loading.
  lookupWord: (query: string) => requestJson<any>(`/word/lookup?q=${encodeURIComponent(query)}`, { timeoutMs: 180_000 }),
  addWord: (entry: unknown) => requestJson<any>("/word/add", { method: "POST", body: JSON.stringify({ entry }) }),
  generatePractice: (mode = "sentence", count = 3, difficulty = "standard", style = "all", context = "all", targetErrorType = "") => requestJson<any>("/practice/generate", { method: "POST", body: JSON.stringify({ mode, count, difficulty, style, context, ...(targetErrorType ? { targetErrorType } : {}) }) }),
  evaluatePractice: (question: unknown, answer: string, hintsUsed = 0) => requestJson<any>("/practice/evaluate", {
    method: "POST",
    body: JSON.stringify({ question, answer, hints_used: hintsUsed }),
    // Checking a choice answer now writes its own explanation, so it needs the
    // same budget as generating a question. Sentence and word keep their budget.
    timeoutMs: (question as { kind?: string } | undefined)?.kind === "choice" ? 120_000 : 30_000,
  }),
  getStatusMessage: () => requestJson<any>("/status-message"),
  getHandbook: (errorType = "", options: { days?: number; search?: string; entryId?: string; diagnosis?: "all" | "with" | "none"; limit?: number; offset?: number } = {}) => {
      const params = new URLSearchParams({ days: String(options.days ?? 0), errorType, search: options.search ?? "", diagnosis: options.diagnosis ?? "all", limit: String(options.limit ?? 10), offset: String(options.offset ?? 0) });
    if (options.entryId) params.set("entry", options.entryId);
    return requestJson<GrammarHistory>(`/handbook?${params}`);
  },
  explainHandbookRule: (errorType: string, days: number, version: string) => requestJson<{ exampleCount: number; rule: { title: string; content: string; generatedAt?: string; cached?: boolean } }>("/handbook/rule", { method: "POST", body: JSON.stringify({ errorType, days, version }), timeoutMs: 180_000 }),
  deleteHandbookCheck: (entryId: string) => requestJson<{ deleted: boolean; entryId: string }>("/handbook/delete", { method: "POST", body: JSON.stringify({ entryId }) }),
  listHandbookReports: () => requestJson<{ reports: Array<{ id: string; date: string; provider: string }>; truncated?: boolean }>("/handbook/reports"),
  readHandbookReport: (id: string) => requestJson<{ id: string; html: string; snapshot: { days: number } | null }>(`/handbook/reports/read?${new URLSearchParams({ id })}`),
  compareHandbookReports: (older: string, newer: string) => requestJson<{ available: boolean; reason?: string; note?: string; changes?: Array<{ errorType: string; before: number; after: number; delta: number }> }>(`/handbook/reports/compare?${new URLSearchParams({ older, newer })}`),
  speakWord: async (text: string): Promise<HTMLAudioElement> => {
    const res = await fetch("/tts/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!res.ok) {
      let msg = `TTS ${res.status}`;
      try { const err = await res.json(); if (err?.error) msg = err.error; } catch {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return new Audio(url);
  },
};
