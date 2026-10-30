import fs from "node:fs";
import path from "node:path";
import { readReviewLog } from "../db/review-log.mjs";
import { getDb } from "../db/connection.mjs";
import { resolveVocabularyPath, parseSavedVocabularyBlock } from "../shared/vocabulary-source.mjs";
import { listAskNotes } from "./ask-notes.mjs";
import { buildCoachPatterns } from "./grammar-coach.mjs";

const root = path.join(import.meta.dirname, "..", "..");
const resolve = value => path.isAbsolute(value) ? value : path.join(root, value);
const labels = { grammar: "Saved Grammar checks", text: "Saved text analyses", writing: "Unclassified writing records", practice: "Sentence Practice attempts", vocabulary: "Words saved", ask: "Ask notes saved", other: "Other recorded attempts" };
const DAY = 86400000, BEIJING = 8 * 3600000;
const dateKey = time => new Date(time + BEIJING).toISOString().slice(0, 10);
const reviewTime = value => {
  const raw = String(value || "");
  return Date.parse(/Z$/.test(raw) ? raw.replace(/Z$/, "+08:00") : /[+-]\d\d:\d\d$/.test(raw) ? raw : raw.replace(" ", "T") + "+08:00");
};
const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
function sentenceCount(event) {
  if (event.type === "practice") return 1;
  if (!["grammar", "text"].includes(event.type)) return 0;
  return [...segmenter.segment(String(event.title || ""))].filter(({ segment }) => /[\p{L}\p{N}]/u.test(segment)).length;
}
export function buildEffortTrend(events, now = Date.now()) {
  const today = Date.parse(`${dateKey(now)}T00:00:00+08:00`);
  const totals = new Map();
  for (const event of events) {
    const time = Date.parse(event.timestamp);
    if (!Number.isFinite(time) || time > now) continue;
    const key = dateKey(time);
    totals.set(key, (totals.get(key) || 0) + sentenceCount(event));
  }
  const sum = (start, end) => [...totals].reduce((total, [key, count]) => key >= start && key < end ? total + count : total, 0);
  const daily = Array.from({ length: 7 }, (_, index) => {
    const time = today - (6 - index) * DAY, date = dateKey(time);
    return { date, label: `${date.slice(5)} ${new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Shanghai" }).format(time)}`, count: totals.get(date) || 0 };
  });
  const monday = today - ((new Date(today + BEIJING).getUTCDay() + 6) % 7) * DAY;
  const weekly = Array.from({ length: 4 }, (_, index) => {
    const time = monday - (3 - index) * 7 * DAY, start = dateKey(time);
    return { start, count: sum(start, dateKey(time + 7 * DAY)) };
  });
  const current = new Date(today + BEIJING);
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 5 + index, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 4 + index, 1)).toISOString().slice(0, 10);
    return { start, count: sum(start, end) };
  });
  const current7 = daily.reduce((total, item) => total + item.count, 0);
  const previous7 = sum(dateKey(today - 13 * DAY), dateKey(today - 6 * DAY));
  return { daily, weekly, monthly, momentum: { current: current7, previous: previous7, percent: previous7 ? Math.round((current7 - previous7) / previous7 * 100) : null } };
}
export function buildOverviewPriorities(entries, now = Date.now()) {
  const counts = new Map(), seen = new Set();
  for (const entry of entries) {
    const time = reviewTime(entry.timestamp);
    if (!["grammar", "text"].includes(entry.source) || !Number.isFinite(time) || time > now || time < now - 30 * DAY) continue;
    if (entry.entryId && seen.has(entry.entryId)) continue;
    if (entry.entryId) seen.add(entry.entryId);
    for (const diagnosis of entry.diagnoses || []) {
      const type = String(diagnosis.error_type || "").trim();
      if (type) counts.set(type, (counts.get(type) || 0) + 1);
    }
  }
  return [...counts].map(([errorType, hits]) => ({ errorType, hits })).sort((a, b) => b.hits - a.hits || a.errorType.localeCompare(b.errorType)).slice(0, 3);
}
function integer(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < min || number > max) throw Object.assign(new Error("Invalid Overview window or pagination."), { status: 400, code: "INVALID_REQUEST" });
  return number;
}
export function buildLearningOverview(events, options = {}, { now = Date.now(), coverage = [], patterns = [], reviewEntries = [] } = {}) {
  const days = integer(options.days, 30, 0, 3650), limit = integer(options.limit, 10, 1, 100), offset = integer(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const seen = new Set();
  const unique = events.filter(event => {
    if (event.type === "review" || event.activity_type === "review-vocabulary") return false;
    const key = `${event.source}:${event.id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const undated = unique.filter(event => !Number.isFinite(Date.parse(event.timestamp))).length;
  const matching = unique.filter(event => {
    const time = Date.parse(event.timestamp);
    return Number.isFinite(time) && time <= now && (!days || time >= now - days * 86400000);
  }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || `${a.source}:${a.id}`.localeCompare(`${b.source}:${b.id}`));
  const counts = new Map();
  for (const event of matching) counts.set(event.type, (counts.get(event.type) || 0) + 1);
  return { days, summary: Object.entries(labels).filter(([type]) => counts.has(type)).map(([type, label]) => ({ type, label, count: counts.get(type) })),
    events: matching.slice(offset, offset + limit), pagination: { total: matching.length, limit, offset, hasMore: offset + limit < matching.length },
    coverage, undated, patterns: patterns.slice(0, 3).map(({ errorType, checks }) => ({ errorType, checks })),
    effort: buildEffortTrend(unique, now), priorities: buildOverviewPriorities(reviewEntries, now) };
}

export async function loadLearningActivity(config, { readReviews = () => readReviewLog(resolve(config.ReviewPath || "00_Review_logs.md")),
  readAttempts = async () => (await getDb({ readonly: true })).prepare("SELECT id, activity_type, prompt, target_pattern, score, created_at FROM practice_attempts WHERE activity_type != 'review-vocabulary' ORDER BY id DESC").all(),
  readVocabulary = () => {
    const file = resolveVocabularyPath(config);
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf8").split(/(?=^###?\s+)/m).filter(block => /^###?\s+/.test(block)).map(parseSavedVocabularyBlock);
  }, readNotes = () => listAskNotes(config).notes } = {}) {
  const events = [], coverage = [];
  let reviewEntries = [];
  const results = await Promise.allSettled([Promise.resolve().then(readReviews), Promise.resolve().then(readAttempts), Promise.resolve().then(readVocabulary), Promise.resolve().then(readNotes)]);
  const names = ["Saved writing", "Practice attempts", "Saved vocabulary", "Saved Ask notes"];
  results.forEach((result, index) => {
    if (result.status === "rejected") { coverage.push({ source: names[index], status: "unavailable", note: "This source could not be read. Other activity is still shown." }); return; }
    const records = result.value;
    coverage.push({ source: names[index], status: "available", note: index === 1 ? "Recorded practice attempts only. Vocabulary reviews are excluded." : "Only dated saved records appear in the timeline." });
    if (index === 0) {
      reviewEntries = records;
      for (const entry of records) {
        const type = entry.source === "grammar" ? "grammar" : entry.source === "text" ? "text" : "writing";
        const raw = String(entry.timestamp || "");
        const timestamp = /Z$/.test(raw) ? raw.replace(/Z$/, "+08:00") : /[+-]\d\d:\d\d$/.test(raw) ? raw : raw.replace(" ", "T") + "+08:00";
        events.push({ source: "review-log", id: entry.entryId, type, timestamp, title: entry.userInput, href: type === "grammar" ? `#handbook?days=0&entry=${encodeURIComponent(entry.entryId)}` : null });
      }
    } else if (index === 1) {
      for (const attempt of records) {
        if (attempt.activity_type === "review-vocabulary") continue;
        const type = attempt.activity_type === "practice-sentence" ? "practice" : "other";
        const raw = String(attempt.created_at || "");
        const timestamp = /(?:Z|[+-]\d\d:\d\d)$/.test(raw) ? raw : raw.replace(" ", "T") + "Z";
        events.push({ source: "practice-attempts", id: String(attempt.id), type, timestamp, title: attempt.target_pattern || attempt.prompt || "Recorded attempt", score: attempt.score, href: null });
      }
    } else if (index === 2) {
      const unique = new Map(records.map(entry => [entry.word.trim().toLocaleLowerCase(), entry]));
      coverage.push({ source: "Vocabulary inventory", status: "inventory", count: unique.size, note: "Current saved words; inventory is separate from activity in the selected window." });
      for (const [id, entry] of unique) events.push({ source: "vocabulary", id, type: "vocabulary", timestamp: entry.added ? `${entry.added}T00:00:00+08:00` : null, precision: "day", title: entry.word, href: "#word-library" });
    } else {
      for (const note of records) {
        const date = note.content.match(/^\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/m);
        events.push({ source: "ask-notes", id: note.id, type: "ask", timestamp: date ? `${date[1]}T${date[2]}:00+08:00` : null, title: note.title || note.id.replace(/\.md$/, ""), href: "#ask?view=notes" });
      }
    }
  });
  coverage.push({ source: "Translation, listening and conversation", status: "not-recorded", note: "These tools do not retain a durable activity history. Unsaved interactions are not counted." });
  return { events, coverage, reviewEntries };
}

export async function getLearningOverview(options = {}, { config = {}, now = Date.now(), loadActivity = loadLearningActivity } = {}) {
  // Validate before reading any source.
  const query = buildLearningOverview([], options, { now });
  const { events, coverage, reviewEntries = [] } = await loadActivity(config);
  const coach = buildCoachPatterns(reviewEntries, { days: query.days }, now);
  return buildLearningOverview(events, options, { now, coverage, patterns: coach.patterns, reviewEntries });
}
