// Host/Origin allowlist for the single-user runtime. The Web client is
// same-origin (Vite proxies the API in dev), so cross-origin browser requests
// are rejected outright; header-less clients such as the CLI still pass.
import os from "node:os";
import { errorPayload } from "../contracts/errors.mjs";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);
const HOST_CACHE_MS = 60_000;
let cachedHosts = null;
let cachedAt = 0;

function hostnameWithoutPort(value) {
  const host = String(value).trim().toLowerCase();
  if (host.startsWith("[")) return host.slice(1, host.indexOf("]"));
  return host.split(":")[0];
}

function allowedHosts() {
  const now = Date.now();
  if (cachedHosts && now - cachedAt < HOST_CACHE_MS) return cachedHosts;
  const hosts = new Set([...LOOPBACK, os.hostname().toLowerCase()]);
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) hosts.add(address.address.toLowerCase());
  }
  for (const extra of (process.env.IGT_ALLOWED_HOSTS || "").split(",")) {
    if (extra.trim()) hosts.add(extra.trim().toLowerCase());
  }
  cachedHosts = hosts;
  cachedAt = now;
  return hosts;
}

export function isRemoteMode(host = process.env.IGT_SERVER_HOST || "127.0.0.1") {
  return !LOOPBACK.has(host.trim().toLowerCase());
}

function reject(res, message) {
  res.writeHead(403, { "Content-Type": "application/json" });
  res.end(JSON.stringify(errorPayload("FORBIDDEN_ORIGIN", message)));
  return false;
}

export function guardRequest(req, res) {
  const headers = req.headers || {};
  const hosts = allowedHosts();
  const hostHeader = headers.host ? hostnameWithoutPort(headers.host) : "";
  if (hostHeader && !hosts.has(hostHeader)) {
    return reject(res, "This host is not allowed to reach the runtime");
  }
  if (headers.origin) {
    let originHost;
    try { originHost = new URL(headers.origin).hostname.toLowerCase(); }
    catch { return reject(res, "Invalid request origin"); }
    if (!hosts.has(originHost) || (hostHeader && originHost !== hostHeader)) {
      return reject(res, "Cross-origin requests are not accepted");
    }
  }
  return true;
}
