import fs from "node:fs";
import { createHash } from "node:crypto";
import configLoader from "../shared/config-loader.mjs";
import { getReviewLearningData } from "../db/review-stats.mjs";
import { resolvePracticePath } from "./practice.mjs";

// Read the Markdown learning record directly; never rebuild it from question seeds or scores.
export function parseCoachPracticeLog(markdown) {
  return String(markdown).replace(/\r\n?/g, "\n").split(/(?=^## Practice · )/m).flatMap((block, index) => {
    const heading = block.match(/^## Practice · ([^\n]+)\n/);
    if (!heading) return [];
    const fields = new Map();
    let current;
    for (const line of block.slice(heading[0].length).split("\n")) {
      const field = line.match(/^- (Mode|Context|Prompt|Your answer|Reference answer|Score|Feedback|Question|Difficulty|Style|Language focus|Hints used|Handbook target|Evidence):\s*(.*)$/);
      if (field) { current = field[1]; fields.set(current, field[2]); }
      else if (current) fields.set(current, `${fields.get(current)}\n${line}`.trimEnd());
    }
    const original = fields.get("Your answer")?.trim();
    if (!original) return [];
    const hints = fields.get("Hints used")?.match(/^(\d+)\s*\/\s*\d+$/);
    return [{ source: "practice", entryId: `practice-log-${createHash("sha256").update(`${index}\n${block.trim()}`).digest("hex").slice(0, 24)}`,
      timestamp: heading[1].trim(), userInput: original, correction: "", diagnoses: [],
      practice: { mode: fields.get("Mode") || "unknown", context: fields.get("Context") || "",
        prompt: fields.get("Prompt") || "", referenceAnswer: fields.get("Reference answer") || "",
        feedback: fields.get("Feedback") || "", hintsUsed: hints ? Number(hints[1]) : null,
        question: fields.get("Question") || "", difficulty: fields.get("Difficulty") || "",
        style: fields.get("Style") || "", languageFocus: fields.get("Language focus") || "" },
    }];
  });
}

export function loadCoachReportData(_days = 0, { config = configLoader.load(), readReviews = getReviewLearningData, readFile = fs.readFileSync } = {}) {
  let reviews = { entries: [] }, grammarStatus = "available";
  try { reviews = readReviews(0); }
  catch { grammarStatus = "unavailable"; }
  let practiceEntries = [], status = "available";
  try { practiceEntries = parseCoachPracticeLog(readFile(resolvePracticePath(config), "utf8")); }
  catch (error) { status = error.code === "ENOENT" ? "missing" : "unavailable"; }
  return { ...reviews, entries: [...reviews.entries, ...practiceEntries],
    sourceStatus: { grammar: grammarStatus, practice: status } };
}
