/**
 * Typed HTTP client for the IGT background server.
 * One private request() helper; named methods per endpoint.
 */
import http from "node:http";

const HOST = "127.0.0.1";
const PORT = 18964;

function request(method, pathPart, body, signal) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: HOST,
      port: PORT,
      path: pathPart,
      method,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    };
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
            const err = new Error(parsed.error || `HTTP ${res.statusCode}`);
            err.status = res.statusCode;
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
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${PORT}/health`, { timeout: 1000 }, (res) => {
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

export const api = {
  callGrammar: (text, signal) => request("POST", "/grammar", { text }, signal),
  callTranslation: (text, direction, signal) => request("POST", "/translation", { text, direction }, signal),
  getStats: () => request("GET", "/stats"),
  getTodayEffort: () => request("GET", "/today"),
  getDue: ({ limit = 10, type = "all" } = {}) => {
    const t = type !== "all" ? `&type=${type}` : "";
    return request("GET", `/review/due?limit=${Math.max(1, limit)}${t}`);
  },
  gradeCard: (cardId, correct) => request("POST", "/review/grade", { card_id: cardId, correct }),
  deleteCard: (cardId) => request("POST", "/review/delete", { card_id: cardId }),
  undo: (n) => request("POST", "/undo", { n }),
  getInputsLast: (n) => request("GET", `/inputs/last?n=${n}`),
  getStatusMessage: () => request("GET", "/status-message"),
  getSessionSummary: () => request("GET", "/session/summary"),
  switchProvider: (provider) => request("POST", "/switch", { provider }),
  switchModel: (provider, model) => request("POST", "/switch-model", { provider, model }),
  seedVocab: () => request("POST", "/vocab/seed", {}),
  unloadOllama: () => request("POST", "/ollama/unload", {}),
  callAsk: (text, signal) => request("POST", "/ask", { text }, signal),
  saveAsk: (signal) => request("POST", "/ask/save", {}, signal),
  resetAsk: () => request("POST", "/ask/reset", {}),
  callChat: (text, signal) => request("POST", "/chat", { text }, signal),
  resetChat: () => request("POST", "/chat/reset", {}),
};
