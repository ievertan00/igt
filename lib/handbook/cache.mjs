import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");

function getCacheDir() {
  const dir = path.join(projectRoot, ".cache");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getCacheFilePath(errorType) {
  const safeName = errorType.replace(/[^a-zA-Z0-9]/g, "_");
  return path.join(getCacheDir(), `rule_${safeName}.json`);
}

export function loadCachedRule(errorType) {
  try {
    const f = getCacheFilePath(errorType);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {
    console.warn(`Warning: failed to load cache for ${errorType}: ${e.message}`);
  }
  return null;
}

export function saveCachedRule(errorType, hash, rule) {
  try {
    const f = getCacheFilePath(errorType);
    fs.writeFileSync(f, JSON.stringify({
      errorType, hash, generatedAt: new Date().toISOString(), rule,
    }, null, 2), "utf8");
  } catch (e) {
    console.warn(`Warning: failed to save cache for ${errorType}: ${e.message}`);
  }
}

export function hashExamples(examples) {
  const input = examples.map((ex) =>
    `${ex.original_text}|${ex.correction}|${ex.refine}|${ex.rule}|${ex.tip}`
  ).join("\n");
  return crypto.createHash("md5").update(input).digest("hex");
}

export function hasExamplesChanged(errorType, examples) {
  const cached = loadCachedRule(errorType);
  if (!cached) return true;
  return cached.hash !== hashExamples(examples);
}

export function clearCache() {
  const dir = path.join(projectRoot, ".cache");
  if (!fs.existsSync(dir)) return 0;
  let deleted = 0;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith("rule_") && file.endsWith(".json")) {
      fs.unlinkSync(path.join(dir, file));
      deleted++;
    }
  }
  return deleted;
}

export function cacheStats() {
  const dir = path.join(projectRoot, ".cache");
  if (!fs.existsSync(dir)) return { files: [], totalSize: 0 };
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("rule_") && f.endsWith(".json"));
  let totalSize = 0;
  const items = [];
  for (const file of files) {
    const fp = path.join(dir, file);
    totalSize += fs.statSync(fp).size;
    const data = JSON.parse(fs.readFileSync(fp, "utf8"));
    items.push({ errorType: data.errorType || file, generatedAt: data.generatedAt || "Unknown" });
  }
  return { files: items, totalSize };
}
