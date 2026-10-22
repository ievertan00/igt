import test from "node:test";
import assert from "node:assert/strict";
import { buildHandbook } from "../lib/application/handbook.mjs";

const entry = (id, timestamp, type, text, explanation = "Use an article") => ({
  entryId: id, timestamp, userInput: text, correction: `${text} corrected`,
  remember: ["Keep the context"], diagnoses: [{ error_type: type, severity: "Major", explanation }],
});
const data = { totalInputs: 4, entries: [
  entry("old", "2026-09-01T12:00:00Z", "Articles", "I bought book."),
  entry("new", "2026-10-20T12:00:00Z", "Articles", "I read book."),
  entry("other", "2026-10-19T12:00:00Z", "Tense", "She goes.", "Past events"),
  entry("middle", "2026-10-10T12:00:00Z", "Articles", "A meeting."),
] };

test("handbook paginates newest first and preserves source identity", () => {
  const first = buildHandbook(data, { limit: 2 });
  assert.equal(first.pagination.total, 3);
  assert.equal(first.pagination.hasMore, true);
  assert.deepEqual(first.examples.map((row) => row.entryId), ["new", "middle"]);
  const last = buildHandbook(data, { limit: 2, offset: 2 });
  assert.equal(last.examples[0].entryId, "old");
  assert.equal(last.pagination.hasMore, false);
});

test("search spans all categories and fields without changing history totals", () => {
  const result = buildHandbook(data, { errorType: "Articles", search: "PAST EVENTS" });
  assert.equal(result.selected, "Tense");
  assert.equal(result.examples[0].entryId, "other");
  assert.equal(result.stats.total_diagnoses, 4);
  assert.equal(buildHandbook(data, { search: "corrected" }).pagination.total, 3);
  assert.equal(buildHandbook(data, { search: "context" }).frequencies.length, 2);
});

test("empty matches and invalid pagination remain usable", () => {
  const empty = buildHandbook(data, { search: "missing", offset: 100 });
  assert.equal(empty.selected, null);
  assert.deepEqual(empty.examples, []);
  assert.equal(empty.pagination.offset, 0);
  const result = buildHandbook(data, { limit: -3, offset: 999 });
  assert.equal(result.pagination.limit, 1);
  assert.equal(result.pagination.offset, 2);
  assert.equal(buildHandbook(data, { limit: "invalid" }).pagination.limit, 5);
});
