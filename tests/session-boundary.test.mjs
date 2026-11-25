// Session boundary behaviour: 30-min gap creates a new session, otherwise reuse last.
// Drives saveToDatabase() indirectly by invoking the same logic against a temp DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SESSION_GAP_MS = 30 * 60 * 1000;

function parseSqliteTs(s) {
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function setupDb() {
  const dbPath = path.join(os.tmpdir(), `igt-session-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_time TIMESTAMP,
      total_inputs INTEGER DEFAULT 0
    );
    CREATE TABLE inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      original_text TEXT NOT NULL
    );
  `);
  return { db, dbPath };
}

// Mirror of the saveToDatabase session logic, parameterized on `now` for testability.
function recordInput(db, state, text, now) {
  if (!state.bootstrapped) {
    const last = db.prepare(`
      SELECT timestamp, session_id FROM inputs
      WHERE session_id IS NOT NULL
      ORDER BY id DESC LIMIT 1
    `).get();
    if (last) {
      state.currentSessionId = last.session_id;
      state.lastInputAt = parseSqliteTs(last.timestamp);
    }
    state.bootstrapped = true;
  }

  if (state.currentSessionId === null || state.lastInputAt === null || (now - state.lastInputAt) > SESSION_GAP_MS) {
    const startIso = new Date(now).toISOString();
    const res = db.prepare(`INSERT INTO sessions (start_time, end_time, total_inputs) VALUES (?, ?, 0)`).run(startIso, startIso);
    state.currentSessionId = res.lastInsertRowid;
  }
  state.lastInputAt = now;

  db.prepare(`INSERT INTO inputs (session_id, timestamp, original_text) VALUES (?, ?, ?)`)
    .run(state.currentSessionId, new Date(now).toISOString(), text);
  db.prepare(`UPDATE sessions SET end_time = ?, total_inputs = total_inputs + 1 WHERE id = ?`)
    .run(new Date(now).toISOString(), state.currentSessionId);

  return state.currentSessionId;
}

test("first input creates first session", () => {
  const { db, dbPath } = setupDb();
  const state = { bootstrapped: false, currentSessionId: null, lastInputAt: null };
  const t0 = Date.parse("2026-05-03T10:00:00Z");
  const sid = recordInput(db, state, "hello world", t0);
  assert.equal(sid, 1);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM sessions").get().c, 1);
  db.close(); fs.unlinkSync(dbPath);
});

test("input within 30 min reuses session", () => {
  const { db, dbPath } = setupDb();
  const state = { bootstrapped: false, currentSessionId: null, lastInputAt: null };
  const t0 = Date.parse("2026-05-03T10:00:00Z");
  const sid1 = recordInput(db, state, "first", t0);
  const sid2 = recordInput(db, state, "second", t0 + 29 * 60 * 1000);
  assert.equal(sid1, sid2);
  const sess = db.prepare("SELECT * FROM sessions").all();
  assert.equal(sess.length, 1);
  assert.equal(sess[0].total_inputs, 2);
  db.close(); fs.unlinkSync(dbPath);
});

test("gap > 30 min starts a new session", () => {
  const { db, dbPath } = setupDb();
  const state = { bootstrapped: false, currentSessionId: null, lastInputAt: null };
  const t0 = Date.parse("2026-05-03T10:00:00Z");
  const sid1 = recordInput(db, state, "first", t0);
  const sid2 = recordInput(db, state, "second", t0 + 31 * 60 * 1000);
  assert.notEqual(sid1, sid2);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM sessions").get().c, 2);
  db.close(); fs.unlinkSync(dbPath);
});

test("bootstrap from existing rows reuses session within window", () => {
  const { db, dbPath } = setupDb();
  // Seed an existing session + input as if the server had run before
  const t0 = Date.parse("2026-05-03T10:00:00Z");
  const startIso = new Date(t0).toISOString();
  db.prepare(`INSERT INTO sessions (start_time, end_time, total_inputs) VALUES (?, ?, 1)`).run(startIso, startIso);
  db.prepare(`INSERT INTO inputs (session_id, timestamp, original_text) VALUES (?, ?, ?)`).run(1, startIso, "old");

  const state = { bootstrapped: false, currentSessionId: null, lastInputAt: null };
  const sid = recordInput(db, state, "new within window", t0 + 10 * 60 * 1000);
  assert.equal(sid, 1, "should reuse session 1, not create a new one");
  assert.equal(db.prepare("SELECT COUNT(*) c FROM sessions").get().c, 1);
  db.close(); fs.unlinkSync(dbPath);
});

test("bootstrap from existing rows starts new session past window", () => {
  const { db, dbPath } = setupDb();
  const t0 = Date.parse("2026-05-03T10:00:00Z");
  const startIso = new Date(t0).toISOString();
  db.prepare(`INSERT INTO sessions (start_time, end_time, total_inputs) VALUES (?, ?, 1)`).run(startIso, startIso);
  db.prepare(`INSERT INTO inputs (session_id, timestamp, original_text) VALUES (?, ?, ?)`).run(1, startIso, "old");

  const state = { bootstrapped: false, currentSessionId: null, lastInputAt: null };
  const sid = recordInput(db, state, "new outside window", t0 + 45 * 60 * 1000);
  assert.equal(sid, 2);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM sessions").get().c, 2);
  db.close(); fs.unlinkSync(dbPath);
});
