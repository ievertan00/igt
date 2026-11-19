/**
 * Typed HTTP client for the IGT background server.
 * One private request() helper; named methods per endpoint.
 */
import http from "node:http";

let defaultBaseUrl = process.env.IGT_API_BASE_URL || null;

function request(method, pathPart, body, signal, baseUrl = defaultBaseUrl, token = null, modelTask) {
  return new Promise((resolve, reject) => {
    if (!baseUrl) {
      reject(new Error("Local Runtime API base URL has not been injected"));
      return;
    }
    const target = new URL(pathPart, baseUrl);
    const opts = {
      hostname: target.hostname.replace(/^\[|\]$/g, ""),
      port: target.port || 80,
      path: `${target.pathname}${target.search}`,
      method,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    if (modelTask) opts.headers["X-IGT-CLI-Task"] = modelTask;
    if (signal) opts.signal = signal;
    let payload = null;
    if (body !== undefined && body !== null) {
      payload = typeof body === "string" ? body : JSON.stringify(body);
      opts.headers["Content-Length"] = Buffer.byteLength(payload, "utf8");
    }
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (res.statusCode !== 200) {
            const error = parsed.error;
            const message = typeof error === "string" ? error : error?.message || `HTTP ${res.statusCode}`;
            const err = new Error(message);
            err.status = res.statusCode;
            if (error && typeof error === "object") {
              err.code = error.code;
              err.retryable = Boolean(error.retryable);
            }
            reject(err);
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export function ping() {
  return defaultBaseUrl ? pingUrl(defaultBaseUrl) : Promise.resolve(false);
}

export function pingUrl(baseUrl) {
  return new Promise((resolve) => {
    const req = http.get(new URL("/health", baseUrl), { timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

export function createApiClient(options = {}) {
  const { token = null } = options;
  // The CLI constructs its shared client before starting the local server.
  // Resolve the default lazily so setApiBaseUrl() can inject the ready port.
  const hasExplicitBaseUrl = Object.hasOwn(options, "baseUrl");
  const call = (method, pathPart, body, signal, modelTask) => request(
    method,
    pathPart,
    body,
    signal,
    hasExplicitBaseUrl ? options.baseUrl : defaultBaseUrl,
    token,
    options.cliModels ? modelTask : undefined,
  );
  return {
    callGrammar: (text, signal) => call("POST", "/grammar", { text }, signal, "grammar"),
    saveGrammarResult: (text, data, signal) => call("POST", "/grammar/save", { text, data }, signal),
    callTextAnalysis: (text, signal) => call("POST", "/text", { text }, signal, "text"),
    callTranslation: (text, direction, signal) => call("POST", "/translation", { text, direction }, signal, "translation"),
    generatePractice: (mode, count, filters = {}) => call("POST", "/practice/generate", { ...filters, mode, count }),
    evaluatePractice: (question, answer, hintsUsed = 0) => call("POST", "/practice/evaluate", { question, answer, hints_used: hintsUsed }, undefined, "practice"),
    getStats: () => call("GET", "/stats"),
    getTodayEffort: () => call("GET", "/today"),
    getDue: ({ limit = 10, type = "all" } = {}) => {
    const t = type !== "all" ? `&type=${type}` : "";
    return call("GET", `/review/due?limit=${Math.max(1, limit)}${t}`);
    },
    gradeCard: (cardId, correct) => call("POST", "/review/grade", { card_id: cardId, correct }),
    checkVocabularyRecall: (cardId, answer) => call("POST", "/review/check", { card_id: cardId, answer }),
    submitVocabularyRecall: (cardId, answer, requestId, audioPlayed = false, rating) => call("POST", "/review/grade", { card_id: cardId, answer, request_id: requestId, audio_played: audioPlayed, rating }),
    deleteCard: (cardId) => call("POST", "/review/delete", { card_id: cardId }),
    getStatusMessage: () => call("GET", "/status-message"),
    switchProvider: (provider) => call("POST", "/switch", { provider }),
    switchModel: (provider, model) => call("POST", "/switch-model", { provider, model }),
    setCliModel: (task, profileId) => call("POST", "/settings/llm/cli", { task, profileId }),
    seedVocab: () => call("POST", "/vocab/seed", {}),
    unloadOllama: () => call("POST", "/ollama/unload", {}, undefined, "grammar"),
    callAsk: (text, signal) => call("POST", "/ask", { text }, signal, "ask"),
    saveAsk: (signal) => call("POST", "/ask/save", {}, signal, "ask"),
    resetAsk: () => call("POST", "/ask/reset", {}),
    callChat: (text, signal) => call("POST", "/chat", { text }, signal, "chat"),
    resetChat: () => call("POST", "/chat/reset", {}),
    getRuntime: (signal) => call("GET", "/runtime", undefined, signal),
    getDashboard: () => call("GET", "/dashboard"),
    getCoach: (days = 90) => call("GET", `/coach?days=${Math.max(0, days)}`),
    explainCoach: (errorType, days = 90, version = "") => call("POST", "/coach/explain", { errorType, days, version }, undefined, "coach"),
    getHandbook: (days = 90, errorType = "") => call("GET", `/handbook?days=${Math.max(0, days)}${errorType ? `&errorType=${encodeURIComponent(errorType)}` : ""}`),
  };
}

export function setApiBaseUrl(baseUrl) {
  defaultBaseUrl = new URL(baseUrl).toString().replace(/\/$/, "");
}

export function getApiBaseUrl() {
  return defaultBaseUrl;
}

export const api = createApiClient({ cliModels: true });
