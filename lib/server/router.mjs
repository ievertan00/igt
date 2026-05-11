/**
 * Tiny HTTP router. Routes are registered with method, path matcher, and handler.
 * Body parsing for POST is centralized: handlers receive ctx.body parsed as JSON.
 */

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

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function jsonError(res, status, message) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

export async function dispatch(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
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
      await r.handler(req, res, { body });
    } catch (e) {
      jsonError(res, e.status || 500, e.message || "Internal server error");
    }
    return;
  }
  jsonError(res, 404, "Not found");
}
