import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { gradeVocabularyReview } from "../lib/application/vocabulary-review.mjs";
import { saveAsk } from "../lib/application/ask.mjs";
import { listAskNotes } from "../lib/application/ask-notes.mjs";
import { registerAskRoutes } from "../lib/server/routes/ask.mjs";
import { dispatch } from "../lib/server/router.mjs";
import * as history from "../lib/features/ask/history.mjs";

function reviewDb(t) {
  const db = new Database(":memory:");
  t.after(() => db.close());
  for (const name of ["001_initial_schema.sql", "009_practice_attempts.sql", "010_practice_context.sql", "011_learning_plans.sql", "012_practice_task_link.sql", "015_learning_plan_pause.sql"]) {
    db.exec(fs.readFileSync(path.join(process.cwd(), "migrations", name), "utf8"));
  }
  db.prepare("INSERT INTO srs_cards (source_type,prompt,answer,word,due_date) VALUES ('vocab','follow up','follow up','follow up','2026-01-01')").run();
  return db;
}
function notes(t) {
  const parent = path.join(process.cwd(), ".cache");
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, "parity-test-"));
  t.after(() => { assert.equal(path.dirname(dir), parent); fs.rmSync(dir, { recursive: true, force: true }); });
  return dir;
}
const turn = (answer = "Use the past simple.") => ({ question: "Tense question?", title: "Tense", answer, related: ["Why?"] });

test("typed recall shares CLI spelling policy, atomic evidence and retry identity", (t) => {
  const db = reviewDb(t);
  const request = { cardId: 1, answer: "FOLLOW-UP", requestId: randomUUID(), audioPlayed: true };
  const result = gradeVocabularyReview(db, request);
  assert.equal(result.correct, true);
  assert.deepEqual(gradeVocabularyReview(db, request), result);
  assert.equal(db.prepare("SELECT total_reviews FROM srs_cards").get().total_reviews, 1);
  const row = db.prepare("SELECT * FROM practice_attempts").get();
  assert.equal(row.learner_answer, "FOLLOW-UP");
  assert.equal(row.activity_type, "review-vocabulary");
  assert.equal(row.score, 100);
  assert.equal(JSON.parse(row.feedback).audioPlayed, true);
  assert.throws(() => gradeVocabularyReview(db, { ...request, answer: "another" }), /different answer/);
});
test("blank recall is incorrect; failed evidence rolls back scheduling", (t) => {
  const db = reviewDb(t);
  const result = gradeVocabularyReview(db, { cardId: 1, answer: "", requestId: randomUUID() });
  assert.equal(result.correct, false);
  assert.equal(result.next.intervalDays, 1);
  assert.equal(db.prepare("SELECT learner_answer FROM practice_attempts").get().learner_answer, "(blank)");
  db.exec("CREATE TRIGGER fail_evidence BEFORE INSERT ON practice_attempts BEGIN SELECT RAISE(ABORT, 'cannot save evidence'); END;");
  assert.throws(() => gradeVocabularyReview(db, { cardId: 1, answer: "follow up", requestId: randomUUID() }), /cannot save evidence/);
  assert.equal(db.prepare("SELECT total_reviews FROM srs_cards").get().total_reviews, 1);
});
test("single-answer saves match CLI and Web, share location and survive retries", async (t) => {
  const dir = notes(t);
  const config = { AskPath: dir, AskDir: path.join(dir, "old") };
  const message = turn();
  const web = await saveAsk({ messages: [message], config, getLLMManager: () => { throw new Error("must not initialize"); } });
  history.append("parity", { ...message, response: message });
  const cli = await saveAsk({ sessionId: "parity", config });
  assert.equal(cli.vaultFile, web.vaultFile);
  assert.equal(history.get("parity").length, 0);
  const library = listAskNotes(config);
  assert.equal(library.notes.length, 1);
  assert.match(library.notes[0].content, /Use the past simple/);
  assert.doesNotMatch(library.notes[0].content, /\*\*Q:\*\*/);
});
test("both clients summarize all turns once and preserve different notes with the same title", async (t) => {
  const config = { AskDir: notes(t), Prompts: { AskCompactPrompt: "Combine this consultation." } };
  let calls = 0;
  const llm = { generateWithFallback: async (input, prompt, options) => {
    calls++; assert.match(input, /Second question/); assert.equal(options.taskType, "ask");
    return JSON.stringify({ title: "Tense", question: "Tense question?", answer: "Combined learning note.", related: [] });
  } };
  await saveAsk({ messages: [turn()], config });
  const messages = [turn(), { question: "Second question", answer: "Second explanation" }];
  const [a, b] = await Promise.all([saveAsk({ messages, llm, config }), saveAsk({ messages, llm, config })]);
  assert.equal(a.vaultFile, b.vaultFile);
  assert.equal(calls, 1);
  assert.equal(listAskNotes(config).notes.length, 2);
  for (const message of messages) history.append("summary", { ...message, response: message });
  const retry = await saveAsk({ sessionId: "summary", llm, config });
  assert.equal(retry.vaultFile, a.vaultFile);
  assert.equal(calls, 1);
});
test("summary failures preserve CLI history and oversize notes are not written", async (t) => {
  const config = { AskDir: notes(t), Prompts: { AskCompactPrompt: "Combine" } };
  for (const message of [turn(), turn("Another answer")]) history.append("failed", { ...message, response: message });
  t.after(() => history.reset("failed"));
  await assert.rejects(saveAsk({ sessionId: "failed", config, llm: { generateWithFallback: async () => "invalid" } }), /could not be summarized/);
  assert.equal(history.get("failed").length, 2);
  await assert.rejects(saveAsk({ messages: [turn("x".repeat(1024 * 1024))], config }), /reading limit/);
  assert.equal(listAskNotes(config).notes.length, 0);
});
test("single-answer HTTP save works while model initialization is unavailable", async (t) => {
  const config = { AskDir: notes(t) };
  registerAskRoutes({ config, getLLMManager: async () => { throw new Error("Model unavailable"); } });
  const req = Readable.from([JSON.stringify({ messages: [turn()] })]);
  req.method = "POST"; req.url = "/ask/save"; req.setTimeout = () => {};
  const res = { setTimeout() {}, writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
  await dispatch(req, res);
  assert.equal(res.status, 200);
  assert.equal(res.body.saved, true);
});
