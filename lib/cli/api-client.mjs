/**
 * Typed HTTP client for the IGT background server.
 * One private request() helper; named methods per endpoint.
 */
import http from "node:http";

let defaultBaseUrl = process.env.IGT_API_BASE_URL || null;

function request(method, pathPart, body, signal, baseUrl = defaultBaseUrl, token = null) {
  return new Promise((resolve, reject) => {
    if (!baseUrl) {
      reject(new Error("Local Runtime API base URL has not been injected"));
      return;
    }
    const target = new URL(pathPart, baseUrl);
    const opts = {
      hostname: target.hostname,
      port: target.port || 80,
      path: `${target.pathname}${target.search}`,
      method,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
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

export function createApiClient({ baseUrl = defaultBaseUrl, token = null } = {}) {
  const call = (method, pathPart, body, signal) => request(method, pathPart, body, signal, baseUrl, token);
  return {
    callGrammar: (text, signal) => call("POST", "/grammar", { text }, signal),
    saveGrammarResult: (text, data, signal) => call("POST", "/grammar/save", { text, data }, signal),
    callTextAnalysis: (text, signal) => call("POST", "/text", { text }, signal),
    callTranslation: (text, direction, signal) => call("POST", "/translation", { text, direction }, signal),
    generatePractice: (mode, count) => call("POST", "/practice/generate", { mode, count }),
    evaluatePractice: (question, answer) => call("POST", "/practice/evaluate", { question, answer }),
    getStats: () => call("GET", "/stats"),
    getTodayEffort: () => call("GET", "/today"),
    getDue: ({ limit = 10, type = "all" } = {}) => {
    const t = type !== "all" ? `&type=${type}` : "";
    return call("GET", `/review/due?limit=${Math.max(1, limit)}${t}`);
    },
    gradeCard: (cardId, correct) => call("POST", "/review/grade", { card_id: cardId, correct }),
    deleteCard: (cardId) => call("POST", "/review/delete", { card_id: cardId }),
    getStatusMessage: () => call("GET", "/status-message"),
    switchProvider: (provider) => call("POST", "/switch", { provider }),
    switchModel: (provider, model) => call("POST", "/switch-model", { provider, model }),
    seedVocab: () => call("POST", "/vocab/seed", {}),
    unloadOllama: () => call("POST", "/ollama/unload", {}),
    callAsk: (text, signal) => call("POST", "/ask", { text }, signal),
    saveAsk: (signal) => call("POST", "/ask/save", {}, signal),
    resetAsk: () => call("POST", "/ask/reset", {}),
    callChat: (text, signal) => call("POST", "/chat", { text }, signal),
    resetChat: () => call("POST", "/chat/reset", {}),
    getRuntime: () => call("GET", "/runtime"),
    getDashboard: () => call("GET", "/dashboard"),
    getCoach: (windowDays = 30) => call("GET", `/coach?windowDays=${Math.max(1, windowDays)}`),
    analyzeCoach: (windowDays = 30) => call("POST", `/coach/analyze?windowDays=${Math.max(1, windowDays)}`, {}),
    getHandbook: (days = 90, errorType = "") => call("GET", `/handbook?days=${Math.max(0, days)}${errorType ? `&errorType=${encodeURIComponent(errorType)}` : ""}`),
  };
}

export function setApiBaseUrl(baseUrl) {
  defaultBaseUrl = new URL(baseUrl).toString().replace(/\/$/, "");
}

export const api = createApiClient();
