import fs from "node:fs";
import { createHash } from "node:crypto";
import { parseSavedVocabularyBlock, resolveVocabularyPath } from "../shared/vocabulary-source.mjs";

export function listSavedVocabulary({ config = {}, search = "", sort = "az", limit = 25, offset = 0 } = {}) {
  if (typeof search !== "string" || search.length > 200 || !["az", "newest"].includes(sort)
    || !Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw Object.assign(new Error("Choose a valid search, sort order and page size."), { status: 400, code: "INVALID_REQUEST" });
  }
  let content;
  try { content = fs.readFileSync(resolveVocabularyPath(config), "utf8"); }
  catch (error) {
    if (error.code === "ENOENT") return { words: [], total: 0, totalSaved: 0, sourceAvailable: false, limit, offset: 0, hasMore: false };
    throw Object.assign(new Error("Could not read your saved vocabulary. Check the vocabulary file in Settings."), { status: 500, code: "VOCABULARY_UNAVAILABLE" });
  }
  const occurrences = new Map();
  const entries = content.split(/(?=^#{2,3}[^\S\r\n]+)/m)
    .filter(block => /^#{2,3}[^\S\r\n]+\S/.test(block))
    .map((block, index) => {
      const entry = parseSavedVocabularyBlock(block);
      const key = entry.word.trim().toLowerCase();
      const occurrence = occurrences.get(key) || 0;
      occurrences.set(key, occurrence + 1);
      return { ...entry, id: createHash("sha256").update(`${key}\0${occurrence}`).digest("hex").slice(0, 20), index };
    });
  const query = search.trim().toLowerCase();
  const filtered = entries.filter(entry => !query || [entry.word, entry.pos, entry.zh, entry.meaning,
    entry.synonyms, entry.collocations, entry.example, entry.example2, entry.example3, entry.note, entry.memory]
    .some(value => String(value || "").toLowerCase().includes(query)));
  filtered.sort(sort === "az"
    ? (a, b) => a.word.localeCompare(b.word, "en", { sensitivity: "base" }) || a.index - b.index
    : (a, b) => (b.added || "").localeCompare(a.added || "") || b.index - a.index);
  const total = filtered.length;
  const pageOffset = Math.min(offset, Math.max(0, Math.ceil(total / limit) - 1) * limit);
  return {
    words: filtered.slice(pageOffset, pageOffset + limit).map(({ index, ...entry }) => entry),
    total, totalSaved: entries.length, sourceAvailable: true, limit, offset: pageOffset,
    hasMore: pageOffset + limit < total,
  };
}
