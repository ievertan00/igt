import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { countHandbookPracticeQuestions, selectPracticeQuestions, decodePracticeQuestion } from "../lib/features/practice/question-bank.mjs";
import { matchesHandbookTarget } from "../lib/features/practice/handbook-targets.mjs";
import { insertPracticeAttempt, readHandbookPracticeEvidence } from "../lib/features/practice/attempts.mjs";
import { registerPracticeRoutes } from "../lib/server/routes/practice.mjs";
import { dispatch } from "../lib/server/router.mjs";

const db = new Database(":memory:");
test.after(() => db.close());
db.exec(`CREATE TABLE practice_questions (id TEXT PRIMARY KEY, prompt_zh TEXT, reference_answer TEXT,
  difficulty TEXT, context TEXT, practice_fields_json TEXT, hint_json TEXT, generated_by TEXT,
  served_count INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
  CREATE TABLE practice_attempts (id INTEGER PRIMARY KEY, activity_type TEXT, target_error_type TEXT,
    target_pattern TEXT, context_label TEXT, prompt TEXT, learner_answer TEXT, reference_answer TEXT,
    score INTEGER, feedback TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
const insert = db.prepare("INSERT INTO practice_questions (id,prompt_zh,reference_answer,difficulty,context,practice_fields_json,hint_json,generated_by,active) VALUES (?,?,?,?,?,?,?,?,?)");
for (const [id, difficulty, point, active] of [["article-easy", "easy", "Articles", 1], ["article-standard", "standard", "Articles", 1], ["article-hidden", "standard", "Articles", 0], ["distractor", "standard", "Word choice", 1]]) {
  insert.run(id, "请买一本书。", "Please buy a book.", difficulty, "shopping", JSON.stringify({ grammar_point: [point], register: ["neutral"] }), "{}", "test", active);
}
let llmCalls = 0;
let lastAttempt;
registerPracticeRoutes({
  getLLMManager: async () => ({ generateWithFallback: async () => {
    llmCalls++;
    return JSON.stringify({ score: 92, verdict: "excellent", corrected_answer: "Please buy a book.", feedback_zh: "表达清楚。", strengths_zh: [], improvements_zh: [] });
  } }),
  selectQuestions: (filters) => selectPracticeQuestions(db, filters),
  findQuestion: (id) => decodePracticeQuestion(db.prepare("SELECT * FROM practice_questions WHERE id = ?").get(id)),
  persistPracticeAttempt: async (attempt) => { lastAttempt = attempt; return insertPracticeAttempt(db, attempt); },
});
async function request(url, body) {
  let status, payload;
  await dispatch({ method: "POST", url, setTimeout() {}, on(event, fn) { if (event === "data") fn(JSON.stringify(body)); if (event === "end") fn(); } }, {
    setTimeout() {}, writeHead(value) { status = value; }, end(value) { payload = JSON.parse(value); },
  });
  return { status, payload };
}

test("availability only counts active metadata matches without changing usage", () => {
  const result = countHandbookPracticeQuestions(db, "Grammar / Article Usage");
  assert.equal(result.total, 2);
  assert.deepEqual(result.byDifficulty, { easy: 1, standard: 1 });
  assert.equal(db.prepare("SELECT sum(served_count) AS n FROM practice_questions").get().n, 0);
  assert.equal(countHandbookPracticeQuestions(db, "Grammar / Subject-Verb Agreement").status, "empty");
  assert.equal(countHandbookPracticeQuestions(db, "Mechanics / Spelling").status, "unsupported");
});

test("target selection intersects filters and never falls back to a distractor", async () => {
  const result = await request("/practice/generate", { targetErrorType: "Grammar / Article Usage", difficulty: "standard", count: 3 });
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload.data.questions.map((q) => q.id), ["article-standard"]);
  assert.equal(result.payload.data.questions[0].target_error_type, "Grammar / Article Usage");
  assert.equal(result.payload.data.questions[0].reference_answer, undefined);
  const none = await request("/practice/generate", { targetErrorType: "Grammar / Article Usage", difficulty: "challenge" });
  assert.deepEqual(none.payload.data.questions, []);
  const invalid = await request("/practice/generate", { targetErrorType: "unknown" });
  assert.equal(invalid.status, 400);
  assert.equal(llmCalls, 0);
});

test("targeted answers persist category and hints without legacy plan storage", async () => {
  const result = await request("/practice/evaluate", { question: { id: "article-standard", target_error_type: "Grammar / Article Usage" }, answer: "Please buy a book.", hints_used: 1 });
  assert.equal(result.status, 200);
  assert.equal(lastAttempt.targetErrorType, "Grammar / Article Usage");
  assert.equal(lastAttempt.feedback.hints_used, 1);
  assert.equal(lastAttempt.feedback.target_assessment, "not-assessed");
  const evidence = readHandbookPracticeEvidence(db, { days: 0, errorType: "Grammar / Article Usage" });
  assert.equal(evidence.attempts, 1);
  assert.equal(evidence.withoutHints, 0);
  assert.equal(evidence.latestScore, 92);
  assert.equal(readHandbookPracticeEvidence(db, { days: 0, errorType: "Vocabulary / Word Choice" }).attempts, 0);
});

test("tampering with a target is rejected using saved question metadata", async () => {
  const before = llmCalls;
  const result = await request("/practice/evaluate", { question: { id: "distractor", target_error_type: "Grammar / Article Usage", practice_fields: { grammar_point: ["Articles"] } }, answer: "Please buy a book." });
  assert.equal(result.status, 400);
  assert.equal(llmCalls, before);
  assert.equal(matchesHandbookTarget({ practice_fields: {} }, "Grammar / Article Usage"), false);
});
