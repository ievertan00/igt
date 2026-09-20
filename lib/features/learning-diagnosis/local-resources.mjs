import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const MAX_NOTE_BYTES = 512 * 1024;
const STOP_WORDS = new Set(["grammar", "usage", "error", "unknown", "the", "and", "or"]);

function termsFor(errorType, targetPattern) {
  return [...new Set(`${errorType || ""} ${targetPattern || ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term)))];
}

function markdownFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch { continue; }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(fullPath);
    }
  }
  return files;
}

export function findLocalLearningResources({ vaultDir, errorType = "", targetPattern = "", limit = 3 } = {}) {
  const root = vaultDir && (path.isAbsolute(vaultDir) ? vaultDir : path.resolve(PROJECT_ROOT, vaultDir));
  if (!root || !fs.existsSync(root)) return [];
  const terms = termsFor(errorType, targetPattern);
  if (!terms.length) return [];
  const candidates = [];
  for (const filePath of markdownFiles(root)) {
    let stat;
    try { stat = fs.statSync(filePath); }
    catch { continue; }
    if (stat.size > MAX_NOTE_BYTES) continue;
    let content;
    try { content = fs.readFileSync(filePath, "utf8").toLowerCase(); }
    catch { continue; }
    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    const searchable = `${relativePath.toLowerCase()}\n${content}`;
    const matchedTerms = terms.filter((term) => searchable.includes(term));
    if (!matchedTerms.length) continue;
    const phraseBonus = targetPattern && content.includes(String(targetPattern).toLowerCase()) ? 4 : 0;
    const score = matchedTerms.length * 2 + phraseBonus;
    candidates.push({
      score,
      resource: {
        kind: "local-note",
        title: relativePath,
        url: null,
        notePath: relativePath,
        action: `在 Obsidian 中打开 ${relativePath}，先读相关段落，再写一个不复用原例句的新句子。`,
        why: `匹配到 ${matchedTerms.join(", ")}，与 ${errorType || targetPattern} 直接相关。`,
        estimatedMinutes: 10,
        direction: "input-and-output",
        check: "用自己的话解释规则，并在新语境中正确使用一次。",
        verified: true,
        verificationSource: "local vault file",
      },
    });
  }
  return candidates
    .sort((a, b) => b.score - a.score || a.resource.title.localeCompare(b.resource.title))
    .slice(0, Math.min(10, Math.max(1, limit)))
    .map(({ resource }) => resource);
}
