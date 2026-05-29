import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { parseDiagnosis } from "../lib/domain/parse-diagnosis.mjs";

const errorTypes = {
  classifyErrorType: (s) => s,
  getErrorTypePath: (s) => s,
  ERROR_TYPES: {},
};
const opts = { logPath: path.join(os.tmpdir(), "igt-test-parse.log") };

test("parses well-formed JSON response", () => {
  const raw = JSON.stringify({
    review: "Looks fine.",
    correction: "I am happy.",
    refine: "I'm happy.",
    diagnoses: [{ error_type: "Grammar / Verb Tense", severity: "Minor", explanation: "use am" }],
    rule: "Use am with I.",
    tip: "Practice this.",
  });
  const result = parseDiagnosis(raw, errorTypes, opts);
  assert.equal(result.correction, "I am happy.");
  assert.equal(result.diagnoses.length, 1);
});

test("strips fenced code block wrapping", () => {
  const raw = "```json\n" + JSON.stringify({ review: "x", correction: "y", refine: "", diagnoses: [], rule: "", tip: "" }) + "\n```";
  const result = parseDiagnosis(raw, errorTypes, opts);
  assert.equal(result.review, "x");
});

test("non-JSON falls back to review field", () => {
  const raw = "This is just plain text, no JSON here.";
  const result = parseDiagnosis(raw, errorTypes, opts);
  assert.ok(result.review.length > 0, "review should contain the raw text");
});

test("diagnosis with missing explanation falls back to the type label", () => {
  const raw = JSON.stringify({
    correction: "I am happy.",
    diagnoses: [{ error_type: "Grammar / Verb Tense", severity: "Minor" }],
  });
  const result = parseDiagnosis(raw, errorTypes, opts);
  assert.equal(result.diagnoses.length, 1);
  assert.equal(
    result.diagnoses[0].explanation,
    "Grammar / Verb Tense",
    "empty explanation should fall back to the canonical type label",
  );
});

test("diagnosis with whitespace-only explanation falls back to the type label", () => {
  const raw = JSON.stringify({
    correction: "I am happy.",
    diagnoses: [{ error_type: "Mechanics / Spelling", severity: "Minor", explanation: "   " }],
  });
  const result = parseDiagnosis(raw, errorTypes, opts);
  assert.equal(result.diagnoses[0].explanation, "Mechanics / Spelling");
});
