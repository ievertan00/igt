/**
 * Imports legacy SRS data from the IGT Data Warehouse into srs_cards.
 *
 * Sources:
 *   igt_cards_2026-04-11.csv  → grammar cards (source_type='input')
 *   01_IGT_Vocabulary.md      → vocab cards   (source_type='vocab')
 *
 * Safe to re-run — existing cards are skipped, not duplicated.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import configLoader from "../lib/shared/config-loader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const config = configLoader.load();

const WAREHOUSE = "D:\\Library\\-06ObsidianVault\\02_Knowledge\\IGT_Data_Warehouse";
const CSV_FILE   = path.join(WAREHOUSE, "igt_cards_2026-04-11.csv");
const VOCAB_FILE = path.join(WAREHOUSE, "01_IGT_Vocabulary.md");

const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
const db = new Database(resolvedDbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(content) {
  const rows = [];
  let i = content.charCodeAt(0) === 0xFEFF ? 1 : 0; // skip BOM
  const len = content.length;

  while (i < len) {
    const row = [];
    while (i < len && content[i] !== "\n") {
      if (content[i] === '"') {
        i++;
        let field = "";
        while (i < len) {
          if (content[i] === '"' && content[i + 1] === '"') { field += '"'; i += 2; }
          else if (content[i] === '"') { i++; break; }
          else field += content[i++];
        }
        row.push(field);
        if (content[i] === ",") i++;
      } else {
        let field = "";
        while (i < len && content[i] !== "," && content[i] !== "\n") field += content[i++];
        row.push(field.trim());
        if (content[i] === ",") i++;
      }
    }
    if (content[i] === "\n") i++;
    if (row.some(f => f.length > 0)) rows.push(row);
  }
  return rows;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function extractCorrection(backHtml) {
  const m = backHtml.match(/<b>✅ Correct:<\/b><br\s*\/?>([\s\S]*?)(?:<br><br>|<b>✨|$)/);
  if (!m) return null;
  const text = decodeEntities(m[1].replace(/<[^>]+>/g, " ").replace(/\*([^*]+)\*/g, "$1").trim());
  // Take the first non-empty line; strip leading "- "
  for (const line of text.split("\n")) {
    const clean = line.trim().replace(/^-\s*/, "").trim();
    if (clean.length > 0) return clean;
  }
  return null;
}

// ── Vocab markdown parser ─────────────────────────────────────────────────────

function parseVocabMarkdown(content) {
  const entries = [];
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const hm = lines[i].match(/^###?\s+(.+)/);
    if (!hm) { i++; continue; }
    const block = [lines[i++]];
    while (i < lines.length && !/^###?\s+/.test(lines[i])) block.push(lines[i++]);
    const raw = block.join("\n");
    const get = (k) => { const m = raw.match(new RegExp(`\\*\\*${k}:\\*\\*\\s*(.+)`)); return m ? m[1].trim() : ""; };
    entries.push({
      word: hm[1].trim(),
      pos: get("PoS"), zh: get("中文"),
      meaning: get("Meaning"), example: get("Example"), note: get("Note"),
    });
  }
  return entries;
}

// ── Import grammar cards ──────────────────────────────────────────────────────

let grammarInserted = 0, grammarSkipped = 0;

if (fs.existsSync(CSV_FILE)) {
  const rows = parseCSV(fs.readFileSync(CSV_FILE, "utf8")).slice(1); // skip header

  // Deduplicate by prompt — same sentence may appear with different tags
  const unique = new Map();
  for (const [front, back] of rows) {
    if (!front || !back) continue;
    const prompt = front.replace(/^﻿/, "").trim();
    if (!prompt || unique.has(prompt)) continue;
    const answer = extractCorrection(back);
    if (answer && answer !== prompt) unique.set(prompt, answer);
  }

  const exists = db.prepare(`SELECT COUNT(*) AS n FROM srs_cards WHERE source_type='input' AND prompt=?`);
  const insert = db.prepare(`
    INSERT INTO srs_cards (source_type, source_id, prompt, answer, due_date)
    VALUES ('input', NULL, ?, ?, date('now'))
  `);

  db.transaction(() => {
    for (const [prompt, answer] of unique) {
      if (exists.get(prompt).n > 0) { grammarSkipped++; continue; }
      insert.run(prompt, answer);
      grammarInserted++;
    }
  })();

  console.log(`Grammar  — inserted: ${grammarInserted}, skipped: ${grammarSkipped}`);
} else {
  console.log(`Grammar  — CSV not found: ${CSV_FILE}`);
}

// ── Import vocab cards ────────────────────────────────────────────────────────

let vocabInserted = 0, vocabSkipped = 0;

if (fs.existsSync(VOCAB_FILE)) {
  const entries = parseVocabMarkdown(fs.readFileSync(VOCAB_FILE, "utf8"));

  const exists = db.prepare(`SELECT COUNT(*) AS n FROM srs_cards WHERE source_type='vocab' AND word=?`);
  const insert = db.prepare(`
    INSERT INTO srs_cards (source_type, source_id, prompt, answer, due_date, word, pos, zh, meaning, example, note)
    VALUES ('vocab', NULL, ?, ?, date('now'), ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const e of entries) {
      if (!e.word) continue;
      if (exists.get(e.word).n > 0) { vocabSkipped++; continue; }
      insert.run(e.word, e.word, e.word, e.pos, e.zh, e.meaning, e.example, e.note);
      vocabInserted++;
    }
  })();

  console.log(`Vocab    — inserted: ${vocabInserted}, skipped: ${vocabSkipped}`);
} else {
  console.log(`Vocab    — file not found: ${VOCAB_FILE}`);
}

db.close();
console.log("Done.");
