import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "../lib/db/migrations.mjs";
import { up as seedPracticeBank } from "../migrations/004_practice_question_bank.mjs";
import { CANONICAL_PRACTICE_QUESTIONS, practiceContent, restoreCanonicalQuestions } from "../lib/features/practice/canonical-bank.mjs";
import { SCHEMA_NATIVE_PRACTICE_QUESTIONS } from "../lib/features/practice/schema-native-seeds.mjs";
import { decodePracticeQuestion, publicPracticeQuestion } from "../lib/features/practice/question-bank.mjs";
import { LANGUAGE_FOCUSES, LANGUAGE_PRACTICE_QUESTIONS } from "../lib/features/practice/language-seeds.mjs";
import { selectPracticeQuestions, PRACTICE_CATEGORIES } from "../lib/features/practice/question-bank.mjs";

const migrationsDir = path.join(import.meta.dirname, "..", "migrations");
async function buildDb() {
  const db = new Database(":memory:");
  await runMigrations(db, migrationsDir);
  return db;
}

test("fresh migration chain produces the new schema and reruns without changes", async () => {
  const db = await buildDb();
  try {
    const actual = db.prepare("SELECT * FROM practice_questions ORDER BY id").all().map(practiceContent);
    const expected = CANONICAL_PRACTICE_QUESTIONS.map(practiceContent);
    // The export is the authoritative content source, so a fresh rebuild must
    // reproduce it exactly rather than merely approximate it.
    assert.deepEqual(actual, expected);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.deepEqual(await runMigrations(db, migrationsDir), []);
    assert.equal(selectPracticeQuestions(db, { count: 3 }).length, 3);
  } finally { db.close(); }
});

test("sparse and extensible multi-target questions work without legacy columns", async () => {
  const db = await buildDb();
  try {
    db.exec("UPDATE practice_questions SET active = 0");
    const fields = { clause_type: ["conditional", "relative"], voice: ["passive"], register: ["formal"], custom_dimension: ["contrast"] };
    db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json)
      VALUES ('sparse', '如果报告准备好了，就把它发给需要的人。', 'If the report is ready, send it to whoever needs it.', 'standard', 'work', ?)`).run(JSON.stringify(fields));
    const [question] = selectPracticeQuestions(db, { count: 1, style: "formal", context: "work" });
    assert.deepEqual(question.practice_fields, fields);
    assert.deepEqual(question.hints, {});
    assert.equal(question.practice_fields.tense_aspect, undefined);
    assert.equal(question.generated_by, "unknown");
    assert.equal(db.prepare("SELECT served_count FROM practice_questions WHERE id = 'sparse'").get().served_count, 1);
    assert.equal(selectPracticeQuestions(db, { count: 1, style: "casual" }).length, 0);
    for (const invalid of ['[]', 'null', 'broken']) {
      assert.throws(() => db.prepare("UPDATE practice_questions SET practice_fields_json = ? WHERE id = 'sparse'").run(invalid));
    }
  } finally { db.close(); }
});

test("100 native seeds provide sparse learning targets, progressive hints and both difficulty levels", () => {
  const rows = SCHEMA_NATIVE_PRACTICE_QUESTIONS;
  assert.equal(rows.length, 100);
  assert.equal(rows.filter(q => q.difficulty === "standard").length, 50);
  assert.equal(rows.filter(q => q.difficulty === "challenge").length, 50);
  assert.equal(new Set(rows.map(q => q.id)).size, 100);
  assert.equal(new Set(rows.map(q => q.prompt_zh)).size, 100);
  assert.equal(new Set(rows.map(q => q.reference_answer)).size, 100);
  const dimensions = new Set();
  for (const row of rows) {
    const question = decodePracticeQuestion(row);
    assert.match(row.prompt_zh, /\p{Script=Han}/u);
    assert.doesNotMatch(row.reference_answer, /\p{Script=Han}/u);
    assert.equal(row.generated_by, "codex");
    assert.equal(row.served_count, 0);
    assert.equal(row.active, 1);
    assert.equal(question.practice_fields._legacy, undefined);
    assert.ok(question.practice_fields.grammar_point.length);
    for (const [key, values] of Object.entries(question.practice_fields)) {
      dimensions.add(key);
      assert.ok(Array.isArray(values) && values.length > 0);
      assert.ok(values.every(value => typeof value === "string" && value.trim()));
    }
    assert.deepEqual(Object.keys(question.hints), ["simple", "intermediate", "complete"]);
    assert.equal(new Set(Object.values(question.hints)).size, 3);
    for (const hint of Object.values(question.hints)) {
      assert.match(hint, /\p{Script=Han}/u);
      assert.ok(!hint.includes(row.reference_answer));
    }
    // The complete hint exposes an open pattern, written as [ … ] or as an ellipsis.
    assert.ok(/\[[^\]]+\]/.test(question.hints.complete) || question.hints.complete.includes("..."), row.id);
  }
  for (const key of ["sentence_structure", "clause_type", "conjunction_type", "tense_aspect", "voice", "mood", "non_finite", "grammar_point"]) assert.ok(dimensions.has(key), key);
});

test("native selection respects the authoritative coverage without inventing missing combinations", async () => {
  const db = await buildDb();
  try {
    db.exec("DELETE FROM practice_questions");
    restoreCanonicalQuestions(db, SCHEMA_NATIVE_PRACTICE_QUESTIONS);
    for (const difficulty of ["standard", "challenge"]) for (const style of PRACTICE_CATEGORIES.style) for (const context of PRACTICE_CATEGORIES.context) {
      const selected = selectPracticeQuestions(db, { count: 1, difficulty, style, context });
      const expected = SCHEMA_NATIVE_PRACTICE_QUESTIONS.filter(row => {
        const q = decodePracticeQuestion(row);
        return q.difficulty === difficulty && q.style === style && q.context === context;
      });
      assert.equal(selected.length, Math.min(1, expected.length), `${difficulty}/${style}/${context}`);
      if (!selected.length) continue;
      assert.equal(selected[0].difficulty, difficulty);
      assert.equal(selected[0].style, style);
      assert.equal(selected[0].context, context);
      assert.ok(SCHEMA_NATIVE_PRACTICE_QUESTIONS.some(row => row.id === selected[0].id));
      assert.equal(publicPracticeQuestion(selected[0]).reference_answer, undefined);
    }
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
      assert.equal(q.alternative_note, "");
      assert.ok(PRACTICE_CATEGORIES.difficulty.includes(q.difficulty));
    }
  }
  for (const [key, total] of Object.entries({ register: 3, situation: 5 })) {
    assert.equal(new Set(LANGUAGE_PRACTICE_QUESTIONS.map(q => q.metadata[key])).size, total, key);
  }
  // Retired compatibility dimensions no longer ship with the bank.
  for (const key of ["purpose", "meaning_relationship", "tone", "genre"]) {
    assert.ok(LANGUAGE_PRACTICE_QUESTIONS.every(q => q.metadata[key] === undefined), key);
  }
});

test("bank seed is complete and idempotent without resetting usage", async () => {
  const db = await buildDb();
  try {
    const firstId = CANONICAL_PRACTICE_QUESTIONS[0].id;
    db.prepare("UPDATE practice_questions SET served_count = 7 WHERE id = ?").run(firstId);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 1").get().n, CANONICAL_PRACTICE_QUESTIONS.filter(row => row.active === 1).length);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 0").get().n, CANONICAL_PRACTICE_QUESTIONS.filter(row => row.active === 0).length);
    let served = 7;
    const canonicalIds = new Set(CANONICAL_PRACTICE_QUESTIONS.map(row => row.id));
    for (const difficulty of PRACTICE_CATEGORIES.difficulty) for (const style of PRACTICE_CATEGORIES.style) for (const context of PRACTICE_CATEGORIES.context) {
      const questions = selectPracticeQuestions(db, { count: 10, difficulty, style, context });
      assert.ok(questions.length <= 10);
      served += questions.length;
      for (const q of questions) {
        assert.match(q.prompt_zh, /\p{Script=Han}/u);
        assert.doesNotMatch(q.reference_answer, /\p{Script=Han}/u);
        assert.equal(q.difficulty, difficulty); assert.equal(q.style, style); assert.equal(q.context, context);
        assert.ok(canonicalIds.has(q.id));
        assert.ok(q.hints.complete);
      }
    }
    seedPracticeBank(db);
    assert.equal(db.prepare("SELECT SUM(served_count) AS n FROM practice_questions").get().n, served);
    assert.equal(db.prepare("SELECT served_count FROM practice_questions WHERE id = ?").get(firstId).served_count, 7);
  } finally { db.close(); }
});

test("questions remain unique within sessions and repeat only after less-used questions", async () => {
  const db = await buildDb();
  try {
    const seen = new Set();
    const available = db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 1 AND difficulty = 'standard'").get().n;
    for (let i = 0; i < Math.floor(available / 3); i++) {
      const questions = selectPracticeQuestions(db, { count: 3, difficulty: "standard" });
      assert.equal(new Set(questions.map(q => q.id)).size, 3);
      for (const q of questions) { assert.ok(!seen.has(q.id)); seen.add(q.id); }
    }
    const remainder = available % 3;
    if (remainder) {
      const questions = selectPracticeQuestions(db, { count: remainder, difficulty: "standard" });
      assert.equal(questions.length, remainder);
      for (const q of questions) { assert.ok(!seen.has(q.id)); seen.add(q.id); }
    }
    assert.equal(seen.size, available);
    assert.equal(selectPracticeQuestions(db, { count: 3, difficulty: "standard" }).length, 3);
  } finally { db.close(); }
});

test("authoritative restoration preserves existing content, activation and serving state", async () => {
  const db = await buildDb();
  try {
    const id = CANONICAL_PRACTICE_QUESTIONS[0].id;
    db.prepare("UPDATE practice_questions SET served_count = 17, active = 0 WHERE id = ?").run(id);
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    seedPracticeBank(db);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), before);
  } finally { db.close(); }
});

test("authoritative restoration rejects conflicting content without partial insertions", async () => {
  const db = await buildDb();
  try {
    db.prepare("DELETE FROM practice_questions WHERE id = ?").run(CANONICAL_PRACTICE_QUESTIONS[0].id);
    db.prepare("UPDATE practice_questions SET reference_answer = 'A deliberate live edit.' WHERE id = ?").run(CANONICAL_PRACTICE_QUESTIONS[1].id);
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.throws(() => seedPracticeBank(db), /Practice content conflict/);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), before);
  } finally { db.close(); }
});

test("restoration refuses to replace edited live provenance", async () => {
  const db = await buildDb();
  try {
    const row = CANONICAL_PRACTICE_QUESTIONS.find(row => row.generated_by !== "unknown");
    db.prepare("UPDATE practice_questions SET generated_by = 'unknown' WHERE id = ?").run(row.id);
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.throws(() => restoreCanonicalQuestions(db, [row]), /generated_by/);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), before);
  } finally { db.close(); }
});

test("the shipped bank carries no retired compatibility payload", () => {
  for (const row of CANONICAL_PRACTICE_QUESTIONS) {
    assert.equal(Object.hasOwn(JSON.parse(row.practice_fields_json), "_legacy"), false, row.id);
  }
});