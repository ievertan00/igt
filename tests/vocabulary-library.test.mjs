import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import Database from "better-sqlite3";
import { listSavedVocabulary, readVocabularyHistory } from "../lib/application/vocabulary-library.mjs";
import { registerVocabRoutes } from "../lib/server/routes/vocab.mjs";
import { dispatch } from "../lib/server/router.mjs";

let routeDb = null;

function source(t, content = "") {
  const parent = path.join(process.cwd(), ".cache");
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, "saved-vocabulary-test-"));
  const file = path.join(dir, "words.md");
  fs.writeFileSync(file, content);
  t.after(() => { assert.equal(path.dirname(dir), parent); fs.rmSync(dir, { recursive: true, force: true }); });
  return { file, config: { VocabularyPath: file } };
}

const entry = (word, date = "2026-10-20") => `### ${word}
**PoS:** noun · /test/
**Meaning:** A saved expression
**中文:** 保存的词汇
**Synonyms:**
**Collocations:** useful expression
**Verb forms:** go · went · gone
**Plural:** saved expressions
**Example 1:** First example for ${word}.
**Example 2:** Second example for ${word}.
**Example 3:** Third example for ${word}.
**Note:** Use it in a sentence.
**Memory:** A useful memory cue.
*Added: ${date}*
`;

test("library reads every Markdown entry without depending on the SRS deck", t => {
  const input = `# Vocabulary\n${entry("zebra")}${entry("apple")}${entry("apple")}`;
  const { file, config } = source(t, input);
  const result = listSavedVocabulary({ config });
  assert.equal(result.sourceAvailable, true);
  assert.equal(result.totalSaved, 3);
  assert.deepEqual(result.words.map(word => word.word), ["apple", "apple", "zebra"]);
  assert.equal(new Set(result.words.map(word => word.id)).size, 3);
  assert.equal(result.words[0].synonyms, "", "empty fields must not swallow the next line");
  assert.equal(result.words[0].example3, "Third example for apple.");
  assert.equal(result.words[0].memory, "A useful memory cue.");
  assert.equal(result.words[0].phonetic, "/test/");
  assert.equal(result.words[0].verbForms, "go · went · gone");
  assert.equal(result.words[0].plural, "saved expressions");
  assert.equal(fs.readFileSync(file, "utf8"), input, "browsing never rewrites the vocabulary file");
  assert.equal(JSON.stringify(result).includes(file), false);
});

test("library searches Chinese, examples and notes, sorts and paginates consistently", t => {
  const { config } = source(t, entry("zebra", "2026-10-22") + entry("apple", "2026-10-23") + entry("banana", "2026-10-21"));
  assert.deepEqual(listSavedVocabulary({ config, sort: "newest" }).words.map(word => word.word), ["apple", "zebra", "banana"]);
  assert.equal(listSavedVocabulary({ config, search: "保存" }).total, 3);
  assert.equal(listSavedVocabulary({ config, search: "SECOND EXAMPLE FOR APPLE" }).total, 1);
  assert.equal(listSavedVocabulary({ config, search: "went" }).total, 3, "verb forms join the search fields");
  assert.equal(listSavedVocabulary({ config, search: "memory cue" }).total, 3);
  const page = listSavedVocabulary({ config, limit: 1, offset: 1 });
  assert.equal(page.words[0].word, "banana"); assert.equal(page.hasMore, true);
  assert.equal(listSavedVocabulary({ config, limit: 1, offset: 100 }).offset, 2);
  assert.equal(listSavedVocabulary({ config, search: "missing" }).total, 0);
  assert.throws(() => listSavedVocabulary({ config, limit: 101 }), error => error.status === 400);
  assert.throws(() => listSavedVocabulary({ config, sort: "invalid" }), error => error.status === 400);
});

test("library distinguishes an empty source from a missing source", t => {
  const { config, file } = source(t);
  assert.equal(listSavedVocabulary({ config }).sourceAvailable, true);
  fs.unlinkSync(file);
  const missing = listSavedVocabulary({ config });
  assert.equal(missing.sourceAvailable, false);
  assert.equal(missing.totalSaved, 0);
});

test("saved vocabulary GET route validates queries and returns complete entries read-only", async t => {
  const { config } = source(t, entry("follow up"));
  registerVocabRoutes({ getConfig: () => config, getVocabularyDb: async options => { assert.equal(options.readonly, true); return routeDb; } });
  async function get(url) {
    const req = Readable.from([]); req.method = "GET"; req.url = url;
    const res = { writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
    await dispatch(req, res);
    return res;
  }
  const response = await get("/vocab/words?q=follow%20up&sort=az&limit=25&offset=0");
  assert.equal(response.status, 200);
  assert.equal(response.body.words[0].word, "follow up");
  assert.equal(response.body.words[0].added, "2026-10-20");
  assert.equal((await get("/vocab/words?limit=-1")).status, 400);
});

test("overview separates typed recall from ratings, counts the whole library and never writes learning state", t => {
  const { config } = source(t, ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape", "honeydew"].map(word => entry(word)).join(""));
  const db = new Database(":memory:"); t.after(() => db.close());
  for (const file of ["001_initial_schema.sql", "009_practice_attempts.sql"]) db.exec(fs.readFileSync(path.join(process.cwd(), "migrations", file), "utf8"));
  const card = db.prepare("INSERT INTO srs_cards (source_type,prompt,answer,word,due_date,total_reviews,correct_streak,interval_days,last_reviewed) VALUES ('vocab',?,?,?,?,?,?,?,?)");
  const review = db.prepare("INSERT INTO practice_attempts (activity_type,prompt,learner_answer,reference_answer,score,feedback,created_at) VALUES ('review-vocabulary',?,?,?,?,?,?)");
  for (const [index, word] of ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape"].entries()) {
    card.run(word, word, word, index === 0 ? "2000-01-01" : "2099-01-01", index === 4 ? 0 : 10, 10, 30, index === 3 ? "2026-10-25 12:00:00" : null);
  }
  function record(id, word, day, correct = true, audioPlayed = false) {
    review.run(word, correct ? word : "wrong", word, correct ? 100 : 0,
      JSON.stringify({ cardId: id, correct, audioPlayed, rating: "easy", result: { next: { intervalDays: 7, dueDate: "2026-11-01" } } }), `2026-10-${day} 12:00:00`);
  }
  for (const day of ["01", "08", "22"]) record(1, "apple", day);
  for (const day of ["21", "22"]) record(2, "banana", day);
  record(3, "cherry", "22", false); // Easy scheduling must not be interpreted as recall success.
  record(4, "date", "22"); // A newer schedule-only review invalidates the current evidence label.
  record(6, "fig", "22", true, true);
  for (let i = 0; i < 3; i++) record(7, "grape", "22"); // Repeating on one day is not stronger retention over time.
  const changes = db.prepare("SELECT total_changes() AS n").get().n;
  const result = listSavedVocabulary({ config, db, limit: 1, search: "apple" });
  assert.deepEqual(result.overview, { due: 1, overdue: 1, dueToday: 0, retained: 1, wellRetained: 1,
    distribution: { new: 1, learning: 2, "needs-reinforcement": 1, retained: 1, "well-retained": 1, "insufficient-history": 2 } });
  assert.equal(result.words[0].learningStatus, "well-retained");
  assert.equal(listSavedVocabulary({ config, db, schedule: "due" }).total, 1);
  assert.equal(listSavedVocabulary({ config, db, status: "retained" }).total, 1);
  assert.equal(Object.values(result.overview.distribution).reduce((sum, count) => sum + count, 0), result.totalSaved);
  assert.equal(listSavedVocabulary({ config, db, sort: "next-review" }).words.at(-1).word, "honeydew");
  const statuses = Object.fromEntries(listSavedVocabulary({ config, db }).words.map(word => [word.word, word.learningStatus]));
  assert.deepEqual(statuses, { apple: "well-retained", banana: "retained", cherry: "needs-reinforcement", date: "insufficient-history", elderberry: "new", fig: "learning", grape: "learning", honeydew: "insufficient-history" });
  assert.equal(db.prepare("SELECT total_changes() AS n").get().n, changes);
  const unavailable = listSavedVocabulary({ config });
  assert.equal(unavailable.overview, null);
  assert.equal(unavailable.words[0].learningStatus, "unavailable");
  db.prepare("UPDATE practice_attempts SET created_at = '2026-10-14 11:59:59' WHERE id = 3").run();
  assert.equal(listSavedVocabulary({ config, db, search: "apple" }).words[0].learningStatus, "retained", "a long scheduled interval cannot substitute for seven actual elapsed days");
});

test("history pages are newest first, preserve raw evidence and exclude other activities/cards", async t => {
  const db = new Database(":memory:"); t.after(() => db.close());
  db.exec(fs.readFileSync(path.join(process.cwd(), "migrations", "009_practice_attempts.sql"), "utf8"));
  const insert = db.prepare("INSERT INTO practice_attempts (activity_type,prompt,learner_answer,reference_answer,score,feedback,created_at) VALUES (?,?,?,?,?,?,?)");
  for (let i = 0; i < 25; i++) insert.run("review-vocabulary", "apple", "wrong", "apple", 0, JSON.stringify({ cardId: 1, correct: false, rating: "easy", audioPlayed: true }), "2026-10-22 12:00:00");
  insert.run("review-vocabulary", "banana", "banana", "banana", 100, '{"cardId":2}', "2026-10-23 12:00:00");
  insert.run("practice-sentence", "apple", "apple", "apple", 100, '{"cardId":1}', "2026-10-23 12:00:00");
  insert.run("review-vocabulary", "apple", "apple", "apple", 100, 'invalid', "2026-10-23 12:00:00");
  db.pragma("query_only = ON");
  const page = readVocabularyHistory(db, { cardId: 1 });
  assert.equal(page.total, 25); assert.equal(page.records.length, 20); assert.equal(page.hasMore, true);
  assert.equal(page.records[0].id, 25);
  assert.equal(JSON.parse(page.records[0].feedback).correct, false);
  const next = readVocabularyHistory(db, { cardId: 1, offset: 20 });
  assert.deepEqual(next.records.map(record => record.id), [5, 4, 3, 2, 1]);
  assert.equal(next.hasMore, false);
  assert.throws(() => readVocabularyHistory(db, { cardId: 0 }), error => error.status === 400);
  routeDb = db; t.after(() => { routeDb = null; });
  const req = Readable.from([]); req.method = "GET"; req.url = "/vocab/history?card_id=1&offset=20";
  const res = { writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
  await dispatch(req, res);
  assert.equal(res.status, 200); assert.equal(res.body.records.length, 5);
});
