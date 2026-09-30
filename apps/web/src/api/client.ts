export type RequestJsonInit = RequestInit & { timeoutMs?: number };

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
  getDashboard: () => requestJson<any>("/dashboard"),
  checkGrammar: (text: string) => requestJson<any>("/grammar", { method: "POST", body: JSON.stringify({ text }) }),
  saveGrammar: (text: string, data: unknown) => requestJson<any>("/grammar/save", { method: "POST", body: JSON.stringify({ text, data }) }),
  translate: (text: string, direction: string) => requestJson<any>("/translation", { method: "POST", body: JSON.stringify({ text, direction }) }),
  ask: (question: string, messages: unknown[]) => requestJson<any>("/ask", { method: "POST", body: JSON.stringify({ question, messages }) }),
  saveAsk: (messages: unknown[]) => requestJson<any>("/ask/save", { method: "POST", body: JSON.stringify({ messages }) }),
  getReviewDue: () => requestJson<any>("/review/due?limit=20&type=vocab"),
  gradeReview: (cardId: number, rating: string) => requestJson<any>("/review/grade", { method: "POST", body: JSON.stringify({ card_id: cardId, rating }) }),
  getCoach: () => requestJson<any>("/coach?windowDays=30"),
  analyzeCoach: () => requestJson<any>("/coach/analyze", { method: "POST", body: "{}" }),
  lookupWord: (query: string) => requestJson<any>(`/word/lookup?q=${encodeURIComponent(query)}`),
  addWord: (entry: unknown) => requestJson<any>("/word/add", { method: "POST", body: JSON.stringify({ entry }) }),
  generatePractice: (mode = "sentence", count = 3, difficulty = "standard") => requestJson<any>("/practice/generate", { method: "POST", body: JSON.stringify({ mode, count, difficulty }), timeoutMs: 120_000 }),
  evaluatePractice: (question: unknown, answer: string) => requestJson<any>("/practice/evaluate", { method: "POST", body: JSON.stringify({ question, answer }) }),
  getHandbook: (errorType = "") => requestJson<any>(`/handbook?days=90${errorType ? `&errorType=${encodeURIComponent(errorType)}` : ""}`),
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
