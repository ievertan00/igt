import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { formatReviewEntry, parseReviewLog } from "../lib/db/review-log.mjs";
import { saveGrammarReview } from "../lib/application/grammar.mjs";
import { buildGrammarHistory, getGrammarHistory } from "../lib/application/grammar-history.mjs";

const now = Date.parse("2026-10-30T12:00:00Z");
const serialize = (entryId, source, diagnoses = [], timestamp = "2026-10-29T12:00:00Z") => formatReviewEntry({
  entryId, source, timestamp, originalText: `Original ${entryId}`, data: { correction: `Corrected ${entryId}`, diagnoses, remember: "Keep context" },
});
const issue = { error_type: "Articles", severity: "Minor", explanation: "Use a determiner" };
const records = () => parseReviewLog([
  serialize("multiple", "grammar", [issue, issue]),
  serialize("clean", "grammar", [], "2026-10-30T10:00:00Z"),
  serialize("text", "text", [issue]),
  serialize("legacy", undefined, [issue]),
  serialize("old", "grammar", [issue], "2020-01-01T12:00:00Z"),
].join("\n"));

test("origin round-trips without relabeling legacy entries or changing their IDs", () => {
  const entries = records();
  assert.deepEqual(entries.map((entry) => entry.source), ["grammar", "grammar", "text", "unknown", "grammar"]);
  assert.equal(entries[3].entryId, "legacy");
  assert.equal(entries[0].unknownBlocks.some((block) => block.markdown.includes("**Source**")), false);
  const legacy = "### [2020-01-01T00:00:00Z]\n**User Input**: Old input\n**Output**:\n---\n";
  assert.equal(parseReviewLog(legacy)[0].entryId, parseReviewLog(legacy)[0].entryId);
  assert.equal(parseReviewLog(legacy)[0].source, "unknown");
  assert.throws(() => serialize("bad", "made-up"), /source/);
});

test("Grammar saves from the shared application service identify their origin", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "igt-grammar-history-"));
  try {
    const reviewPath = path.join(folder, "review.md");
    saveGrammarReview({ text: "A sentence.", data: { diagnoses: [] }, reviewPath });
    const entries = parseReviewLog(fs.readFileSync(reviewPath, "utf8"));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].source, "grammar");
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test("history includes whole Grammar checks newest first with honest source coverage", () => {
  const result = buildGrammarHistory(records(), {}, now);
  assert.deepEqual(result.entries.map((entry) => entry.entryId), ["clean", "multiple"]);
  assert.equal(result.entries[1].diagnoses.length, 2);
  assert.deepEqual(result.coverage, { grammar: 2, excludedOtherSources: 1, unclassified: 1, undated: 0 });
  assert.deepEqual(result.categories, [{ errorType: "Articles", checks: 1 }]);
});

test("no diagnosed mistakes filter composes with search, dates and pagination", () => {
  const result = buildGrammarHistory(records(), { diagnosis: "none", search: "CONTEXT", limit: 1 }, now);
  assert.deepEqual(result.entries.map((entry) => entry.entryId), ["clean"]);
  assert.equal(result.pagination.total, 1);
  assert.equal(result.pagination.hasMore, false);
  assert.equal(buildGrammarHistory(records(), { diagnosis: "none", search: "determiner" }, now).pagination.total, 0);
  assert.deepEqual(buildGrammarHistory(records(), { errorType: "Articles" }, now).entries.map((entry) => entry.entryId), ["multiple"]);
  assert.equal(buildGrammarHistory(records(), { diagnosis: "with", days: 0 }, now).pagination.total, 2);
  assert.equal(buildGrammarHistory(records(), { limit: 1, offset: 1 }, now).entries[0].entryId, "multiple");
  assert.equal(buildGrammarHistory(records(), { offset: 100 }, now).pagination.total, 2);
});

test("contradictory filters and invalid query values fail explicitly", () => {
  for (const options of [{ diagnosis: "none", errorType: "Articles" }, { diagnosis: "invalid" }, { limit: 0 }, { days: -1 }, { offset: 1.5 }, { search: "x".repeat(201) }]) {
    assert.throws(() => buildGrammarHistory(records(), options, now), { code: "INVALID_REQUEST", status: 400 });
  }
});

test("stable ordering, undated coverage, and injected reads do not mutate records", () => {
  const entries = records();
  entries.push({ entryId: "undated", source: "grammar", timestamp: "unknown", diagnoses: [] });
  const before = JSON.stringify(entries);
  const result = getGrammarHistory({ days: 0 }, { now, loadData: (days) => {
    assert.equal(days, 0);
    return { entries };
  } });
  assert.equal(result.coverage.undated, 1);
  assert.equal(result.entries.at(-1).entryId, "undated");
  assert.equal(JSON.stringify(entries), before);
  assert.equal(buildGrammarHistory(entries, { days: 90 }, now).entries.some((entry) => entry.entryId === "undated"), false);
});

test("window boundaries use the existing Review Log Beijing clock convention", () => {
  const entries = parseReviewLog([
    serialize("boundary", "grammar", [], "2026-10-29T12:00:00Z"),
    serialize("outside", "grammar", [], "2026-10-29T11:59:59Z"),
    serialize("future", "grammar", [], "2026-10-30T12:00:01Z"),
  ].join("\n"));
  assert.deepEqual(buildGrammarHistory(entries, { days: 1 }, now).entries.map((entry) => entry.entryId), ["boundary"]);
});
