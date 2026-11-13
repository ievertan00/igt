/**
 * Shared HTTP client for LLM providers.
 *
 * All requests use a direct network connection through the system resolver —
 * no VPN bypass, no local-interface binding, no DNS override.
 */

import https from "node:https";
import http from "node:http";

// ── Task-aware socket-idle timeouts ───────────────────────────────────────────
// The `timeout` option on https.request is a socket-IDLE timeout, not a total
// response timeout.  Pro models (handbook) sit silent for 30–90 s while
// generating before sending the first byte; flash models finish in < 30 s.
export const TASK_TIMEOUT = {
  grammar:     60_000,
  translation: 60_000,
  ask:         60_000,
  practice:    60_000,
  coach:       120_000,
  handbook:    120_000,
};

export function taskTimeout(taskType, override) {
  return override ?? TASK_TIMEOUT[taskType] ?? 60_000;
}

// ── Keep-Alive agents ─────────────────────────────────────────────────────────
const agents = new Map();

function getAgent(secure = true) {
  const key = secure ? "https" : "http";
  if (!agents.has(key)) {
    agents.set(
      key,
      new (secure ? https.Agent : http.Agent)({
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: 32,
      })
    );
  }
  return agents.get(key);
}

// ── fetchDirect ───────────────────────────────────────────────────────────────
/**
 * @param {string} url
 * @param {{ method: string, headers: object, body: string, timeout?: number, signal?: AbortSignal }} opts
 */
export async function fetchDirect(url, { method, headers, body, timeout = 60_000, signal }) {
  const { hostname, host, port, protocol, pathname, search } = new URL(url);
  const secure = protocol === "https:";
  if (!secure && protocol !== "http:") throw new Error("API endpoint must use HTTP or HTTPS");

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    try {
      const req = (secure ? https : http).request(
        {
          hostname,
          port: port || (secure ? 443 : 80),
          path: pathname + search,
          method,
          headers: { ...headers, Host: host },
          ...(secure ? { servername: hostname } : {}),
          family: 4,
          timeout,
          signal,
          agent: getAgent(secure),
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString();
            done(resolve, {
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              text: () => Promise.resolve(text),
              json: () => Promise.resolve(JSON.parse(text)),
            });
          });
          res.on("error", (err) => done(reject, err));
        }
      );

      req.on("error", (err) => done(reject, err));
      req.on("timeout", () => {
        req.destroy();
        done(reject, new Error(`Request timed out (${timeout / 1000}s)`));
      });
      req.write(body);
      req.end();
    } catch (err) {
      done(reject, err);
    }
  });
}
