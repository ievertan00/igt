import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendPracticeLog } from "../lib/application/practice.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-practice-log-"));
const target = path.join(root, "02_Practice_Log.md");
try {
  const result = appendPracticeLog({
    config: { PracticePath: target },
    attempt: {
      activityType: "practice-sentence",
      contextLabel: "work update",
      prompt: "请说明截止日期",
      learnerAnswer: "Please clarify the deadline.",
      referenceAnswer: "Could you clarify the deadline?",
      score: 82,
      feedback: { feedback_zh: "表达清楚，可以继续练习语气。" }
    }
  });
  assert.equal(result.saved, true);
  const markdown = fs.readFileSync(target, "utf8");
  assert.match(markdown, /Please clarify the deadline\./);
  assert.match(markdown, /Could you clarify the deadline\?/);
  assert.match(markdown, /Score: 82/);
  console.log("practice log smoke ok");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
