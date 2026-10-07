import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import configLoader from "../lib/shared/config-loader.mjs";
import { appendReviewLog } from "../lib/db/review-log.mjs";
import { getQuizRecords } from "../lib/features/quiz/context.mjs";

test("practice context reads diagnoses from review log after legacy table cleanup", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-quiz-context-"));
  const reviewPath = path.join(root, "review.md");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.mock.method(configLoader, "load", () => ({ ReviewPath: reviewPath }));
  appendReviewLog(reviewPath, {
    originalText: "I have finished it yesterday.",
    data: {
      correction: "I finished it yesterday.",
      refine: "",
      diagnoses: [{ error_type: "Grammar / Verb Tense", severity: "Major", explanation: "Finished past time needs past tense.", suggestion: "Match the tense to yesterday." }],
      remember: ["Finished past time → simple past."],
    },
  });
  const records = getQuizRecords(30, 24);
  assert.equal(records.length, 1);
  assert.equal(records[0].error_type, "Grammar / Verb Tense");
  assert.deepEqual(records[0].rule, ["Finished past time → simple past."]);
});
