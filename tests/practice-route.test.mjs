import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { up } from "../migrations/021_sentence_question_bank.mjs";
import { up as seed } from "../migrations/022_practice_language_seeds.mjs";
import { selectPracticeQuestions, decodePracticeQuestion } from "../lib/features/practice/question-bank.mjs";
import { registerPracticeRoutes } from "../lib/server/routes/practice.mjs";
import { dispatch } from "../lib/server/router.mjs";

const db = new Database(":memory:");
up(db);
seed(db);
const attempts = [];
let llmCalls = 0;
let lastInput;
let providerFails = false;
registerPracticeRoutes({
  selectQuestions: filters => selectPracticeQuestions(db, filters),
  findQuestion: id => decodePracticeQuestion(db.prepare("SELECT *, 'sentence' AS kind FROM practice_questions WHERE id = ?").get(id)),
  getLLMManager: async () => {
    llmCalls++;
    if (providerFails) throw new Error("Provider unavailable");
    return { generateWithFallback: async input => {
      lastInput = JSON.parse(input);
      return JSON.stringify({ score: 74, verdict: "needs_work", corrected_answer: lastInput.reference_answer,
        feedback_zh: "检查时间和语气。", strengths_zh: ["意思清楚"], improvements_zh: ["检查时间标记"] });
    } };
  },
  persistPracticeAttempt: async attempt => { attempts.push(attempt); return attempts.length; },
  appendPracticeLog: async () => { throw new Error("Log unavailable"); },
});

async function request(url, body) {
  let status, payload;
  const req = { method: "POST", url, setTimeout() {}, on(event, cb) {
    if (event === "data") cb(JSON.stringify(body)); if (event === "end") cb();
  } };
  await dispatch(req, { setTimeout() {}, writeHead(value) { status = value; }, end(value) { payload = JSON.parse(value); } });
  return { status, body: payload };
}

test("bank selection needs no LLM or learner history and hides references", async () => {
  const before = llmCalls;
  const result = await request("/practice/generate", { count: 10, difficulty: "standard", style: "formal", context: "work" });
  assert.equal(result.status, 200); assert.ok(result.body.data.questions.length > 0); assert.ok(result.body.data.questions.length <= 10);
  assert.equal(result.body.data.requested_count, 10); assert.equal(llmCalls, before);
  for (const q of result.body.data.questions) {
    assert.equal(q.kind, "sentence"); assert.equal(q.style, "formal"); assert.equal(q.context, "work");
    assert.equal(q.reference_answer, undefined);
    assert.equal(q.alternative_note, undefined);
    assert.equal(q.hints_json, undefined);
    assert.equal(q.served_count, undefined);
    assert.ok(q.hints.complete); assert.ok(q.metadata.situation);
  }
});

test("hint usage and language categories survive evaluation without imposing reference wording", async () => {
  const question = { id: "language-g08.5-3" };
  const result = await request("/practice/evaluate", { question, answer: "I remembered that I had locked the door, but checked anyway.", hints_used: 2 });
  assert.equal(result.status, 200);
  assert.equal(attempts.at(-1).feedback.hints_used, 2);
  assert.equal(attempts.at(-1).feedback.focus_id, "G08.5");
  assert.equal(lastInput.language_categories.situation, "daily-life");
  assert.match(lastInput.alternative_guidance, /Equivalent|equivalent/);
  const before = llmCalls;
  for (const hints_used of [-1, 4, 1.5, "2"]) assert.equal((await request("/practice/evaluate", { question, answer: "Hello", hints_used })).status, 400);
  assert.equal(llmCalls, before);
});

test("removed modes and invalid filters are rejected before provider access", async () => {
  for (const body of [{ mode: "word" }, { mode: "choice" }, { count: 11 }, { count: 1.5 }, { style: "invented" }, { context: "unknown" }, { difficulty: "hard" }]) {
    assert.equal((await request("/practice/generate", body)).status, 400);
  }
});

test("evaluation resolves bank content and records result and categories", async () => {
  const question = { id: "sentence-easy-formal-4", prompt_zh: "tampered", reference_answer: "tampered" };
  const result = await request("/practice/evaluate", { question, answer: "Please confirm meeting time." });
  assert.equal(result.status, 200); assert.equal(result.body.data.score, 74);
  assert.equal(lastInput.chinese_prompt, "请确认会议时间。");
  assert.equal(lastInput.reference_answer, "Please confirm the meeting time.");
  assert.equal(lastInput.style, "formal");
  assert.equal(result.body.data.reference_answer, lastInput.reference_answer);
  assert.equal(attempts.at(-1).activityType, "practice-sentence");
  assert.equal(attempts.at(-1).contextLabel, "work");
  assert.equal(attempts.at(-1).feedback.question_id, question.id);
  assert.equal(attempts.at(-1).feedback.difficulty, "easy");
  assert.equal(result.body.persistence.saved, false);
});

test("missing answers and unknown IDs never reach the LLM", async () => {
  const before = llmCalls;
  for (const body of [{ question: { id: "unknown" }, answer: "Hi" }, { question: { id: "sentence-easy-formal-4" }, answer: "  " }, { question: { kind: "choice" }, answer: "A" }]) {
    assert.equal((await request("/practice/evaluate", body)).status, 400);
  }
  assert.equal(llmCalls, before);
});

test("provider errors leave attempts untouched and selection remains available", async () => {
  providerFails = true;
  const before = attempts.length;
  const result = await request("/practice/evaluate", { question: { id: "sentence-easy-formal-4" }, answer: "Hello" });
  assert.equal(result.status, 500); assert.equal(attempts.length, before);
  assert.equal((await request("/practice/generate", { count: 3 })).status, 200);
  providerFails = false;
});
