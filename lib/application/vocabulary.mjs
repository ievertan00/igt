import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../db/connection.mjs";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveSource(config = {}) {
  const raw = config.VocabularyPath || config.VocabFile || "IGT Vocabulary.md";
  if (path.isAbsolute(raw)) return raw;
  const base = config.VaultDir
    ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
    : path.join(projectRoot, "docs");
  return path.join(base, raw);
}

export function parseVocabularyMarkdown(content) {
  const lines = String(content || "").split(/\r?\n/);
  const entries = [];
  let index = 0;
  while (index < lines.length) {
    const heading = lines[index].match(/^###?\s+(.+)/);
    if (!heading) { index += 1; continue; }
    const block = [lines[index++]];
    while (index < lines.length && !/^###?\s+/.test(lines[index])) block.push(lines[index++]);
    const raw = block.join("\n");
    const field = (name) => raw.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`))?.[1]?.trim() || "";
    const word = heading[1].trim();
    const examples = [field("Example 1") || field("Example"), field("Example 2"), field("Example 3")].filter(Boolean);
    if (word) entries.push({ word, key: normalizeWord(word), pos: field("PoS").split(" · ")[0], zh: field("中文"), meaning: field("Meaning"), example: examples[0] || "", note: field("Note"), vocabDetails: { phonetic: field("PoS").split(" · ").slice(1).join(" · "), synonyms: field("Synonyms"), collocations: field("Collocations"), examples, note: field("Note") } });
  }
  return entries;
}

function contentChanged(source, card) {
  return ["word", "pos", "zh", "meaning", "example", "note"]
    .some((field) => String(source[field] || "") !== String(card[field] || "")) || JSON.stringify(source.vocabDetails) !== (card.vocab_details || "null");
}

export async function syncVocabularySrs({ config = {}, db: injectedDb = null, sourcePath = null } = {}) {
  const filePath = sourcePath || resolveSource(config);
  if (!fs.existsSync(filePath)) return { source: filePath, sourceEntries: 0, inserted: 0, updated: 0, unchanged: 0, skippedDuplicates: [] };
  const entries = parseVocabularyMarkdown(fs.readFileSync(filePath, "utf8"));
  const duplicateKeys = [...new Set(entries.filter((entry, index) => entries.findIndex((candidate) => candidate.key === entry.key) !== index).map((entry) => entry.key))];
  const uniqueEntries = entries.filter((entry) => !duplicateKeys.includes(entry.key));
  const db = injectedDb || await getDb();
  const cards = db.prepare("SELECT id, word, pos, zh, meaning, example, note, vocab_details FROM srs_cards WHERE source_type = 'vocab'").all();
  const byKey = new Map(cards.map((card) => [normalizeWord(card.word), card]));
  const missing = uniqueEntries.filter((entry) => !byKey.has(entry.key));
  const updates = uniqueEntries.filter((entry) => byKey.has(entry.key) && contentChanged(entry, byKey.get(entry.key)));
  const insert = db.prepare("INSERT INTO srs_cards (source_type, source_id, prompt, answer, due_date, word, pos, zh, meaning, example, note, vocab_details) VALUES ('vocab', NULL, ?, ?, date('now', 'localtime'), ?, ?, ?, ?, ?, ?, ?)");
  const update = db.prepare("UPDATE srs_cards SET word = ?, prompt = ?, answer = ?, pos = ?, zh = ?, meaning = ?, example = ?, note = ?, vocab_details = ? WHERE id = ? AND source_type = 'vocab'");
  db.transaction(() => {
    for (const entry of missing) insert.run(entry.word, entry.word, entry.word, entry.pos, entry.zh, entry.meaning, entry.example, entry.note, JSON.stringify(entry.vocabDetails));
    for (const entry of updates) {
      const card = byKey.get(entry.key);
      update.run(entry.word, entry.word, entry.word, entry.pos, entry.zh, entry.meaning, entry.example, entry.note, JSON.stringify(entry.vocabDetails), card.id);
    }
  })();
  return { source: filePath, sourceEntries: entries.length, inserted: missing.length, updated: updates.length, unchanged: uniqueEntries.length - missing.length - updates.length, skippedDuplicates: duplicateKeys };
}
