/**
 * Database cleanup and repair:
 *
 * 1. Delete placeholder inputs ("Old text", "New text") and their cascaded rows.
 * 2. Regenerate missing grammar SRS cards for inputs that have corrections
 *    but no linked card (lost during the pre-006 schema migration).
 * 3. (Optional, --purge-empty) Delete inputs with no diagnosis and no correction.
 *
 * Usage:
 *   node tools/repair-db.mjs              # steps 1 + 2
 *   node tools/repair-db.mjs --purge-empty # steps 1 + 2 + 3
 *   node tools/repair-db.mjs --dry-run    # preview only, no changes
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import configLoader from "../lib/config-loader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const config = configLoader.load();

const dryRun    = process.argv.includes("--dry-run");
const purgeEmpty = process.argv.includes("--purge-empty");

const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
const db = new Database(resolvedDbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const log = (msg) => console.log(msg);
if (dryRun) log("DRY RUN — no changes will be made.\n");

// ── 1. Delete placeholder inputs ─────────────────────────────────────────────

const PLACEHOLDER_TEXTS = ["Old text", "New text"];
const placeholders = db.prepare(
  `SELECT id, original_text FROM inputs WHERE original_text IN (${PLACEHOLDER_TEXTS.map(() => "?").join(",")})`
).all(...PLACEHOLDER_TEXTS);

log(`=== Step 1: Placeholder inputs ===`);
if (placeholders.length === 0) {
  log("  None found.");
} else {
  for (const r of placeholders) log(`  [${r.id}] "${r.original_text}"`);
  if (!dryRun) {
    const ids = placeholders.map(r => r.id);
    const ph = ids.map(() => "?").join(",");
    db.transaction(() => {
      db.prepare(`DELETE FROM srs_cards WHERE source_type='input' AND source_id IN (${ph})`).run(...ids);
      db.prepare(`DELETE FROM inputs WHERE id IN (${ph})`).run(...ids);
    })();
    log(`  Deleted ${placeholders.length} input(s) and cascaded rows.`);
  }
}
log("");

// ── 2. Regenerate missing grammar SRS cards ───────────────────────────────────

const needCards = db.prepare(`
  SELECT id, original_text, correction FROM inputs
  WHERE correction IS NOT NULL
    AND trim(correction) != ''
    AND trim(original_text) != trim(correction)
    AND NOT EXISTS (
      SELECT 1 FROM srs_cards c
      WHERE c.source_type = 'input' AND c.source_id = inputs.id
    )
`).all();

log(`=== Step 2: Regenerate missing grammar SRS cards ===`);
log(`  Found ${needCards.length} input(s) with corrections but no card.`);

if (!dryRun && needCards.length > 0) {
  const insert = db.prepare(`
    INSERT INTO srs_cards (source_type, source_id, prompt, answer, due_date)
    VALUES ('input', ?, ?, ?, date('now'))
  `);
  db.transaction(() => {
    for (const r of needCards) insert.run(r.id, r.original_text.trim(), r.correction.trim());
  })();
  log(`  Created ${needCards.length} SRS card(s).`);
}
log("");

// ── 3. Purge empty inputs (opt-in) ────────────────────────────────────────────

log(`=== Step 3: Empty inputs (no diagnosis, no correction) ===`);
const emptyInputs = db.prepare(`
  SELECT id, substr(original_text,1,80) as text, timestamp FROM inputs
  WHERE (correction IS NULL OR trim(correction) = '')
    AND NOT EXISTS (SELECT 1 FROM diagnoses d WHERE d.input_id = inputs.id)
  ORDER BY id
`).all();

log(`  Found ${emptyInputs.length} input(s).`);

if (!purgeEmpty) {
  log("  Skipped (pass --purge-empty to delete these).");
  if (emptyInputs.length > 0) {
    log("  Sample:");
    emptyInputs.slice(0, 5).forEach(r => log(`    [${r.id}] ${r.text}`));
    if (emptyInputs.length > 5) log(`    ... and ${emptyInputs.length - 5} more`);
  }
} else if (!dryRun) {
  const ids = emptyInputs.map(r => r.id);
  const ph = ids.map(() => "?").join(",");
  db.transaction(() => {
    db.prepare(`DELETE FROM srs_cards WHERE source_type='input' AND source_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM inputs WHERE id IN (${ph})`).run(...ids);
  })();
  log(`  Deleted ${emptyInputs.length} empty input(s).`);
}
log("");

// ── Summary ───────────────────────────────────────────────────────────────────

const cardCount = db.prepare("SELECT COUNT(*) as n FROM srs_cards WHERE source_type='input'").get();
const inputCount = db.prepare("SELECT COUNT(*) as n FROM inputs").get();
log(`=== Final state ===`);
log(`  Inputs:        ${inputCount.n}`);
log(`  Grammar cards: ${cardCount.n}`);

db.close();
