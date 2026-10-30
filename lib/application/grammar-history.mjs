import { getReviewLearningData } from "../db/review-stats.mjs";
import { beijingISO } from "../shared/timezone.mjs";

function invalid(message) {
  return Object.assign(new Error(message), { status: 400, code: "INVALID_REQUEST" });
}

function integer(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < min || number > max) throw invalid("Invalid history pagination or date window.");
  return number;
}

// A whole explicitly saved Grammar check is the unit of history and evidence.
// Unknown legacy origins remain available to other readers, but are never guessed here.
export function buildGrammarHistory(entries, options = {}, now = Date.now()) {
  const days = integer(options.days, 90, 0, 3650);
  const limit = integer(options.limit, 10, 1, 100);
  const offset = integer(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const diagnosis = options.diagnosis ?? "all";
  if (!["all", "with", "none"].includes(diagnosis)) throw invalid("Choose diagnosis=all, with, or none.");
  const errorType = String(options.errorType ?? "").trim();
  const entryId = String(options.entryId ?? "").trim();
  if (errorType && diagnosis === "none") throw invalid("A mistake type cannot be combined with no diagnosed mistakes.");
  const search = String(options.search ?? "").trim();
  if (search.length > 200 || errorType.length > 200) throw invalid("History filters must be at most 200 characters.");
  const needle = search.toLocaleLowerCase();
  // Review Log timestamps encode Beijing wall time with a Z suffix.
  const clockNow = Date.parse(beijingISO(new Date(now)));
  const cutoff = clockNow - days * 86400000;
  const inWindow = (entry) => !days || (Number.isFinite(Date.parse(entry.timestamp)) && Date.parse(entry.timestamp) >= cutoff && Date.parse(entry.timestamp) <= clockNow);
  const windowEntries = entries.filter(inWindow);
  const grammar = windowEntries.filter((entry) => entry.source === "grammar");
  const coverage = {
    grammar: grammar.length,
    excludedOtherSources: windowEntries.filter((entry) => entry.source === "text").length,
    unclassified: windowEntries.filter((entry) => !["grammar", "text"].includes(entry.source)).length,
    undated: entries.filter((entry) => !Number.isFinite(Date.parse(entry.timestamp))).length,
  };
  const categories = new Map();
  for (const entry of grammar) {
    for (const type of new Set((entry.diagnoses || []).map((item) => item.error_type).filter(Boolean))) {
      categories.set(type, (categories.get(type) || 0) + 1);
    }
  }
  const matching = grammar.filter((entry) => {
    if (entryId && entry.entryId !== entryId) return false;
    const diagnoses = entry.diagnoses || [];
    if (diagnosis === "none" && diagnoses.length) return false;
    if (diagnosis === "with" && !diagnoses.length) return false;
    if (errorType && !diagnoses.some((item) => item.error_type === errorType)) return false;
    const fields = [entry.userInput, entry.original_text, entry.correction, entry.refine, entry.evaluate,
      ...(Array.isArray(entry.remember) ? entry.remember : [entry.remember]),
      ...diagnoses.flatMap((item) => [item.explanation, item.evidence, item.suggestion])];
    return !needle || fields.some((value) => String(value ?? "").toLocaleLowerCase().includes(needle));
  }).sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0) || String(a.entryId).localeCompare(String(b.entryId)));
  return {
    days, search, errorType, diagnosis, coverage,
    categories: [...categories].map(([errorType, checks]) => ({ errorType, checks })).sort((a, b) => b.checks - a.checks || a.errorType.localeCompare(b.errorType)),
    entries: matching.slice(offset, offset + limit),
    pagination: { total: matching.length, limit, offset, hasMore: offset + limit < matching.length },
  };
}

export function getGrammarHistory(options = {}, { loadData = getReviewLearningData, now = Date.now() } = {}) {
  // Read all records once so unknown dates and source limitations remain observable.
  return buildGrammarHistory(loadData(0).entries, options, now);
}
