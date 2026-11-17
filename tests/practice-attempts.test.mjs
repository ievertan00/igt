import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "../lib/db/migrations.mjs";
import { insertPracticeAttempt } from "../lib/features/practice/attempts.mjs";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("practice attempts are persisted with target and feedback evidence", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-attempts-"));
  const db = new Database(path.join(root, "test.db"));
  try {
    await runMigrations(db, path.join(projectRoot, "migrations"));
    const id = insertPracticeAttempt(db, {
      activityType: "quiz",
      targetErrorType: "Grammar / Verb Tense",
      targetPattern: "past vs present perfect",
      contextLabel: "work-email",
      prompt: "我昨天完成了报告。",
      learnerAnswer: "I have finished the report yesterday.",
      referenceAnswer: "I finished the report yesterday.",
      score: 62,
      feedback: { feedback_zh: "时间标记与时态不一致。", improvements_zh: ["注意 yesterday"] },
    });

    const row = db.prepare("SELECT * FROM practice_attempts WHERE id = ?").get(id);
    assert.equal(row.activity_type, "quiz");
    assert.equal(row.target_error_type, "Grammar / Verb Tense");
    assert.equal(row.context_label, "work");
    assert.equal(row.score, 62);
    assert.deepEqual(JSON.parse(row.feedback), { feedback_zh: "时间标记与时态不一致。", improvements_zh: ["注意 yesterday"] });
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("practice attempts reject unknown production contexts but preserve internal activity labels", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-attempt-context-"));
  const db = new Database(path.join(root, "test.db"));
  try {
    await runMigrations(db, path.join(projectRoot, "migrations"));
    const unknownId = insertPracticeAttempt(db, {
      activityType: "practice-sentence",
      contextLabel: "daily-story",
      prompt: "请描述今天的安排。",
      learnerAnswer: "I have plans today.",
      referenceAnswer: "I have plans today.",
      score: 80,
      feedback: {},
    });
    const internalId = insertPracticeAttempt(db, {
      activityType: "drill",
      contextLabel: "drill:b1",
      prompt: "请描述今天的安排。",
      learnerAnswer: "I have plans today.",
      referenceAnswer: "I have plans today.",
      score: 80,
      feedback: {},
    });
    const situationId = insertPracticeAttempt(db, {
      activityType: "practice-sentence",
      contextLabel: "restaurants-cafes",
      prompt: "请问这家餐厅几点关门？",
      learnerAnswer: "What time does this restaurant close?",
      referenceAnswer: "What time does this restaurant close?",
      score: 90,
      feedback: {},
    });
    assert.equal(db.prepare("SELECT context_label FROM practice_attempts WHERE id = ?").get(unknownId).context_label, null);
    assert.equal(db.prepare("SELECT context_label FROM practice_attempts WHERE id = ?").get(internalId).context_label, "drill:b1");
    assert.equal(db.prepare("SELECT context_label FROM practice_attempts WHERE id = ?").get(situationId).context_label, "dining");
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
