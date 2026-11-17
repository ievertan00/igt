import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { runMigrations } from "../lib/db/migrations.mjs";
import { up } from "../migrations/002_retire_legacy_storage.mjs";
import { insertPracticeAttempt, readLearningPracticeAttempts } from "../lib/features/practice/attempts.mjs";
import { gradeVocabularyReview } from "../lib/application/vocabulary-review.mjs";

test("legacy Coach cleanup preserves evidence and scheduling and supports new reviews", async t => {
  const db = new Database(":memory:");
  t.after(() => db.close());
  db.pragma("foreign_keys = ON");
  await runMigrations(db, path.join(import.meta.dirname, "..", "migrations"));
  // Recreate the retired Coach storage on top of the baseline to simulate an
  // older database that still carries plans, tasks, quiz rows and the task link.
  db.exec(`CREATE TABLE learning_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT, goal TEXT NOT NULL, window_days INTEGER NOT NULL);
    CREATE TABLE learning_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES learning_plans(id) ON DELETE CASCADE,
      priority_index INTEGER NOT NULL, error_type TEXT NOT NULL, phase INTEGER NOT NULL,
      phase_name TEXT NOT NULL, task TEXT NOT NULL, check_text TEXT NOT NULL, scheduled_day INTEGER NOT NULL);
    CREATE TABLE quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, chinese TEXT NOT NULL, reference_answer TEXT NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE);
    ALTER TABLE practice_attempts ADD COLUMN learning_task_id INTEGER REFERENCES learning_tasks(id);
    CREATE INDEX idx_practice_attempts_task ON practice_attempts(learning_task_id);
    INSERT INTO learning_plans (id, goal, window_days) VALUES (1, 'Grammar', 14);
    INSERT INTO learning_tasks (id, plan_id, priority_index, error_type, phase, phase_name, task, check_text, scheduled_day)
      VALUES (1, 1, 0, 'Vocabulary', 2, 'Contrast', 'Recall', 'Check recall', 4);
    INSERT INTO quiz_questions (chinese, reference_answer, fingerprint) VALUES ('旧题', 'Old question', 'legacy');
    INSERT INTO practice_attempts (id, activity_type, target_error_type, prompt, learner_answer, reference_answer, score, feedback, learning_task_id)
      VALUES (20, 'practice-sentence', 'Vocabulary', '你好', 'Hello', 'Hello', 95, '{"source":"handbook"}', 1);
    INSERT INTO srs_cards (source_type, prompt, answer, word, due_date, ease, interval_days, total_reviews, correct_streak)
      VALUES ('vocab', 'hello', 'hello', 'hello', '2026-01-01', 2.8, 30, 10, 5);`);
  const { learning_task_id, ...originalAttempt } = db.prepare("SELECT * FROM practice_attempts").get();
  const originalCards = db.prepare("SELECT * FROM srs_cards").all();
  up(db);
  up(db);
  for (const name of ["learning_plans", "learning_tasks", "quiz_questions"]) {
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name = ?").get(name), undefined);
  }
  assert.deepEqual(db.prepare("SELECT * FROM practice_attempts").get(), originalAttempt);
  assert.deepEqual(db.prepare("SELECT * FROM srs_cards").all(), originalCards);
  assert.equal(readLearningPracticeAttempts(db, { days: 0 }).length, 1);
  const id = insertPracticeAttempt(db, { activityType: "practice-sentence", targetErrorType: "Grammar / Article Usage",
    prompt: "一本书", learnerAnswer: "a book", referenceAnswer: "a book", score: 100, feedback: {} });
  assert.ok(id > 20);
  const requestId = randomUUID();
  const result = gradeVocabularyReview(db, { cardId: 1, answer: "hello", rating: "good", requestId });
  assert.equal(result.correct, true);
  assert.equal(db.prepare("SELECT total_reviews FROM srs_cards WHERE id = 1").get().total_reviews, 11);
  assert.deepEqual(gradeVocabularyReview(db, { cardId: 1, answer: "hello", rating: "good", requestId }), result);
  assert.equal(db.prepare("SELECT count(*) AS n FROM practice_attempts").get().n, 3);
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
});