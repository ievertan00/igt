import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import Database from "better-sqlite3";
import { gradeRating, REVIEW_RATINGS, EASE_MIN } from "../lib/domain/srs.mjs";
import { checkVocabularyReview, gradeVocabularyReview } from "../lib/application/vocabulary-review.mjs";
import { registerSrsRoutes } from "../lib/server/routes/srs.mjs";
import { dispatch } from "../lib/server/router.mjs";
import { api } from "../lib/cli/api-client.mjs";
import { runReview } from "../lib/cli/commands/review.mjs";
import { up as removeLegacyCoachStorage } from "../migrations/063_remove_legacy_coach_storage.mjs";

const fresh = { ease: 2.5, intervalDays: 1, totalReviews: 0, correctStreak: 0 };
function reviewDb(t) {
  const db = new Database(":memory:");
  t.after(() => db.close());
  for (const file of ["001_initial_schema.sql", "009_practice_attempts.sql", "010_practice_context.sql", "011_learning_plans.sql", "012_practice_task_link.sql", "015_learning_plan_pause.sql"]) {
    db.exec(fs.readFileSync(path.join(process.cwd(), "migrations", file), "utf8"));
  }
  removeLegacyCoachStorage(db);
  db.prepare("INSERT INTO srs_cards (source_type,prompt,answer,word,due_date) VALUES ('vocab','follow up','follow up','follow up','2026-01-01')").run();
  return db;
}

test("four ratings have distinct learning intervals and Beijing calendar dates", () => {
  const now = new Date("2026-10-27T18:30:00Z"); // Already Oct 28 in Beijing.
  const results = REVIEW_RATINGS.map(rating => gradeRating(fresh, rating, now));
  assert.deepEqual(results.map(result => result.intervalDays), [0, 1, 3, 7]);
  assert.deepEqual(results.map(result => result.dueDate), ["2026-10-28", "2026-10-29", "2026-10-31", "2026-11-04"]);
  assert.ok(results.every(result => result.totalReviews === 1));
  assert.equal(results[0].correctStreak, 0);
  assert.throws(() => gradeRating(fresh, "constructor"), /Invalid review rating/);
});

test("mature intervals are ordered, Hard grows slowly, and lapses restart learning", () => {
  const mature = { ...fresh, intervalDays: 30, totalReviews: 8, correctStreak: 8 };
  assert.deepEqual(REVIEW_RATINGS.map(rating => gradeRating(mature, rating).intervalDays), [0, 36, 75, 98]);
  const reset = gradeRating(mature, "again");
  assert.equal(gradeRating(reset, "good").intervalDays, 3);
  assert.equal(gradeRating(reset, "easy").intervalDays, 7);
  let difficult = { ...mature, ease: 1.3 };
  for (let i = 0; i < 5; i++) difficult = gradeRating(difficult, "hard");
  assert.equal(difficult.ease, EASE_MIN);
  assert.ok(difficult.intervalDays > 30);
});

test("answer check is read-only; a rating atomically stores separate recall evidence once", t => {
  const db = reviewDb(t);
  const checked = checkVocabularyReview(db, { cardId: 1, answer: "wrong" });
  assert.equal(checked.correct, false);
  assert.equal(checked.persistence.saved, false);
  assert.equal(db.prepare("SELECT total_reviews FROM srs_cards").get().total_reviews, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM practice_attempts").get().n, 0);
  const input = { cardId: 1, answer: "wrong", rating: "easy", requestId: randomUUID(), audioPlayed: true };
  const saved = gradeVocabularyReview(db, input);
  assert.equal(saved.correct, false, "Easy must not turn a spelling mistake into a correct answer");
  assert.equal(saved.rating, "easy");
  assert.equal(saved.next.intervalDays, checked.ratings.easy.intervalDays);
  assert.deepEqual(gradeVocabularyReview(db, input), saved);
  assert.equal(db.prepare("SELECT total_reviews FROM srs_cards").get().total_reviews, 1);
  const evidence = db.prepare("SELECT score, feedback FROM practice_attempts").get();
  assert.equal(evidence.score, 0);
  assert.equal(JSON.parse(evidence.feedback).rating, "easy");
  assert.equal(JSON.parse(evidence.feedback).audioPlayed, true);
  assert.throws(() => gradeVocabularyReview(db, { ...input, rating: "good" }), error => error.status === 409);
  assert.throws(() => gradeVocabularyReview(db, { ...input, rating: "invalid", requestId: randomUUID() }), error => error.status === 400);
});

test("blank Again remains incorrect, due today; evidence failure rolls back SRS", t => {
  const db = reviewDb(t);
  const input = { cardId: 1, answer: "", rating: "again", requestId: randomUUID() };
  const saved = gradeVocabularyReview(db, input);
  assert.equal(saved.correct, false);
  assert.equal(saved.next.intervalDays, 0);
  assert.equal(db.prepare("SELECT learner_answer FROM practice_attempts").get().learner_answer, "(blank)");
  db.exec("CREATE TRIGGER fail_rating BEFORE INSERT ON practice_attempts BEGIN SELECT RAISE(ABORT, 'rating evidence failed'); END;");
  assert.throws(() => gradeVocabularyReview(db, { ...input, rating: "good", requestId: randomUUID() }), /rating evidence failed/);
  assert.equal(db.prepare("SELECT interval_days, total_reviews FROM srs_cards").get().total_reviews, 1);
  assert.equal(db.prepare("SELECT interval_days FROM srs_cards").get().interval_days, 0);
});

test("HTTP check and grade use the same application contract without a model", async t => {
  const db = reviewDb(t);
  registerSrsRoutes({ getReviewDb: async () => db, getLLMManager: () => { throw new Error("must not use a model"); } });
  async function post(url, body) {
    const req = Readable.from([JSON.stringify(body)]);
    req.method = "POST"; req.url = url;
    const res = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
    await dispatch(req, res);
    return res;
  }
  const check = await post("/review/check", { card_id: 1, answer: "FOLLOW-UP" });
  assert.equal(check.status, 200);
  assert.equal(check.body.correct, true);
  assert.equal(check.body.persistence.saved, false);
  const grade = await post("/review/grade", { card_id: 1, answer: "FOLLOW-UP", request_id: randomUUID(), rating: "hard" });
  assert.equal(grade.status, 200);
  assert.equal(grade.body.rating, "hard");
  assert.equal(grade.body.next.intervalDays, 1);
});

test("CLI accepts all four ratings, repeats Again, and retries the identical save", async t => {
  const db = reviewDb(t);
  let output = "";
  t.mock.method(process.stdout, "write", chunk => { output += chunk; return true; });
  t.mock.method(api, "getDue", async () => ({ cards: [1, 2, 3].map(id => ({ id, word: "follow up", zh: "跟进" })) }));
  for (const id of [2, 3]) db.prepare("INSERT INTO srs_cards (id,source_type,prompt,answer,word,due_date) VALUES (?,'vocab','follow up','follow up','follow up','2026-01-01')").run(id);
  t.mock.method(api, "checkVocabularyRecall", async (cardId, answer) => checkVocabularyReview(db, { cardId, answer }));
  const saves = [];
  let loseResponse = true;
  t.mock.method(api, "submitVocabularyRecall", async (cardId, answer, requestId, audioPlayed, rating) => {
    const request = { cardId, answer, requestId, audioPlayed, rating };
    saves.push(request);
    const result = gradeVocabularyReview(db, request);
    if (loseResponse) { loseResponse = false; throw new Error("response lost"); }
    return result;
  });
  const answers = ["", "again", "again", "follow up", "2", "follow up", "good", "follow up", "easy"];
  await runReview(async () => answers.shift() ?? null, null, 3, { Tts: { Enabled: false } });
  assert.deepEqual(saves.map(value => value.rating), ["again", "again", "hard", "good", "easy"]);
  assert.deepEqual(saves[0], saves[1]);
  assert.equal(db.prepare("SELECT sum(total_reviews) AS n FROM srs_cards").get().n, 4);
  assert.match(output, /Again/); assert.match(output, /Hard/); assert.match(output, /Good/); assert.match(output, /Easy/);
  assert.match(output, /Answer revealed/);
});
