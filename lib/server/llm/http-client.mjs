/**
 * Shared HTTP client for LLM providers that need VPN bypass support.
 *
 * Two connection modes controlled by the `localAddress` option:
 *
 *   VPN mode    (localAddress set)
 *     Resolves the real public IP via AliDNS / Google DNS to avoid Clash
 *     Fake-IP, then binds the outbound socket to the physical NIC so traffic
 *     routes around the VPN tunnel.  The original Host header is preserved for
 *     TLS SNI and server-side routing.
 *
 *   Direct mode (no localAddress)
 *     Plain HTTPS through the system resolver — no binding, no DNS override.
 *
 * Configure via .env:  IGT_LOCAL_ADDRESS=<physical NIC IP>
 * Leave empty when not using a VPN.
 */

import https from "node:https";
import dns from "node:dns/promises";

// ── Task-aware socket-idle timeouts ───────────────────────────────────────────
// The `timeout` option on https.request is a socket-IDLE timeout, not a total
// response timeout.  Pro models (handbook / practice) sit silent for 30–90 s
// while generating before sending the first byte; flash models finish in < 30 s.
export const TASK_TIMEOUT = {
  grammar:     60_000,
  translation: 60_000,
  ask:         60_000,
  handbook:    120_000,
  practice:    120_000,
};

export function taskTimeout(taskType, override) {
  return override ?? TASK_TIMEOUT[taskType] ?? 60_000;
}

// ── DNS helper & Keep-Alive agents ────────────────────────────────────────────
const dnsCache = new Map();
const agents = new Map();

function getAgent(localAddress) {
  const key = localAddress || "default";
  if (!agents.has(key)) {
    agents.set(
      key,
      new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: 32,
        ...(localAddress ? { localAddress } : {}),
      })
    );
  }
  return agents.get(key);
}

async function resolveRealIP(hostname) {
  if (dnsCache.has(hostname)) {
    return dnsCache.get(hostname);
  }
  try {
    const resolver = new dns.Resolver();
    resolver.setServers(["223.5.5.5", "8.8.8.8"]);
    const guard = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("DNS timeout")), 3_000)
    );
    const addresses = await Promise.race([resolver.resolve4(hostname), guard]);
    const ip = addresses[0];
    if (ip) {
      dnsCache.set(hostname, ip);
    }
    return ip;
  } catch {
    return null;
  }
}

// ── fetchDirect ───────────────────────────────────────────────────────────────
/**
 * @param {string} url
 * @param {{ method: string, headers: object, body: string,
 *           localAddress?: string, timeout?: number }} opts
 */
export async function fetchDirect(url, { method, headers, body, localAddress, timeout = 60_000 }) {
  const { hostname, pathname, search } = new URL(url);

  let targetIP = hostname;
  if (localAddress) {
    const realIP = await resolveRealIP(hostname);
    if (realIP) targetIP = realIP;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    try {
      const req = https.request(
        {
          hostname: targetIP,
          path: pathname + search,
          method,
          headers: { ...headers, Host: hostname },
          family: 4,
          timeout,
          agent: getAgent(localAddress),
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
