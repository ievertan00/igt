import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..", "..", "web");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

export function serveStatic(req, res) {
  if (req.method !== "GET") return false;
  const pathname = new URL(req.url, "http://127.0.0.1").pathname;
  if (pathname !== "/" && !pathname.startsWith("/assets/")) return false;

  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(webRoot, relative);
  if (!filePath.startsWith(`${webRoot}${path.sep}`) || !fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Web asset not found");
    return true;
  }

  const type = contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
  res.end(fs.readFileSync(filePath));
  return true;
}
