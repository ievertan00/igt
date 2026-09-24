import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { syncVocabularySrs } from "../lib/application/vocabulary.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-vocab-sync-"));
const source = path.join(root, "Vocabulary.md");
const db = new Database(path.join(root, "test.db"));
db.exec(`CREATE TABLE srs_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT, source_type TEXT NOT NULL, source_id INTEGER,
  prompt TEXT NOT NULL, answer TEXT NOT NULL, ease REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1, due_date TEXT NOT NULL, last_reviewed TEXT,
  total_reviews INTEGER DEFAULT 0, correct_streak INTEGER DEFAULT 0, word TEXT,
  pos TEXT, zh TEXT, meaning TEXT, example TEXT, note TEXT, vocab_details TEXT
)`);

try {
  fs.writeFileSync(source, "# IGT Vocabulary\n\n### consolidate\n**PoS:** verb\n**Meaning:** combine\n**中文:** 巩固；合并\n**Example 1:** We consolidated the notes.\n");
  let result = await syncVocabularySrs({ sourcePath: source, db });
  assert.equal(result.inserted, 1);
  assert.equal(result.updated, 0);
  db.prepare("UPDATE srs_cards SET interval_days = 7, total_reviews = 3 WHERE word = 'consolidate'").run();

  fs.writeFileSync(source, "# IGT Vocabulary\n\n### consolidate\n**PoS:** verb\n**Meaning:** combine into one\n**中文:** 巩固；合并\n**Example 1:** We consolidated the notes.\n");
  result = await syncVocabularySrs({ sourcePath: source, db });
  assert.equal(result.inserted, 0);
  assert.equal(result.updated, 1);
  assert.equal(db.prepare("SELECT meaning FROM srs_cards WHERE word = 'consolidate'").get().meaning, "combine into one");
  assert.equal(db.prepare("SELECT interval_days FROM srs_cards WHERE word = 'consolidate'").get().interval_days, 7);

  result = await syncVocabularySrs({ sourcePath: source, db });
  assert.equal(result.inserted, 0);
  assert.equal(result.updated, 0);
  console.log("vocabulary sync smoke ok");
} finally {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
}
