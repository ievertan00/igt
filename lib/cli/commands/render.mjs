import { colors, paint } from "../ui/index.mjs";
import { appendReviewLog } from "../../db/review-log.mjs";

const SC = {
  correction: { h: colors.green,   b: colors.green },
  refine:     { h: colors.cyan,    b: colors.cyan },
  diagnosis:  { h: colors.magenta, b: colors.magenta },
  remember:   { h: colors.blue,    b: colors.blue },
  evaluate:   { h: colors.gray,    b: colors.gray },
};

export function cols() {
  return Math.max(40, (process.stdout.columns || 80) - 1);
}

export function printLine(text, color) {
  const w = cols();
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const cand = line ? `${line} ${word}` : word;
    if (cand.length > w && line) {
      process.stdout.write(paint(color, line) + "\n");
      line = word;
    } else {
      line = cand;
    }
  }
  if (line) process.stdout.write(paint(color, line) + "\n");
}

function emitSection(label, key, lines) {
  if (!lines.length) return;
  const sc = SC[key];
  process.stdout.write("\n" + paint(sc.h, `**${label}**`) + "\n");
  for (const l of lines) printLine(l, sc.b);
}

function splitLines(value) {
  if (!value) return [];
  return String(value).split("\n").map((s) => s.trim()).filter(Boolean);
}

function meaningfullyDifferent(first, second) {
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  return normalize(first) && normalize(second) && normalize(first) !== normalize(second);
}

function shouldShowRefine(data) {
  return Boolean(data.refine) && (!data.correction || meaningfullyDifferent(data.correction, data.refine));
}

function diagnosisLines(diagnoses, { text = false } = {}) {
  if (!Array.isArray(diagnoses)) return [];
  return diagnoses.map((d) => {
    const scope = text && d.scope ? `[${d.scope}] ` : "";
    const evidence = text && d.evidence ? ` Evidence: “${d.evidence}”` : "";
    const suggestion = text && d.suggestion ? ` Suggestion: ${d.suggestion}` : "";
    return `- ${scope}${d.error_type || "Issue"} (${d.severity || "Minor"}): ${d.explanation || ""}${evidence}${suggestion}`;
  });
}

export function renderResponse(data) {
  renderTextResponse(data, { text: false });
}

export function renderTextResponse(data, { text = true } = {}) {
  emitSection("Evaluate", "evaluate", splitLines(data.evaluate));
  emitSection("Correction", "correction", splitLines(data.correction));
  if (shouldShowRefine(data)) {
    emitSection("More natural", "refine", splitLines(data.refine));
  }
  emitSection("Why", "diagnosis", diagnosisLines(data.diagnoses, { text }));
  const remember = Array.isArray(data.remember) ? data.remember : splitLines(data.remember);
  emitSection("Remember", "remember", remember.map((s) => `- ${s}`));
}

export function textDataToMarkdown(data, { text = true } = {}) {
  const sections = [];
  const push = (label, body) => { if (body && body.trim()) sections.push(`**${label}**\n${body.trim()}`); };
  push("Evaluate", data.evaluate);
  push("Correction", data.correction);
  if (shouldShowRefine(data)) push("More natural", data.refine);
  if (Array.isArray(data.diagnoses) && data.diagnoses.length) {
    push("Why", diagnosisLines(data.diagnoses, { text }).join("\n"));
  }
  const remember = Array.isArray(data.remember) ? data.remember : splitLines(data.remember);
  if (remember.length) {
    push("Remember", remember.map((item) => `- ${item}`).join("\n"));
  }
  return sections.join("\n\n");
}

export function dataToMarkdown(data) {
  return textDataToMarkdown(data, { text: false });
}

export function logResult(targetPath, text, data) {
  if (!targetPath) return;
  try {
    appendReviewLog(targetPath, { originalText: text, data });
  } catch {
    process.stdout.write(paint(colors.yellow, "Warning: Could not log entry.\n"));
  }
}
