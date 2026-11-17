/**
 * Tiny HTTP router. Routes are registered with method, path matcher, and handler.
 * Body parsing for POST is centralized: handlers receive ctx.body parsed as JSON.
 */

import { errorPayload } from "../contracts/errors.mjs";
import { withRequestModel } from "./llm/request-model-context.mjs";

const routes = [];

export function register(method, matcher, handler) {
  routes.push({ method, matcher, handler });
}

function matches(matcher, url) {
  if (typeof matcher === "string") return url === matcher || url.startsWith(matcher + "?");
  if (matcher instanceof RegExp) return matcher.test(url);
  if (typeof matcher === "function") return matcher(url);
  return false;
}

const MAX_BODY_BYTES = 2 * 1024 * 1024;

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;
    req.on("data", (c) => {
      bytes += Buffer.byteLength(c);
      if (bytes > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body exceeds the 2 MB limit"), { status: 413, code: "BODY_TOO_LARGE" }));
        req.destroy();
        return;
      }
      body += c;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function jsonError(res, status, message, code = "INTERNAL_ERROR") {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(errorPayload(code, message, status >= 500)));
}

export async function dispatch(req, res) {
  if (req.method === "OPTIONS") {
    // The request guard has already validated Host/Origin; echo the caller's
    // origin instead of granting universal access.
    const headers = {
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-IGT-Model-Profile",
    };
    if (req.headers?.origin) headers["Access-Control-Allow-Origin"] = req.headers.origin;
    res.writeHead(200, headers);
    res.end();
    return;
  }
  for (const r of routes) {
    if (r.method !== req.method) continue;
    if (!matches(r.matcher, req.url)) continue;
    try {
      let body = null;
      if (req.method === "POST") {
        const raw = await readBody(req);
        if (raw) {
          try { body = JSON.parse(raw); }
          catch { return jsonError(res, 400, "Invalid JSON in request body"); }
        } else {
          body = {};
        }
      }
      await withRequestModel(req, () => r.handler(req, res, { body }));
    } catch (e) {
      jsonError(res, e.status || 500, e.message || "Internal server error", e.code || "INTERNAL_ERROR");
    }
    return;
  }
  jsonError(res, 404, "Not found");
}
