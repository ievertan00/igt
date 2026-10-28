import fs from "node:fs";
import { createHash } from "node:crypto";
import { parseSavedVocabularyBlock, resolveVocabularyPath } from "../shared/vocabulary-source.mjs";
import { beijingDate } from "../shared/timezone.mjs";

const wordKey = value => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const evidenceOf = record => JSON.parse(record.feedback) || {};

// Display-only evidence labels. Scheduling ratings/streaks are not recall evidence.
function learningStatus(card, records) {
  if (!card) return "insufficient-history";
  if (!card.total_reviews && !records.length) return "new";
  const latest = records[0];
  if (!latest || (card.last_reviewed && card.last_reviewed > latest.created_at)) return "insufficient-history";
  const feedback = evidenceOf(latest);
  if (feedback.correct === false) return "needs-reinforcement";
  if (feedback.correct !== true || typeof feedback.audioPlayed !== "boolean") return "insufficient-history";
  if (feedback.audioPlayed) return "learning";
  const dates = new Set();
  for (const record of records) {
    const evidence = evidenceOf(record);
    if (evidence.correct !== true || evidence.audioPlayed !== false) break;
    const date = new Date(`${record.created_at.replace(" ", "T")}Z`);
    if (Number.isNaN(date.getTime())) break;
    dates.add(beijingDate(date));
  }
  if (dates.size < 2) return "learning";
  // Actual elapsed time between recorded reviews, never the scheduled interval.
  const elapsed = records[1] ? Date.parse(`${latest.created_at.replace(" ", "T")}Z`)
    - Date.parse(`${records[1].created_at.replace(" ", "T")}Z`) : 0;
  return elapsed >= 7 * 86400000 ? "well-retained" : "retained";
}

function readReviewEvidence(db) {
  return db.prepare(`SELECT id, created_at, feedback FROM practice_attempts
    WHERE activity_type = 'review-vocabulary' AND json_valid(feedback)
    ORDER BY created_at DESC, id DESC`).all();
}

export function readVocabularyHistory(db, { cardId, offset = 0, limit = 20 }) {
  if (!Number.isInteger(cardId) || cardId < 1 || !Number.isInteger(offset) || offset < 0
    || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw Object.assign(new Error("Choose a valid word and history page."), { status: 400, code: "INVALID_REQUEST" });
  }
  const where = `activity_type = 'review-vocabulary' AND json_valid(feedback)
    AND json_extract(feedback, '$.cardId') = ?`;
  const total = db.prepare(`SELECT count(*) AS n FROM practice_attempts WHERE ${where}`).get(cardId).n;
  // Only the recorded resulting interval is stored. Never infer the previous interval.
  const records = db.prepare(`SELECT id, created_at, learner_answer, reference_answer, feedback
    FROM practice_attempts WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`).all(cardId, limit, offset);
  return { records, total, offset, hasMore: offset + records.length < total };
}

export function listSavedVocabulary({ config = {}, db = null, search = "", sort = "az", schedule = "all", status = "all", limit = 25, offset = 0 } = {}) {
  if (typeof search !== "string" || search.length > 200 || !["az", "newest", "next-review"].includes(sort)
    || !["all", "due", "upcoming", "unscheduled"].includes(schedule)
    || !["all", "new", "learning", "needs-reinforcement", "retained", "well-retained", "insufficient-history"].includes(status)
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
  const today = beijingDate();
  const cardsByWord = new Map();
  const evidenceByCard = new Map();
  const entryCounts = new Map();
  for (const entry of entries) entryCounts.set(wordKey(entry.word), (entryCounts.get(wordKey(entry.word)) || 0) + 1);
  if (db) {
    for (const card of db.prepare("SELECT id, word, due_date, total_reviews, last_reviewed, interval_days FROM srs_cards WHERE source_type = 'vocab'").all()) {
      const key = wordKey(card.word);
      const matches = cardsByWord.get(key) || [];
      matches.push(card); cardsByWord.set(key, matches);
    }
    for (const record of readReviewEvidence(db)) {
      const id = evidenceOf(record).cardId;
      const matches = evidenceByCard.get(id) || [];
      matches.push(record); evidenceByCard.set(id, matches);
    }
  }
  for (const entry of entries) {
    const matches = cardsByWord.get(wordKey(entry.word)) || [];
    // Ambiguous duplicate entries must not inherit another entry's learning evidence.
    const card = matches.length === 1 && entryCounts.get(wordKey(entry.word)) === 1 ? matches[0] : null;
    entry.srs = card || null;
    entry.learningStatus = db ? learningStatus(card, evidenceByCard.get(card?.id) || []) : "unavailable";
    entry.recordedReviews = card ? (evidenceByCard.get(card.id) || []).length : 0;
  }
  const overview = db ? {
    due: entries.filter(entry => entry.srs?.due_date && entry.srs.due_date <= today).length,
    overdue: entries.filter(entry => entry.srs?.due_date && entry.srs.due_date < today).length,
    dueToday: entries.filter(entry => entry.srs?.due_date === today).length,
    retained: entries.filter(entry => entry.learningStatus === "retained").length,
    wellRetained: entries.filter(entry => entry.learningStatus === "well-retained").length,
    distribution: Object.fromEntries(["new", "learning", "needs-reinforcement", "retained", "well-retained", "insufficient-history"]
      .map(status => [status, entries.filter(entry => entry.learningStatus === status).length])),
  } : null;
  const filtered = entries.filter(entry => (status === "all" || entry.learningStatus === status)
    && (schedule === "all" || (schedule === "unscheduled" ? !entry.srs?.due_date
      : entry.srs?.due_date && (schedule === "due" ? entry.srs.due_date <= today : entry.srs.due_date > today)))
    && (!query || [entry.word, entry.pos, entry.zh, entry.meaning,
    entry.synonyms, entry.collocations, entry.example, entry.example2, entry.example3, entry.note, entry.memory]
    .some(value => String(value || "").toLowerCase().includes(query))));
  filtered.sort(sort === "az"
    ? (a, b) => a.word.localeCompare(b.word, "en", { sensitivity: "base" }) || a.index - b.index
    : sort === "next-review" ? (a, b) => (a.srs?.due_date || "9999").localeCompare(b.srs?.due_date || "9999") || a.word.localeCompare(b.word, "en")
    : (a, b) => (b.added || "").localeCompare(a.added || "") || b.index - a.index);
  const total = filtered.length;
  const pageOffset = Math.min(offset, Math.max(0, Math.ceil(total / limit) - 1) * limit);
  return {
    words: filtered.slice(pageOffset, pageOffset + limit).map(({ index, ...entry }) => entry),
    total, totalSaved: entries.length, sourceAvailable: true, overview, today, limit, offset: pageOffset,
    hasMore: pageOffset + limit < total,
  };
}
