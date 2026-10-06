import assert from "node:assert/strict";
import Database from "better-sqlite3";
import path from "node:path";
import { getDb, closeAll } from "../lib/db/connection.mjs";
import { runMigrations } from "../lib/db/migrations.mjs";
import { CANONICAL_PRACTICE_QUESTIONS, practiceContent } from "../lib/features/practice/canonical-bank.mjs";
import { isStandardPracticeQuestionId } from "../lib/features/practice/question-ids.mjs";

const live = await getDb({ readonly: true });
const fresh = new Database(":memory:");
try {
  const rows = live.prepare("SELECT * FROM practice_questions ORDER BY id").all();
  const content = rows.map(practiceContent);
  for (const row of rows) {
    if (row.id.startsWith("practice-")) assert.equal(isStandardPracticeQuestionId(row.id), true, `Nonstandard new Practice ID: ${row.id}`);
  }
  for (const row of rows) assert.equal(Object.hasOwn(JSON.parse(row.practice_fields_json), "_legacy"), false, `Retired compatibility payload in ${row.id}`);
  assert.deepEqual(content, CANONICAL_PRACTICE_QUESTIONS.map(practiceContent), "Authoritative database differs from its versioned export. Export deliberate live changes before rebuilding.");
  const migrations = path.join(import.meta.dirname, "..", "migrations");
  await runMigrations(fresh, migrations);
  assert.deepEqual(fresh.prepare("SELECT * FROM practice_questions ORDER BY id").all().map(practiceContent), content, "Fresh migration content differs from the authoritative database");
  const before = fresh.prepare("SELECT * FROM practice_questions ORDER BY id").all();
  assert.deepEqual(await runMigrations(fresh, migrations), []);
  assert.deepEqual(fresh.prepare("SELECT * FROM practice_questions ORDER BY id").all(), before);
  assert.equal(live.pragma("quick_check", { simple: true }), "ok");
  assert.equal(fresh.pragma("quick_check", { simple: true }), "ok");
  console.log(JSON.stringify({ questions: rows.length, contentDifferences: 0, migrationReplayChanges: 0, integrity: "ok", liveWrites: 0 }));
} finally {
  fresh.close();
  closeAll();
}
