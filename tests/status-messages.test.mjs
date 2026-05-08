import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runMigrations } from "../lib/migrations.mjs";

test("migration 006: status_messages table is created and seeded", async () => {
  // Use a temporary database but the real migrations directory
  const dbPath = path.join(os.tmpdir(), "igt-test-status-messages.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new Database(dbPath);
  const migrationsDir = path.join(process.cwd(), "migrations");  
  try {
    await runMigrations(db, migrationsDir);
    
    // Check if table exists
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='status_messages'").get();
    assert.ok(tableInfo, "Table status_messages should exist");
    
    // Check seed data
    const rows = db.prepare("SELECT * FROM status_messages").all();
    assert.ok(rows.length >= 4, `Should have at least 4 seeded rows, got ${rows.length}`);
    
    assert.ok(rows.find(r => r.content.includes("/undo") && r.type === 'tip'));
    assert.ok(rows.find(r => r.content.includes("/review") && r.type === 'tip'));
    assert.ok(rows.find(r => r.content.includes("Wittgenstein") && r.type === 'quote'));
    assert.ok(rows.find(r => r.content.includes("shortest complete sentence") && r.type === 'grammar_fact'));
  } finally {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
});
