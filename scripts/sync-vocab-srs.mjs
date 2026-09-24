import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import configLoader from "../lib/shared/config-loader.mjs";
import { beijingISO } from "../lib/shared/timezone.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = configLoader.load();
const args = process.argv.slice(2);
const sourceArg = args.find((arg) => arg.startsWith("--source="));
const rawSourcePath = sourceArg ? sourceArg.slice("--source=".length) : config.VocabularyPath;
const sourcePath = rawSourcePath?.replace(/^(?:"|')|(?:"|')$/g, "");
const apply = args.includes("--apply");

if (!sourcePath) throw new Error("Missing --source=<Markdown path>");
if (!fs.existsSync(sourcePath)) throw new Error(`Vocabulary source not found: ${sourcePath}`);

const dbPath = config.DbPath || path.join(projectRoot, "igt_data.db");
if (!fs.existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseEntries(content) {
  const lines = content.split(/\r?\n/);
  const entries = [];
  let index = 0;
  while (index < lines.length) {
    const heading = lines[index].match(/^###?\s+(.+)/);
    if (!heading) {
      index++;
      continue;
    }
    const block = [lines[index++]];
    while (index < lines.length && !/^###?\s+/.test(lines[index])) block.push(lines[index++]);
    const raw = block.join("\n");
    const field = (name) => raw.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`))?.[1]?.trim() || "";
    const word = heading[1].trim();
    const examples = [field("Example 1") || field("Example"), field("Example 2"), field("Example 3")].filter(Boolean);
    if (word) entries.push({
      word,
      key: normalizeWord(word),
      pos: field("PoS").split(" · ")[0],
      vocabDetails: { phonetic: field("PoS").split(" · ").slice(1).join(" · "), synonyms: field("Synonyms"), collocations: field("Collocations"), examples, note: field("Note") },
      zh: field("中文"),
      meaning: field("Meaning"),
      example: field("Example 1") || field("Example"),
      note: field("Note"),
    });
  }
  return entries;
}

function changed(source, card) {
  return ["word", "pos", "zh", "meaning", "example", "note"]
    .some((field) => String(source[field] || "") !== String(card[field] || "")) || JSON.stringify(source.vocabDetails) !== (card.vocab_details || "null");
}

const sourceEntries = parseEntries(fs.readFileSync(sourcePath, "utf8"));
const duplicateKeys = new Set(sourceEntries.filter((entry, index) =>
  sourceEntries.findIndex((candidate) => candidate.key === entry.key) !== index
).map((entry) => entry.key));
const uniqueEntries = sourceEntries.filter((entry) => !duplicateKeys.has(entry.key));

const db = new Database(dbPath, { readonly: !apply });
try {
  if (apply) {
    const stamp = beijingISO().replace(/[-:TZ.]/g, "").slice(0, 14);
    const backupPath = path.join(projectRoot, `igt_data.db.before-vocab-sync-${stamp}.backup`);
    await db.backup(backupPath);
    console.log(`Backup: ${backupPath}`);
  }
  const cards = db.prepare(`
    SELECT id, word, pos, zh, meaning, example, note, vocab_details
    FROM srs_cards
    WHERE source_type = 'vocab'
  `).all();
  const byKey = new Map(cards.map((card) => [normalizeWord(card.word), card]));
  const missing = uniqueEntries.filter((entry) => !byKey.has(entry.key));
  const updates = uniqueEntries.filter((entry) => byKey.has(entry.key) && changed(entry, byKey.get(entry.key)));
  const unchanged = uniqueEntries.length - missing.length - updates.length;
  const sourceKeys = new Set(uniqueEntries.map((entry) => entry.key));
  const orphaned = cards.filter((card) => !sourceKeys.has(normalizeWord(card.word)));

  console.log(JSON.stringify({
    source: sourcePath,
    database: dbPath,
    source_entries: sourceEntries.length,
    source_unique: uniqueEntries.length,
    source_duplicates: [...duplicateKeys],
    srs_cards: cards.length,
    missing_from_srs: missing.map(({ word }) => word),
    fields_to_update: updates.map(({ word }) => word),
    unchanged: unchanged,
    orphaned_srs_cards: orphaned.map(({ word }) => word),
    mode: apply ? "apply" : "dry-run",
  }, null, 2));

  if (!apply) process.exit(0);
  if (duplicateKeys.size) throw new Error(`Ambiguous duplicate source entries: ${[...duplicateKeys].join(", ")}`);

  const insert = db.prepare(`
    INSERT INTO srs_cards
      (source_type, prompt, answer, due_date, word, pos, zh, meaning, example, note, vocab_details)
    VALUES ('vocab', ?, ?, date('now', 'localtime'), ?, ?, ?, ?, ?, ?, ?)
  `);
  const update = db.prepare(`
    UPDATE srs_cards
    SET word = ?, prompt = ?, answer = ?, pos = ?, zh = ?, meaning = ?, example = ?, note = ?, vocab_details = ?
    WHERE id = ? AND source_type = 'vocab'
  `);
  const sync = db.transaction(() => {
    for (const entry of missing) {
      insert.run(entry.word, entry.word, entry.word, entry.pos, entry.zh, entry.meaning, entry.example, entry.note, JSON.stringify(entry.vocabDetails));
    }
    for (const entry of updates) {
      const card = byKey.get(entry.key);
      update.run(entry.word, entry.word, entry.word, entry.pos, entry.zh, entry.meaning, entry.example, entry.note, JSON.stringify(entry.vocabDetails), card.id);
    }
  });
  sync();
  console.log(JSON.stringify({ inserted: missing.length, updated: updates.length, untouched: unchanged }, null, 2));
} finally {
  db.close();
}
