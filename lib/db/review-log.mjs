import fs from "node:fs";
import path from "node:path";

const FORMAT_VERSION = 1;

function clean(value) {
  return String(value ?? "").trim();
}

function splitBody(value) {
  return clean(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function normalizeRemember(data) {
  const values = Array.isArray(data?.remember)
    ? data.remember
    : [data?.rule, data?.tip].flatMap((value) => Array.isArray(value) ? value : [value]);
  return values.map(clean).filter(Boolean);
}

function normalizeDiagnosis(item = {}) {
  return {
    error_type: clean(item.error_type || item.type || "Issue") || "Issue",
    scope: clean(item.scope || "sentence") || "sentence",
    severity: clean(item.severity || "Minor") || "Minor",
    evidence: clean(item.evidence),
    explanation: clean(item.explanation),
    suggestion: clean(item.suggestion),
  };
}

export function normalizeReviewResult(data = {}) {
  return {
    correction: clean(data.correction),
    refine: clean(data.refine),
    diagnoses: Array.isArray(data.diagnoses) ? data.diagnoses.map(normalizeDiagnosis) : [],
    remember: normalizeRemember(data),
  };
}

export function formatReviewEntry({ timestamp = new Date(), entryId, originalText, data }) {
  const ts = timestamp instanceof Date
    ? timestamp.toISOString().replace("T", " ").slice(0, 19)
    : clean(timestamp);
  const id = clean(entryId) || `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = normalizeReviewResult(data);
  const diagnoses = result.diagnoses.length
    ? result.diagnoses.map((item) => {
      const details = [
        item.scope ? `scope=${item.scope}` : "",
        item.evidence ? `evidence=${item.evidence}` : "",
        item.explanation,
        item.suggestion ? `Suggestion: ${item.suggestion}` : "",
      ].filter(Boolean).join("; ");
      return `- ${item.error_type} (${item.severity}): ${details}`;
    }).join("\n")
    : "- None";
  const remember = result.remember.length
    ? result.remember.map((item) => `- ${item}`).join("\n")
    : "- None";
  return [
    `### [${ts}]`,
    `**Entry ID**: ${id}`,
    `**Format**: ${FORMAT_VERSION}`,
    `**User Input**: ${clean(originalText)}`,
    "**Output**:",
    "**Correction**",
    result.correction || "None",
    "**Refine**",
    result.refine || "None",
    "**Diagnosis**",
    diagnoses,
    "**Remember**",
    remember,
    "",
    "---",
    "",
  ].join("\n");
}

function extractSection(block, name) {
  const start = block.indexOf(`**${name}**`);
  if (start < 0) return "";
  const contentStart = start + `**${name}**`.length;
  const nextHeader = block.slice(contentStart).search(/\n\*\*[A-Z][^\n]*\*\*/);
  const contentEnd = nextHeader < 0 ? block.length : contentStart + nextHeader;
  return block.slice(contentStart, contentEnd).replace(/^\s*:\s*/, "").trim();
}

export function parseReviewLog(content = "") {
  const entries = [];
  const pattern = /### \[([^\]]+)\]([\s\S]*?)(?=\n---\n### \[|\n---\s*$|$)/g;
  let match;
  while ((match = pattern.exec(String(content))) !== null) {
    const block = match[2];
    const original = block.match(/\*\*User Input\*\*:\s*([\s\S]*?)(?=\n\*\*|$)/)?.[1]?.trim() || "";
    if (!original) continue;
    const diagnoses = splitBody(extractSection(block, "Diagnosis"))
      .filter((line) => !/^[-*]\s*None$/i.test(line))
      .map((line) => {
        const text = line.replace(/^[-*]\s*/, "");
        const typed = text.match(/^(.+?)\s*\((Minor|Moderate|Major)\):\s*(.*)$/i);
        return normalizeDiagnosis({
          error_type: typed?.[1] || text,
          severity: typed?.[2] || "Minor",
          explanation: typed?.[3] || text,
        });
      });
    entries.push({
      entryId: block.match(/\*\*Entry ID\*\*:\s*(\S+)/)?.[1] || null,
      format: Number(block.match(/\*\*Format\*\*:\s*(\d+)/)?.[1] || 0) || null,
      timestamp: match[1].trim(),
      original_text: original,
      correction: clean(extractSection(block, "Correction")),
      refine: clean(extractSection(block, "Refine")),
      diagnoses,
      remember: splitBody(extractSection(block, "Remember")).map((line) => line.replace(/^[-*]\s*/, "")),
    });
  }
  return entries;
}

export function readReviewLog(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return parseReviewLog(fs.readFileSync(filePath, "utf8"));
}

export function appendReviewLog(filePath, { timestamp, entryId, originalText, data }) {
  if (!filePath) throw new Error("Review log path is not configured");
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const actualEntryId = clean(entryId) || `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  fs.appendFileSync(resolved, formatReviewEntry({ timestamp, entryId: actualEntryId, originalText, data }), "utf8");
  return { path: resolved, entryId: actualEntryId };
}

export { FORMAT_VERSION };
