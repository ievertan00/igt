import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { up as base } from "../migrations/021_sentence_question_bank.mjs";
import { up as seed } from "../migrations/022_practice_language_seeds.mjs";
import { up as removeOriginals } from "../migrations/023_remove_original_practice_questions.mjs";
import { LANGUAGE_FOCUSES, LANGUAGE_PRACTICE_QUESTIONS } from "../lib/features/practice/language-seeds.mjs";
import { selectPracticeQuestions, PRACTICE_CATEGORIES } from "../lib/features/practice/question-bank.mjs";

function up(db) { base(db); seed(db); }

test("original-question removal preserves the new bank, custom questions and usage, and is idempotent", () => {
  const db = new Database(":memory:");
  try {
    up(db);
    db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, style, context, focus, error_type, served_count)
      VALUES ('sentence-custom-1', '这是自定义的练习。', 'This is a custom exercise.', 'standard', 'neutral', 'everyday', 'Custom', 'Custom', 9)`).run();
    db.prepare("UPDATE practice_questions SET served_count = 4 WHERE id = 'language-g01.1-1'").run();
    const retained = db.prepare("SELECT * FROM practice_questions WHERE active = 1 ORDER BY id").all();
    removeOriginals(db);
    removeOriginals(db);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions").get().n, 304);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), retained);
  } finally { db.close(); }
});

test("seed covers every focus, three variants and protected progressive hints", () => {
  assert.equal(LANGUAGE_FOCUSES.length, 101);
  assert.equal(LANGUAGE_PRACTICE_QUESTIONS.length, 303);
  for (const focus of LANGUAGE_FOCUSES) {
    const questions = LANGUAGE_PRACTICE_QUESTIONS.filter(q => q.focus_id === focus.id);
    assert.equal(questions.length, 3, focus.id);
    assert.deepEqual(questions.map(q => q.variant), ["clear-cue", "contrast", "transfer"]);
    for (const q of questions) {
      assert.match(q.prompt_zh, /\p{Script=Han}/u);
      assert.doesNotMatch(q.reference_answer, /\p{Script=Han}/u);
      assert.equal(new Set(Object.values(q.hints)).size, 3);
      assert.match(q.hints.complete, /\[[^\]]+\]/);
      for (const hint of Object.values(q.hints)) assert.ok(!hint.includes(q.reference_answer), q.id);
      assert.ok(q.alternative_note.includes(q.hints.intermediate));
      assert.ok(PRACTICE_CATEGORIES.difficulty.includes(q.difficulty));
    }
  }
  for (const [key, total] of Object.entries({ purpose: 12, meaning_relationship: 10, register: 3, tone: 7, situation: 5, genre: 6 })) {
    assert.equal(new Set(LANGUAGE_PRACTICE_QUESTIONS.map(q => q.metadata[key])).size, total, key);
  }
});

test("migration is complete and idempotent without resetting legacy or new usage", () => {
  const db = new Database(":memory:");
  try {
    base(db);
    db.prepare("UPDATE practice_questions SET served_count = 7 WHERE id = 'sentence-easy-formal-4'").run();
    seed(db);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 1").get().n, 303);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 0").get().n, 81);
    let served = 7;
    for (const difficulty of PRACTICE_CATEGORIES.difficulty) for (const style of PRACTICE_CATEGORIES.style) for (const context of PRACTICE_CATEGORIES.context) {
      const questions = selectPracticeQuestions(db, { count: 10, difficulty, style, context });
      assert.ok(questions.length <= 10);
      served += questions.length;
      for (const q of questions) {
        assert.match(q.prompt_zh, /\p{Script=Han}/u);
        assert.doesNotMatch(q.reference_answer, /\p{Script=Han}/u);
        assert.equal(q.difficulty, difficulty); assert.equal(q.style, style); assert.equal(q.context, context);
        assert.ok(q.id.startsWith("language-"));
        assert.ok(q.hints.complete);
      }
    }
    up(db);
    assert.equal(db.prepare("SELECT SUM(served_count) AS n FROM practice_questions").get().n, served);
    assert.equal(db.prepare("SELECT served_count FROM practice_questions WHERE id = 'sentence-easy-formal-4'").get().served_count, 7);
  } finally { db.close(); }
});

test("questions remain unique within sessions and repeat only after less-used questions", () => {
  const db = new Database(":memory:");
  try {
    up(db);
    const seen = new Set();
    const available = db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 1 AND difficulty = 'standard'").get().n;
    for (let i = 0; i < available / 3; i++) {
      const questions = selectPracticeQuestions(db, { count: 3, difficulty: "standard" });
      assert.equal(new Set(questions.map(q => q.id)).size, 3);
      for (const q of questions) { assert.ok(!seen.has(q.id)); seen.add(q.id); }
    }
    assert.equal(seen.size, available);
    assert.equal(selectPracticeQuestions(db, { count: 3, difficulty: "standard" }).length, 3);
  } finally { db.close(); }
});
