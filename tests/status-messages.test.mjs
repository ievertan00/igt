import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import path from "node:path";
import { runMigrations } from "../lib/db/migrations.mjs";

test("status_messages is seeded with quotes and grammar facts, without retired tips", async () => {
  const db = new Database(":memory:");
  const migrationsDir = path.join(process.cwd(), "migrations");
  try {
    await runMigrations(db, migrationsDir);

    const rows = db.prepare("SELECT * FROM status_messages").all();
    assert.ok(rows.length >= 100, `Should seed the full status bar library, got ${rows.length}`);
    assert.ok(rows.every(r => r.type === "quote" || r.type === "grammar_fact"));
    assert.ok(rows.every(r => r.last_shown_at === null), "Display history is runtime state and starts empty");
    assert.ok(rows.find(r => r.content.includes("Wittgenstein") && r.type === "quote"));
    assert.ok(rows.find(r => r.content.includes("shortest complete sentence") && r.type === "grammar_fact"));

    const before = db.prepare("SELECT * FROM status_messages ORDER BY id").all();
    assert.deepEqual(await runMigrations(db, migrationsDir), []);
    assert.deepEqual(db.prepare("SELECT * FROM status_messages ORDER BY id").all(), before);
  } finally {
    db.close();
  }
});