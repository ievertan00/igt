import { getReviewLearningData } from "../db/review-stats.mjs";
import { hashExamples } from "../features/handbook/cache.mjs";
import { generateTailoredRule } from "../features/handbook/generator.mjs";
import { beijingDate } from "../shared/timezone.mjs";
import { getHandbookPracticeAvailability } from "../features/practice/question-bank.mjs";
import { getHandbookPracticeEvidence } from "../features/practice/attempts.mjs";

function integer(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.trunc(number))) : fallback;
}

// One snapshot keeps counts, search results and pagination in the same window.
export function buildHandbook(data, { days = 90, errorType = "", search = "", limit = 5, offset = 0 } = {}) {
  const query = String(search).trim().slice(0, 200);
  const needle = query.toLocaleLowerCase();
  const size = integer(limit, 5, 1, 50);
  const start = integer(offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const rows = data.entries.flatMap((entry) => entry.diagnoses.map((diagnosis, index) => ({
    id: `${entry.entryId}:${index}`, entryId: entry.entryId, timestamp: entry.timestamp,
    error_type: diagnosis.error_type, severity: diagnosis.severity,
    original_text: entry.original_text || entry.userInput || "",
    correction: entry.correction, refine: entry.refine, explanation: diagnosis.explanation,
    remember: Array.isArray(entry.remember) ? entry.remember.join("\n") : String(entry.remember || ""),
  })));
  const matches = rows.filter((row) => !needle || [row.original_text, row.correction, row.refine, row.explanation, row.remember]
    .some((text) => String(text || "").toLocaleLowerCase().includes(needle)));
  const groups = new Map();
  for (const row of matches) {
    const group = groups.get(row.error_type) || { error_type: row.error_type, count: 0, severity: row.severity, major_count: 0, moderate_count: 0, minor_count: 0 };
    group.count++;
    const key = `${String(row.severity).toLowerCase()}_count`;
    if (key in group) group[key]++;
    groups.set(row.error_type, group);
  }
  const frequencies = [...groups.values()].sort((a, b) => b.count - a.count || a.error_type.localeCompare(b.error_type));
  const selected = frequencies.some((row) => row.error_type === errorType) ? errorType : frequencies[0]?.error_type || null;
  const examples = matches.filter((row) => row.error_type === selected)
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
  const pageOffset = examples.length ? Math.min(start, Math.floor((examples.length - 1) / size) * size) : 0;
  const categoryRows = rows.filter((row) => row.error_type === selected)
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
  const dated = categoryRows.filter((row) => Number.isFinite(Date.parse(row.timestamp)));
  return {
    days, search: query, stats: { total_inputs: data.totalInputs, total_diagnoses: rows.length },
    frequencies, selected, examples: examples.slice(pageOffset, pageOffset + size),
    pagination: { total: examples.length, limit: size, offset: pageOffset, hasMore: pageOffset + size < examples.length },
    ruleVersion: hashExamples(categoryRows.slice(0, 5)),
    evidence: selected ? {
      count: categoryRows.length,
      entries: new Set(categoryRows.map((row) => row.entryId)).size,
      days: new Set(dated.map((row) => beijingDate(new Date(row.timestamp)))).size,
      latest: dated[0]?.timestamp || null,
      ruleExamples: Math.min(5, categoryRows.length),
    } : null,
  };
}

export async function explainHandbookRule({ days = 90, errorType = "", version = "" } = {}, { getLLMManager, config = {}, loadData = getReviewLearningData, generate = generateTailoredRule } = {}) {
  if (typeof errorType !== "string" || !errorType.trim() || errorType.length > 200) {
    throw Object.assign(new Error("Choose an error category first."), { status: 400, code: "INVALID_REQUEST" });
  }
  const windowDays = integer(days, 90, 0, 3650);
  const snapshot = buildHandbook(await loadData(windowDays), { days: windowDays, errorType });
  if (snapshot.selected !== errorType) {
    throw Object.assign(new Error("No examples are available for this category."), { status: 404, code: "HANDBOOK_CATEGORY_EMPTY" });
  }
  if (version && snapshot.ruleVersion !== version) {
    throw Object.assign(new Error("Your examples have changed. Refresh the handbook and try again."), { status: 409, code: "HANDBOOK_CHANGED" });
  }
  const llm = await getLLMManager();
  const rule = await generate({ llm, config: llm.config || config, errorType, examples: snapshot.examples, incremental: true });
  if (!rule?.content) throw Object.assign(new Error("The explanation could not be generated. Please try again."), { status: 503, code: "HANDBOOK_RULE_UNAVAILABLE" });
  return { errorType, days: windowDays, ruleVersion: snapshot.ruleVersion, exampleCount: snapshot.examples.length, rule };
}

export async function getHandbook(options = {}, { availability = getHandbookPracticeAvailability, practiceEvidence = getHandbookPracticeEvidence } = {}) {
  const days = integer(options.days ?? 90, 90, 0, 3650);
  const result = buildHandbook(getReviewLearningData(days), { ...options, days });
  if (!result.selected) return result;
  try {
    result.practice = { ...await availability(result.selected), evidence: await practiceEvidence({ days, errorType: result.selected }) };
  } catch {
    // Reference notes remain usable if practice storage is unavailable.
    result.practice = { status: "unavailable", total: 0, byDifficulty: {}, evidence: null };
  }
  return result;
}
