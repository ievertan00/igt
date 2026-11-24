import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");
const webRoot = path.join(projectRoot, "apps", "web", "dist");
// The Android app ships its own build inside the desktop output directory so
// both clients are served same-origin by the Local Runtime.
const mobileRoot = path.join(webRoot, "mobile");
const apiPrefixes = [
  "/health", "/status-message", "/switch", "/switch-model", "/ollama", "/settings",
  "/grammar", "/text", "/translation", "/practice", "/ask", "/chat",
  "/review", "/vocab", "/stats", "/today", "/runtime", "/dashboard",
  "/coach", "/word", "/handbook",
];
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

export function serveStatic(req, res, options = {}) {
  if (req.method !== "GET") return false;
  const rawPathname = String(req.url || "").split("?", 1)[0];
  if (/(^|\/)(?:\.\.|%2e%2e)(?:\/|$)/i.test(rawPathname)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Web asset not found");
    return true;
  }
  const pathname = new URL(req.url, "http://127.0.0.1").pathname;
  if (pathname.startsWith("/api/") || pathname === "/api" || apiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;

  // /mobile/ maps to its own Vite build (base: "/mobile/"). Without this
  // mapping the SPA fallback would return the desktop index.html instead.
  const isMobile = pathname === "/mobile" || pathname.startsWith("/mobile/");
  // mobileRoot can be overridden by tests; production always uses the build
  // emitted into apps/web/dist/mobile.
  const configuredMobileRoot = options.mobileRoot || mobileRoot;
  const root = options.root || (isMobile ? configuredMobileRoot : webRoot);
  const mobileRelative = isMobile && root === configuredMobileRoot;

  if (!fs.existsSync(path.join(root, "index.html"))) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Web build is not available");
    return true;
  }

  const relative = mobileRelative
    ? (pathname.replace(/^\/mobile\/?/, "") || "index.html")
    : (pathname === "/" ? "index.html" : pathname.slice(1));
  const requestedPath = path.resolve(root, relative);
  const isInsideRoot = requestedPath === root || requestedPath.startsWith(`${root}${path.sep}`);
  const filePath = isInsideRoot && fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()
    ? requestedPath
    : path.join(root, "index.html");
  if (!isInsideRoot && pathname.includes("..")) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Web asset not found");
    return true;
  }

  const type = contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
  res.end(fs.readFileSync(filePath));
  return true;
}
