import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { up } from "../migrations/063_remove_legacy_coach_storage.mjs";
import { insertPracticeAttempt, readLearningPracticeAttempts } from "../lib/features/practice/attempts.mjs";
import { gradeVocabularyReview } from "../lib/application/vocabulary-review.mjs";

test("legacy Coach cleanup preserves evidence and scheduling and supports new reviews", t => {
  const db = new Database(":memory:");
  t.after(() => db.close());
  db.pragma("foreign_keys = ON");
  for (const file of ["001_initial_schema.sql", "007_quiz_questions.sql", "009_practice_attempts.sql", "010_practice_context.sql", "011_learning_plans.sql", "012_practice_task_link.sql", "015_learning_plan_pause.sql"]) {
    db.exec(fs.readFileSync(path.join(import.meta.dirname, "..", "migrations", file), "utf8"));
  }
  db.exec(`INSERT INTO learning_plans (id, goal, window_days) VALUES (1, 'Grammar', 14);
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
