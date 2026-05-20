import fs from "node:fs";
import { colors, paint } from "../ui/index.mjs";

const SC = {
  review:     { h: colors.yellow,  b: colors.yellow },
  correction: { h: colors.green,   b: colors.green },
  refine:     { h: colors.cyan,    b: colors.cyan },
  diagnosis:  { h: colors.magenta, b: colors.magenta },
  rule:       { h: colors.blue,    b: colors.blue },
  tip:        { h: colors.cyan,    b: colors.cyan },
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

export function renderResponse(data) {
  emitSection("Review", "review", splitLines(data.review));
  emitSection("Correction", "correction", splitLines(data.correction));
  emitSection("Refine", "refine", splitLines(data.refine));
  if (Array.isArray(data.diagnoses) && data.diagnoses.length) {
    const lines = data.diagnoses.map(
      (d) => `- ${d.error_type || "Error"} (${d.severity || "Minor"}): ${d.explanation || ""}`,
    );
    emitSection("Diagnosis", "diagnosis", lines);
  }
  emitSection("Rule", "rule",
    splitLines(data.rule).map((s) => (s.startsWith("- ") ? s : `- ${s}`)));
  emitSection("Tip", "tip",
    splitLines(data.tip).map((s) => (s.startsWith("- ") ? s : `- ${s}`)));
}

export function dataToMarkdown(data) {
  const sections = [];
  const push = (label, body) => { if (body && body.trim()) sections.push(`**${label}**\n${body.trim()}`); };
  push("Review", data.review);
  push("Correction", data.correction);
  push("Refine", data.refine);
  if (Array.isArray(data.diagnoses) && data.diagnoses.length) {
    push("Diagnosis", data.diagnoses.map(
      (d) => `- ${d.error_type || "Error"} (${d.severity || "Minor"}): ${d.explanation || ""}`
    ).join("\n"));
  }
  if (data.rule) push("Rule", splitLines(data.rule).map((s) => (s.startsWith("- ") ? s : `- ${s}`)).join("\n"));
  if (data.tip) push("Tip", splitLines(data.tip).map((s) => (s.startsWith("- ") ? s : `- ${s}`)).join("\n"));
  return sections.join("\n\n");
}

export function logResult(targetPath, text, data) {
  if (!targetPath) return;
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const content = dataToMarkdown(data);
  try {
    fs.appendFileSync(targetPath,
      `\n### [${ts}]\n**User Input**: ${text}\n**Output**:\n${content}\n`,
      "utf8");
  } catch {
    process.stdout.write(paint(colors.yellow, "Warning: Could not log entry.\n"));
  }
}
