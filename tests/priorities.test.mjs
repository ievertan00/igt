import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../lib/db/connection.mjs';
import { getStats } from '../lib/db/stats.mjs';

test('getStats includes priorities from last 30 days', async () => {
  const db = await getDb();
  
  // Clean up in correct order due to FK
  db.prepare("DELETE FROM srs_cards").run();
  db.prepare("DELETE FROM advice").run();
  db.prepare("DELETE FROM vocab").run();
  db.prepare("DELETE FROM diagnoses").run();
  db.prepare("DELETE FROM inputs").run();
  db.prepare("DELETE FROM sessions").run();
  
  // Create a session
  const sessionId = db.prepare("INSERT INTO sessions (start_time) VALUES (datetime('now', '-40 days'))").run().lastInsertRowid;
  
  // Insert some test data
  const now = new Date();
  const thirtyOneDaysAgo = new Date(now.getTime() - (31 * 24 * 60 * 60 * 1000)).toISOString();
  const tenDaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000)).toISOString();

  // Input 31 days ago (should be ignored)
  const oldInputId = db.prepare("INSERT INTO inputs (session_id, original_text, timestamp) VALUES (?, ?, ?)").run(sessionId, 'Old text', thirtyOneDaysAgo).lastInsertRowid;
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(oldInputId, 'Article Usage');

  // Inputs within last 30 days
  const newInputId = db.prepare("INSERT INTO inputs (session_id, original_text, timestamp) VALUES (?, ?, ?)").run(sessionId, 'New text', tenDaysAgo).lastInsertRowid;
  
  // 3 Article Usage (one old, so only 2 should count)
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(newInputId, 'Article Usage');
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(newInputId, 'Article Usage');
  
  // 3 Verb Tense
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(newInputId, 'Verb Tense');
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(newInputId, 'Verb Tense');
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(newInputId, 'Verb Tense');
  
  // 1 Spelling
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(newInputId, 'Spelling');
  
  // 4 Punctuation
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(newInputId, 'Punctuation');
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(newInputId, 'Punctuation');
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(newInputId, 'Punctuation');
  db.prepare("INSERT INTO diagnoses (input_id, error_type) VALUES (?, ?)").run(newInputId, 'Punctuation');

  const stats = await getStats();
  
  assert.ok(Array.isArray(stats.priorities), 'priorities should be an array');
  assert.equal(stats.priorities.length, 3, 'should return top 3');
  
  // Expected top 3 within 30 days:
  // 1. Punctuation (4)
  // 2. Verb Tense (3)
  // 3. Article Usage (2) - because 1 was older than 30 days
  
  assert.equal(stats.priorities[0].error_type, 'Punctuation');
  assert.equal(stats.priorities[0].hits, 4);
  
  assert.equal(stats.priorities[1].error_type, 'Verb Tense');
  assert.equal(stats.priorities[1].hits, 3);
  
  assert.equal(stats.priorities[2].error_type, 'Article Usage');
  assert.equal(stats.priorities[2].hits, 2);
});
