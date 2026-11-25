import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendReviewLog, formatReviewEntry, parseReviewLog } from "../lib/db/review-log.mjs";

describe("review log storage", () => {
  it("writes and parses the four-field asset format", () => {
    const content = formatReviewEntry({
      timestamp: "2026-09-20 12:00:00",
      entryId: "review-test-1",
      originalText: "I send it yesterday.",
      data: {
        correction: "I sent it yesterday.",
        refine: "I sent it over yesterday.",
        diagnoses: [{
          error_type: "Verb Tense",
          scope: "sentence",
          severity: "Major",
          evidence: "send",
          explanation: "The time marker refers to the past.",
          suggestion: "Use the simple past.",
        }],
        remember: "Match the verb tense to the time anchor.",
      },
    });
    const entries = parseReviewLog(content);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].entryId, "review-test-1");
    assert.equal(entries[0].correction, "I sent it yesterday.");
    assert.equal(entries[0].diagnoses[0].error_type, "Verb Tense");
    assert.match(entries[0].diagnoses[0].explanation, /past/);
    assert.equal(entries[0].remember, "Match the verb tense to the time anchor.");
    assert.match(content, /\*\*More natural\*\*/);
    assert.match(content, /\*\*Why\*\*/);
    assert.doesNotMatch(content, /\*\*Refine\*\*|\*\*Diagnosis\*\*/);
  });

  it("creates the parent directory and returns the generated entry id", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-review-log-"));
    const target = path.join(root, "nested", "00_Review_logs.md");
    try {
      const result = appendReviewLog(target, {
        originalText: "A sentence.",
        data: { correction: "A sentence.", diagnoses: [], remember: [] },
      });
      assert.ok(result.entryId.startsWith("review-"));
      assert.equal(parseReviewLog(fs.readFileSync(target, "utf8")).length, 1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps missing ids stable and does not deduplicate by timestamp", () => {
    const content = [
      "### [2026-09-20T12:00:00+08:00]",
      "**Format**: 1",
      "**User Input**: A sentence.",
      "**Output**:",
      "**Correction**",
      "A sentence.",
      "",
      "---",
      "### [2026-09-20T12:00:00+08:00]",
      "**Format**: 1",
      "**User Input**: Another sentence.",
      "**Output**:",
      "**Correction**",
      "Another sentence.",
    ].join("\n");
    const first = parseReviewLog(content);
    const second = parseReviewLog(content);
    assert.equal(first.length, 2);
    assert.equal(first[0].entryId, second[0].entryId);
    assert.equal(first[0].isDuplicate, false);
    assert.equal(first[1].isDuplicate, false);
  });

  it("identifies duplicate content across different timestamps and preserves unknown blocks", () => {
    const block = (timestamp) => [
      `### [${timestamp}]`,
      "**Entry ID**: review-test-duplicate-" + timestamp.slice(8, 10),
      "**Format**: 1",
      "**User Input**: A sentence.",
      "**Output**:",
      "**Correction**",
      "A sentence.",
      "**Custom note**",
      "Keep this note.",
    ].join("\n");
    const entries = parseReviewLog(`${block("2026-09-20T12:00:00+08:00")}\n---\n${block("2026-09-21T12:00:00+08:00")}`);
    assert.equal(entries.length, 2);
    assert.equal(entries[1].isDuplicate, true);
    assert.equal(entries[1].duplicateOf, entries[0].entryId);
    assert.match(entries[0].unknownBlocks[0].markdown, /Keep this note/);
  });
});
