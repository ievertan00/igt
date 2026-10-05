import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { up as base } from "../migrations/021_sentence_question_bank.mjs";
import { up as seed } from "../migrations/022_practice_language_seeds.mjs";
import { up as removeOriginals } from "../migrations/023_remove_original_practice_questions.mjs";
import { up as challenge } from "../migrations/024_practice_challenge_seeds.mjs";
import { up as restore } from "../migrations/038_restore_authoritative_practice_bank.mjs";
import { up as addEnrichmentPilot } from "../migrations/041_practice_enrichment_pilot.mjs";
import { up as secondReviewRevisions, PILOT_REVISIONS_043 } from "../migrations/043_practice_pilot_second_review_revisions.mjs";
import { up as addSecondBatch } from "../migrations/045_practice_social_restaurant_batch.mjs";
import { up as refineSecondBatch, PRACTICE_DRAFT_REVISIONS_046 } from "../migrations/046_refine_social_restaurant_drafts.mjs";
import { up as publishSecondBatch } from "../migrations/047_publish_approved_social_restaurant_batch.mjs";
import { up as addThirdBatch } from "../migrations/048_practice_shopping_entertainment_transit_batch.mjs";
import { up as refineThirdBatch } from "../migrations/049_reviewed_practice_prompt_refinements.mjs";
import { up as publishThirdBatch } from "../migrations/050_publish_approved_shopping_entertainment_transit.mjs";
import { up as refinePublishedThirdBatch } from "../migrations/051_refine_published_transit_card_prompt.mjs";
import { ENRICHMENT_PILOT_041 } from "../lib/features/practice/enrichment-pilot-041.mjs";
import { ENRICHMENT_PILOT_045 } from "../lib/features/practice/enrichment-pilot-045.mjs";
import { ENRICHMENT_PILOT_045_APPROVED } from "../lib/features/practice/enrichment-pilot-045.mjs";
import { ENRICHMENT_PILOT_048, ENRICHMENT_PILOT_048_APPROVED } from "../lib/features/practice/enrichment-pilot-048.mjs";
import { up as removeLegacy } from "../migrations/039_remove_practice_legacy.mjs";
import { up as correctContexts, CONTEXT_CORRECTIONS } from "../migrations/040_practice_context_semantic_corrections.mjs";
import { applyContextCorrections } from "../migrations/040_practice_context_semantic_corrections.mjs";
import { CANONICAL_PRACTICE_QUESTIONS, practiceContent, restoreCanonicalQuestions } from "../lib/features/practice/canonical-bank.mjs";
import { up as refactor } from "../migrations/036_practice_question_fields.mjs";
import { up as seedNative } from "../migrations/037_practice_schema_native_seeds.mjs";
import { SCHEMA_NATIVE_PRACTICE_QUESTIONS } from "../lib/features/practice/schema-native-seeds.mjs";
import path from "node:path";
import { runMigrations } from "../lib/db/migrations.mjs";
import { decodePracticeQuestion, publicPracticeQuestion } from "../lib/features/practice/question-bank.mjs";
import { inferPracticeSituation } from "../lib/features/practice/infer-situation.mjs";
import { LANGUAGE_FOCUSES, LANGUAGE_PRACTICE_QUESTIONS } from "../lib/features/practice/language-seeds.mjs";
import { selectPracticeQuestions, PRACTICE_CATEGORIES } from "../lib/features/practice/question-bank.mjs";

function legacyUp(db) { base(db); seed(db); removeOriginals(db); challenge(db); refactor(db); }
function up(db) { legacyUp(db); seedNative(db); restore(db); addEnrichmentPilot(db); }

test("schema refactor converts teaching dimensions without compatibility payload and preserves state", () => {
  const db = new Database(":memory:");
  try {
    base(db); seed(db);
    db.exec("ALTER TABLE practice_questions ADD COLUMN Generated_by TEXT");
    db.exec("UPDATE practice_questions SET served_count = 12, Generated_by = 'original-provider' WHERE id = 'language-g01.1-1'");
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    refactor(db);
    assert.deepEqual(db.pragma("table_info(practice_questions)").map(c => c.name), [
      "id", "prompt_zh", "reference_answer", "difficulty", "context", "practice_fields_json", "hint_json", "generated_by", "served_count", "active",
    ]);
    const after = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.equal(after.length, before.length);
    for (let i = 0; i < before.length; i++) {
      const old = before[i], row = after[i], decoded = decodePracticeQuestion(row);
      for (const key of ["id", "prompt_zh", "reference_answer", "difficulty", "served_count", "active"]) assert.equal(row[key], old[key]);
      assert.equal(row.context, inferPracticeSituation(old));
      for (const key of ["style", "focus"]) assert.equal(decoded[key], old[key]);
      for (const key of ["focus_id", "variant", "alternative_note"]) assert.equal(decoded[key], undefined);
      assert.deepEqual(decoded.hints, JSON.parse(old.hints_json));
      assert.deepEqual(decoded.metadata, { grammar_point: old.focus,
        register: old.style === "casual" ? "informal" : old.style, ...JSON.parse(old.metadata_json) });
      assert.equal(row.generated_by, old.Generated_by ?? "unknown");
      assert.deepEqual(decoded.practice_fields.grammar_point, [old.focus]);
      assert.equal(publicPracticeQuestion(decoded).practice_fields._legacy, undefined);
    }
    refactor(db);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), after);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
  } finally { db.close(); }
});

test("invalid legacy JSON rolls back the entire table replacement", () => {
  const db = new Database(":memory:");
  try {
    base(db); seed(db);
    db.exec("UPDATE practice_questions SET hints_json = 'broken' WHERE id = 'language-g01.1-1'");
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.throws(() => refactor(db));
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), before);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name = 'practice_questions_new'").get(), undefined);
  } finally { db.close(); }
});

test("sparse and extensible multi-target questions work without legacy columns", () => {
  const db = new Database(":memory:");
  try {
    up(db); refactor(db);
    db.exec("UPDATE practice_questions SET active = 0");
    const fields = { clause_type: ["conditional", "relative"], voice: ["passive"], register: ["formal"], custom_dimension: ["contrast"] };
    db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json)
      VALUES ('sparse', '如果报告准备好了，就把它发给需要的人。', 'If the report is ready, send it to whoever needs it.', 'standard', 'work-study', ?)`).run(JSON.stringify(fields));
    const [question] = selectPracticeQuestions(db, { count: 1, style: "formal", context: "work-study" });
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

test("fresh migration chain produces the new schema and reruns without changes", async () => {
  const db = new Database(":memory:");
  try {
    const dir = path.join(import.meta.dirname, "..", "migrations");
    await runMigrations(db, dir);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all().map(practiceContent), CANONICAL_PRACTICE_QUESTIONS.map(practiceContent));
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.deepEqual(await runMigrations(db, dir), []);
    assert.equal(selectPracticeQuestions(db, { count: 3 }).length, 3);
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
    assert.match(question.hints.complete, /\[[^\]]+\]/);
  }
  for (const key of ["sentence_structure", "clause_type", "conjunction_type", "tense_aspect", "voice", "mood", "non_finite", "grammar_point"]) assert.ok(dimensions.has(key), key);
});

test("native seed migration adds exactly 100 rows and preserves old rows and serving state on replay", () => {
  const db = new Database(":memory:");
  try {
    legacyUp(db);
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    seedNative(db);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions").get().n, before.length + 100);
    for (const row of before) assert.deepEqual(db.prepare("SELECT * FROM practice_questions WHERE id = ?").get(row.id), row);
    db.prepare("UPDATE practice_questions SET served_count = 8, active = 0 WHERE id = ?").run(SCHEMA_NATIVE_PRACTICE_QUESTIONS[0].id);
    const once = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    seedNative(db);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), once);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
  } finally { db.close(); }
});

test("native selection respects the authoritative coverage without inventing missing combinations", () => {
  const db = new Database(":memory:");
  try {
    legacyUp(db);
    db.exec("UPDATE practice_questions SET active = 0");
    seedNative(db);
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
      assert.ok(selected[0].id.startsWith("native-027-"));
      assert.equal(publicPracticeQuestion(selected[0]).reference_answer, undefined);
    }
  } finally { db.close(); }
});



test("original-question removal preserves the new bank, custom questions and usage, and is idempotent", () => {
  const db = new Database(":memory:");
  try {
    base(db); seed(db); challenge(db);
    db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, style, context, focus, error_type, served_count)
      VALUES ('sentence-custom-1', '这是自定义的练习。', 'This is a custom exercise.', 'standard', 'neutral', 'everyday', 'Custom', 'Custom', 9)`).run();
    db.prepare("UPDATE practice_questions SET served_count = 4 WHERE id = 'language-g01.1-1'").run();
    const retained = db.prepare("SELECT * FROM practice_questions WHERE active = 1 ORDER BY id").all();
    removeOriginals(db);
    removeOriginals(db);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions").get().n, 404);
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
      assert.equal(q.alternative_note, "");
      assert.ok(PRACTICE_CATEGORIES.difficulty.includes(q.difficulty));
    }
  }
  for (const [key, total] of Object.entries({ purpose: 12, meaning_relationship: 10, register: 3, tone: 7, situation: 5, genre: 6 })) {
    assert.equal(new Set(LANGUAGE_PRACTICE_QUESTIONS.map(q => q.metadata[key])).size, total, key);
  }
});

test("legacy payload removal preserves all other content and state and is idempotent", () => {
  const db = new Database(":memory:");
  try {
    up(db);
    const id = CANONICAL_PRACTICE_QUESTIONS[0].id;
    const row = db.prepare("SELECT * FROM practice_questions WHERE id = ?").get(id);
    const fields = JSON.parse(row.practice_fields_json);
    db.prepare("UPDATE practice_questions SET practice_fields_json = ?, served_count = 17, active = 0 WHERE id = ?")
      .run(JSON.stringify({ ...fields, _legacy: { style: "formal", alternative_note: "Retired guidance" } }), id);
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.equal(removeLegacy(db), 1);
    const expected = before.map(r => r.id === id ? { ...r, practice_fields_json: JSON.stringify(fields) } : r);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), expected);
    assert.equal(removeLegacy(db), 0);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), expected);
    for (const r of CANONICAL_PRACTICE_QUESTIONS) assert.equal(Object.hasOwn(JSON.parse(r.practice_fields_json), "_legacy"), false);
  } finally { db.close(); }
});

test("restoration upgrades databases with pre-cleanup JSON before comparing the clean export", () => {
  const db = new Database(":memory:");
  try {
    legacyUp(db); seedNative(db);
    const id = LANGUAGE_PRACTICE_QUESTIONS[0].id;
    const row = db.prepare("SELECT * FROM practice_questions WHERE id = ?").get(id);
    db.prepare("UPDATE practice_questions SET practice_fields_json = ?, served_count = 9 WHERE id = ?")
      .run(JSON.stringify({ ...JSON.parse(row.practice_fields_json), _legacy: { focus_id: "G01.1" } }), id);
    restore(db);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all().map(practiceContent), CANONICAL_PRACTICE_QUESTIONS.map(practiceContent));
    assert.equal(db.prepare("SELECT served_count FROM practice_questions WHERE id = ?").get(id).served_count, 9);
  } finally { db.close(); }
});

test("semantic context migration changes only reviewed labels and preserves usage on replay", () => {
  const db = new Database(":memory:");
  try {
    up(db);
    for (const c of CONTEXT_CORRECTIONS) db.prepare("UPDATE practice_questions SET context = ? WHERE id = ?").run(c.expected_context, c.id);
    db.prepare("UPDATE practice_questions SET served_count = 23, active = 0 WHERE id = ?").run(CONTEXT_CORRECTIONS[0].id);
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    const changes = new Map(CONTEXT_CORRECTIONS.map(c => [c.id, c.context]));
    assert.equal(correctContexts(db), 63);
    const after = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.deepEqual(after, before.map(row => changes.has(row.id) ? { ...row, context: changes.get(row.id) } : row));
    assert.equal(correctContexts(db), 0);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), after);
  } finally { db.close(); }
});

test("semantic context migration refuses newer labels or changed text without partial updates", () => {
  for (const conflict of ["text", "label", "missing"]) {
    const db = new Database(":memory:");
    try {
      up(db);
      for (const c of CONTEXT_CORRECTIONS) db.prepare("UPDATE practice_questions SET context = ? WHERE id = ?").run(c.expected_context, c.id);
      const c = CONTEXT_CORRECTIONS.at(-1);
      if (conflict === "text") db.prepare("UPDATE practice_questions SET prompt_zh = '这是一道后来编辑过的题。' WHERE id = ?").run(c.id);
      if (conflict === "label") db.prepare("UPDATE practice_questions SET context = 'health-pharmacy' WHERE id = ?").run(c.id);
      if (conflict === "missing") db.prepare("DELETE FROM practice_questions WHERE id = ?").run(c.id);
      const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
      assert.throws(() => correctContexts(db), /Practice context correction/);
      assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), before);
    } finally { db.close(); }
  }
});

test("migration is complete and idempotent without resetting legacy or new usage", () => {
  const db = new Database(":memory:");
  try {
    up(db);
    db.prepare("UPDATE practice_questions SET served_count = 7 WHERE id = 'language-g01.1-1'").run();
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 1").get().n, CANONICAL_PRACTICE_QUESTIONS.filter(row => row.active === 1).length);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 0").get().n, CANONICAL_PRACTICE_QUESTIONS.filter(row => row.active === 0).length);
    let served = 7;
    for (const difficulty of PRACTICE_CATEGORIES.difficulty) for (const style of PRACTICE_CATEGORIES.style) for (const context of PRACTICE_CATEGORIES.context) {
      const questions = selectPracticeQuestions(db, { count: 10, difficulty, style, context });
      assert.ok(questions.length <= 10);
      served += questions.length;
      for (const q of questions) {
        assert.match(q.prompt_zh, /\p{Script=Han}/u);
        assert.doesNotMatch(q.reference_answer, /\p{Script=Han}/u);
        assert.equal(q.difficulty, difficulty); assert.equal(q.style, style); assert.equal(q.context, context);
        assert.ok(q.id.startsWith("language-") || q.id.startsWith("native-027-") || q.id.startsWith("pilot-041-") || q.id.startsWith("pilot-045-") || q.id.startsWith("pilot-048-"));
        assert.ok(q.hints.complete);
      }
    }
    restore(db);
    assert.equal(db.prepare("SELECT SUM(served_count) AS n FROM practice_questions").get().n, served);
    assert.equal(db.prepare("SELECT served_count FROM practice_questions WHERE id = 'language-g01.1-1'").get().served_count, 7);
  } finally { db.close(); }
});

test("enrichment pilot adds only inactive rows and safely recognizes canonical restoration", () => {
  const db = new Database(":memory:");
  try {
    legacyUp(db);
    seedNative(db);
    removeLegacy(db);
    applyContextCorrections(db, { allowMissing: true });
    const pilotIds = new Set(ENRICHMENT_PILOT_041.map(row => row.id));
    restoreCanonicalQuestions(db, CANONICAL_PRACTICE_QUESTIONS.filter(row => !pilotIds.has(row.id)), { fillUnknownProvenance: true });
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.equal(addEnrichmentPilot(db), ENRICHMENT_PILOT_041.length);
    const staged = db.prepare("SELECT * FROM practice_questions WHERE id LIKE 'pilot-041-%' ORDER BY id").all();
    assert.equal(staged.length, ENRICHMENT_PILOT_041.length);
    assert.ok(staged.every(row => row.active === 0 && row.served_count === 0));
    assert.equal(addEnrichmentPilot(db), 0);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions WHERE id NOT LIKE 'pilot-041-%' ORDER BY id").all(), before);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 1").get().n,
      CANONICAL_PRACTICE_QUESTIONS.filter(row => row.active === 1 && !pilotIds.has(row.id)).length);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
  } finally { db.close(); }
});

test("second review updates staged pilot revisions atomically and idempotently", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`CREATE TABLE practice_questions (
      id TEXT PRIMARY KEY, prompt_zh TEXT NOT NULL UNIQUE, reference_answer TEXT NOT NULL,
      difficulty TEXT NOT NULL, context TEXT NOT NULL, practice_fields_json TEXT NOT NULL,
      hint_json TEXT NOT NULL, generated_by TEXT NOT NULL, served_count INTEGER NOT NULL,
      active INTEGER NOT NULL
    )`);
    const insert = db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json,
       hint_json, generated_by, served_count, active)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @context, @practice_fields_json,
       @hint_json, @generated_by, 0, 0)`);
    const candidates = new Map(ENRICHMENT_PILOT_041.map(row => [row.id, row]));
    for (const revision of PILOT_REVISIONS_043) {
      const row = { ...candidates.get(revision.id), ...revision.before };
      insert.run({
        id: row.id, prompt_zh: row.prompt_zh, reference_answer: row.reference_answer,
        difficulty: row.difficulty, context: row.context, practice_fields_json: row.practice_fields_json,
        hint_json: row.hint_json, generated_by: row.generated_by,
      });
    }

    assert.equal(secondReviewRevisions(db), PILOT_REVISIONS_043.length);
    for (const revision of PILOT_REVISIONS_043) {
      const row = db.prepare("SELECT * FROM practice_questions WHERE id = ?").get(revision.id);
      const candidate = candidates.get(revision.id);
      for (const key of ["prompt_zh", "reference_answer", "difficulty", "context", "practice_fields_json", "hint_json", "generated_by"]) assert.equal(row[key], candidate[key]);
      assert.equal(row.active, 0);
      assert.equal(row.served_count, 0);
    }
    assert.equal(secondReviewRevisions(db), 0);

    db.prepare("UPDATE practice_questions SET reference_answer = 'unexpected local edit' WHERE id = ?").run(PILOT_REVISIONS_043[0].id);
    const beforeConflict = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.throws(() => secondReviewRevisions(db), /Practice pilot revision content conflict/);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), beforeConflict);
  } finally { db.close(); }
});

test("second enrichment batch stages unique drafts and applies guarded refinements", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`CREATE TABLE practice_questions (
      id TEXT PRIMARY KEY, prompt_zh TEXT NOT NULL UNIQUE, reference_answer TEXT NOT NULL,
      difficulty TEXT NOT NULL, context TEXT NOT NULL, practice_fields_json TEXT NOT NULL,
      hint_json TEXT NOT NULL, generated_by TEXT NOT NULL, served_count INTEGER NOT NULL,
      active INTEGER NOT NULL
    )`);
    assert.equal(addSecondBatch(db), ENRICHMENT_PILOT_045.length);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 0 AND served_count = 0").get().n, 20);

    const updatePrior = db.prepare("UPDATE practice_questions SET prompt_zh = @prompt_zh, reference_answer = @reference_answer, practice_fields_json = @practice_fields_json, hint_json = @hint_json WHERE id = @id");
    const candidates = new Map(ENRICHMENT_PILOT_045.map(row => [row.id, row]));
    for (const revision of PRACTICE_DRAFT_REVISIONS_046) {
      updatePrior.run({ ...candidates.get(revision.id), ...revision.before, id: revision.id });
    }

    assert.equal(refineSecondBatch(db), PRACTICE_DRAFT_REVISIONS_046.length);
    for (const revision of PRACTICE_DRAFT_REVISIONS_046) {
      const row = db.prepare("SELECT * FROM practice_questions WHERE id = ?").get(revision.id);
      const candidate = candidates.get(revision.id);
      for (const key of ["prompt_zh", "reference_answer", "practice_fields_json", "hint_json"]) assert.equal(row[key], candidate[key]);
      assert.equal(row.active, 0);
      assert.equal(row.served_count, 0);
    }
    assert.equal(refineSecondBatch(db), 0);

    db.prepare("UPDATE practice_questions SET reference_answer = 'unexpected local edit' WHERE id = ?").run(PRACTICE_DRAFT_REVISIONS_046[0].id);
    const beforeConflict = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.throws(() => refineSecondBatch(db), /Practice draft revision content conflict/);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), beforeConflict);
  } finally { db.close(); }
});

test("approved social and restaurant batch publishes atomically and idempotently", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`CREATE TABLE practice_questions (
      id TEXT PRIMARY KEY, prompt_zh TEXT NOT NULL UNIQUE, reference_answer TEXT NOT NULL,
      difficulty TEXT NOT NULL, context TEXT NOT NULL, practice_fields_json TEXT NOT NULL,
      hint_json TEXT NOT NULL, generated_by TEXT NOT NULL, served_count INTEGER NOT NULL,
      active INTEGER NOT NULL
    )`);
    addSecondBatch(db);
    refineSecondBatch(db);
    db.prepare("UPDATE practice_questions SET served_count = 1 WHERE id = ?").run(ENRICHMENT_PILOT_045_APPROVED[0].id);
    assert.throws(() => publishSecondBatch(db), /content or usage conflict/);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 1").get().n, 0);

    db.prepare("UPDATE practice_questions SET served_count = 0 WHERE id = ?").run(ENRICHMENT_PILOT_045_APPROVED[0].id);
    assert.equal(publishSecondBatch(db), ENRICHMENT_PILOT_045_APPROVED.length);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 1 AND served_count = 0").get().n, 20);
    assert.equal(publishSecondBatch(db), 0);
  } finally { db.close(); }
});

test("third enrichment batch inserts unique inactive drafts idempotently", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`CREATE TABLE practice_questions (
      id TEXT PRIMARY KEY, prompt_zh TEXT NOT NULL UNIQUE, reference_answer TEXT NOT NULL,
      difficulty TEXT NOT NULL, context TEXT NOT NULL, practice_fields_json TEXT NOT NULL,
      hint_json TEXT NOT NULL, generated_by TEXT NOT NULL, served_count INTEGER NOT NULL,
      active INTEGER NOT NULL
    )`);
    assert.equal(addThirdBatch(db), ENRICHMENT_PILOT_048.length);
    assert.equal(ENRICHMENT_PILOT_048.length, 29);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 0 AND served_count = 0").get().n, 29);
    assert.equal(addThirdBatch(db), 0);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
  } finally { db.close(); }
});

test("delegated review refinements are guarded and the third batch publishes idempotently", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`CREATE TABLE practice_questions (
      id TEXT PRIMARY KEY, prompt_zh TEXT NOT NULL UNIQUE, reference_answer TEXT NOT NULL,
      difficulty TEXT NOT NULL, context TEXT NOT NULL, practice_fields_json TEXT NOT NULL,
      hint_json TEXT NOT NULL, generated_by TEXT NOT NULL, served_count INTEGER NOT NULL,
      active INTEGER NOT NULL
    )`);
    addThirdBatch(db);
    db.prepare("UPDATE practice_questions SET prompt_zh = ? WHERE id = ?")
      .run("请问纸巾在哪个货架？", "pilot-048-shopping-001");
    db.prepare("UPDATE practice_questions SET hint_json = ? WHERE id = ?")
      .run(JSON.stringify({ simple: "询问纸巾放在哪个货架。", intermediate: "用 Which aisle 开头询问所在的通道。", complete: "Which aisle are the [商品] in?" }), "pilot-048-shopping-001");
    db.prepare("UPDATE practice_questions SET prompt_zh = ? WHERE id = ?")
      .run("我上周在这里买的水壶打不开了，可以退货吗？", "pilot-048-shopping-009");
    assert.equal(refineThirdBatch(db), 2);
    assert.equal(refineThirdBatch(db), 0);
    assert.equal(publishThirdBatch(db), ENRICHMENT_PILOT_048_APPROVED.length);
    assert.equal(publishThirdBatch(db), 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE active = 1 AND served_count = 0").get().n, 29);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE prompt_zh = '请问厨房纸巾在哪个货架？'").get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM practice_questions WHERE prompt_zh = '我上周在这里买的电热水壶现在无法启动，可以退货吗？'").get().n, 1);
    assert.equal(addThirdBatch(db), 0); // Rebuilds from an export may restore these already-published rows first.
    db.prepare(`UPDATE practice_questions SET prompt_zh = ?, reference_answer = ?, practice_fields_json = ?, hint_json = ? WHERE id = ?`)
      .run(
        "我把公交卡落在家里了。",
        "I left my transit card at home.",
        JSON.stringify({ primary_target: ["report-missing-transit-card"], learning_goal: ["Report that a transit card was left at home."], learning_rationale: ["A direct problem report can prompt a practical discussion about paying or traveling."], register: ["neutral"], tense_aspect: ["past simple"], grammar_point: ["Leave something somewhere"] }),
        JSON.stringify({ simple: "说明公交卡忘在家里。", intermediate: "用 leave + 物品 + 地点说明东西落在哪里。", complete: "I left my [物品] at [地点]." }),
        "pilot-048-transit-007",
      );
    assert.equal(refinePublishedThirdBatch(db), 1);
    assert.equal(refinePublishedThirdBatch(db), 0);
    assert.equal(db.prepare("SELECT active FROM practice_questions WHERE id = 'pilot-048-transit-007'").get().active, 1);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
  } finally { db.close(); }
});

test("questions remain unique within sessions and repeat only after less-used questions", () => {
  const db = new Database(":memory:");
  try {
    up(db);
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

test("authoritative restoration preserves existing content, activation and serving state", () => {
  const db = new Database(":memory:");
  try {
    up(db);
    const id = CANONICAL_PRACTICE_QUESTIONS[0].id;
    db.prepare("UPDATE practice_questions SET served_count = 17, active = 0 WHERE id = ?").run(id);
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    restore(db);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), before);
  } finally { db.close(); }
});

test("authoritative restoration rejects conflicting content without partial insertions", () => {
  const db = new Database(":memory:");
  try {
    up(db);
    db.prepare("DELETE FROM practice_questions WHERE id = ?").run(CANONICAL_PRACTICE_QUESTIONS[0].id);
    db.prepare("UPDATE practice_questions SET reference_answer = 'A deliberate live edit.' WHERE id = ?").run(CANONICAL_PRACTICE_QUESTIONS[1].id);
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.throws(() => restore(db), /Practice content conflict/);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), before);
  } finally { db.close(); }
});

test("historical import commands refuse to replace edited live provenance", () => {
  const db = new Database(":memory:");
  try {
    up(db);
    const row = CANONICAL_PRACTICE_QUESTIONS.find(row => row.generated_by !== "unknown");
    db.prepare("UPDATE practice_questions SET generated_by = 'unknown' WHERE id = ?").run(row.id);
    const before = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    assert.throws(() => restoreCanonicalQuestions(db, [row]), /generated_by/);
    assert.deepEqual(db.prepare("SELECT * FROM practice_questions ORDER BY id").all(), before);
  } finally { db.close(); }
});
