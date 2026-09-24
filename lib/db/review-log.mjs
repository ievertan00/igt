import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { beijingISO } from "../shared/timezone.mjs";

export const FORMAT_VERSION = 1;

function clean(value) {
  const result = String(value ?? "").trim();
  return result || null;
}

function lines(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeRemember(value) {
  if (Array.isArray(value)) return clean(value.map((item) => clean(item)).filter(Boolean).join("\n"));
  return clean(value);
}

function normalizeDiagnosis(item = {}) {
  return {
    error_type: clean(item.error_type || item.errorType || item.type) || "Issue",
    severity: clean(item.severity) || "Minor",
    evidence: clean(item.evidence),
    explanation: clean(item.explanation || item.reason) || "Issue requires review.",
    suggestion: clean(item.suggestion),
  };
}

export function normalizeReviewResult(data = {}) {
  return {
    correction: clean(data.correction),
    refine: clean(data.refine),
    diagnoses: Array.isArray(data.diagnoses) ? data.diagnoses.map(normalizeDiagnosis) : [],
    remember: normalizeRemember(data.remember),
  };
}

function timestampValue(timestamp = new Date()) {
  if (timestamp instanceof Date) return beijingISO(timestamp);
  const value = clean(timestamp);
  if (!value) return beijingISO();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? beijingISO(new Date(parsed)) : value;
}

function stableId(seed) {
  return `review-${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 20)}`;
}

function randomId() {
  return `review-${crypto.randomUUID()}`;
}

function meaningful(first, second) {
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  return normalize(first) && normalize(second) && normalize(first) !== normalize(second);
}

function diagnosisMarkdown(item) {
  const details = [
    item.evidence ? `Evidence: ${item.evidence}` : "",
    item.explanation,
    item.suggestion ? `Suggestion: ${item.suggestion}` : "",
  ].filter(Boolean).join("; ");
  return `- **${item.error_type}** (${item.severity}): ${details}`;
}

export function formatReviewEntry({ timestamp = new Date(), entryId, originalText, data }) {
  const result = normalizeReviewResult(data);
  const ts = timestampValue(timestamp);
  const id = clean(entryId) || randomId();
  const sections = [
    `### [${ts}]`,
    `**Entry ID**: ${id}`,
    `**Format**: ${FORMAT_VERSION}`,
    `**User Input**: ${String(originalText ?? "").trim()}`,
    "**Output**:",
  ];
  if (result.correction) sections.push("**Correction**", result.correction);
  if (meaningful(originalText, result.refine) && meaningful(result.correction || originalText, result.refine)) {
    sections.push("**More natural**", result.refine);
  }
  if (result.diagnoses.length) sections.push("**Why**", result.diagnoses.map(diagnosisMarkdown).join("\n"));
  if (result.remember) sections.push("**Remember**", result.remember);
  sections.push("", "---", "");
  return sections.join("\n");
}

function sectionRanges(block) {
  const header = /\*\*(Correction|More natural|Why|Remember)\*\*/g;
  const ranges = [];
  let match;
  while ((match = header.exec(block))) ranges.push({ name: match[1], start: match.index, contentStart: header.lastIndex });
  return ranges.map((range, index) => ({
    ...range,
    end: ranges[index + 1]?.start ?? block.length,
  }));
}

function extractSection(block, name) {
  const range = sectionRanges(block).find((item) => item.name === name);
  if (!range) return "";
  return block.slice(range.contentStart, range.end).replace(/^\s*:\s*/, "").trim();
}

function parseDiagnoses(value) {
  return lines(value)
    .filter((line) => !/^[-*]\s*(None|No specific errors identified)\.?$/i.test(line))
    .map((line) => {
      const text = line.replace(/^[-*]\s*/, "").replace(/^\*\*(.*?)\*\*/, "$1");
      const typed = text.match(/^(.+?)\s*\((Minor|Moderate|Major|Suggestion)\):\s*(.*)$/i);
      const explanation = typed?.[3] || text;
      return normalizeDiagnosis({
        error_type: typed?.[1] || text,
        severity: typed?.[2] || "Minor",
        explanation: explanation.replace(/\s+(Evidence|Suggestion):\s*.*$/i, "").trim(),
        evidence: explanation.match(/Evidence:\s*(.*?)(?=;\s*Suggestion:|$)/i)?.[1],
        suggestion: explanation.match(/Suggestion:\s*(.*)$/i)?.[1],
      });
    });
}

function parseUnknownBlocks(block) {
  const known = ["Entry ID", "Format", "User Input", "Output", "Correction", "More natural", "Why", "Remember"];
  const heading = /\*\*([^*]+)\*\*/g;
  const result = [];
  let match;
  while ((match = heading.exec(block))) {
    if (known.includes(match[1].trim())) continue;
    const end = block.indexOf("\n**", heading.lastIndex);
    result.push({ markdown: block.slice(match.index, end < 0 ? block.length : end).trim(), position: match.index });
  }
  return result;
}

function fingerprint(entry) {
  const canonical = JSON.stringify({
    userInput: entry.userInput,
    correction: entry.correction,
    refine: entry.refine,
    diagnoses: entry.diagnoses,
    remember: entry.remember,
  });
  return `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

export function parseReviewLog(content = "") {
  const entries = [];
  const pattern = /### \[([^\]]+)\]([\s\S]*?)(?=\n---\s*\n### \[|\n---\s*$|$)/g;
  let match;
  while ((match = pattern.exec(String(content))) !== null) {
    const block = match[2];
    const userInput = block.match(/\*\*User Input\*\*:\s*([\s\S]*?)(?=\n\*\*|$)/)?.[1]?.trim();
    if (!userInput) continue;
    const timestamp = match[1].trim();
    const entryId = block.match(/\*\*Entry ID\*\*:\s*(\S+)/)?.[1]
      || stableId(`${timestamp}\n${userInput}\n${block}`);
    const format = Number(block.match(/\*\*Format\*\*:\s*(\d+)/)?.[1] || 0) || null;
    const correction = clean(extractSection(block, "Correction"));
    const refine = clean(extractSection(block, "More natural"));
    const diagnoses = parseDiagnoses(extractSection(block, "Why"));
    const remember = clean(extractSection(block, "Remember"));
    const warnings = format && format !== FORMAT_VERSION
      ? [`Unknown Review log Format ${format}; parsed conservatively and preserved the raw block.`]
      : [];
    const entry = {
      entryId,
      format,
      formatSupported: !format || format === FORMAT_VERSION,
      timestamp,
      userInput,
      correction,
      refine: meaningful(correction || userInput, refine) ? refine : null,
      diagnoses,
      remember,
      unknownBlocks: parseUnknownBlocks(block),
      warnings,
      rawBlock: block,
    };
    entry.fingerprint = fingerprint(entry);
    entries.push(entry);
  }

  const firstByFingerprint = new Map();
  for (const entry of entries) {
    const first = firstByFingerprint.get(entry.fingerprint);
    entry.isDuplicate = Boolean(first);
    entry.duplicateOf = first?.entryId || null;
    if (!first) firstByFingerprint.set(entry.fingerprint, entry);
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
  const actualEntryId = clean(entryId) || randomId();
  fs.appendFileSync(resolved, formatReviewEntry({ timestamp, entryId: actualEntryId, originalText, data }), "utf8");
  return { path: resolved, entryId: actualEntryId };
}
