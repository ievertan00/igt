import test from "node:test";
import assert from "node:assert/strict";
import { buildCoachPatterns, getCoachPatterns, explainCoachPattern, clearGrammarCoachCache } from "../lib/application/grammar-coach.mjs";
import { buildLearningOverview, buildEffortTrend, buildOverviewPriorities, loadLearningActivity, getLearningOverview } from "../lib/application/learning-overview.mjs";
import { runCoach, runOverview, parseLearningArgs } from "../lib/cli/commands/learning.mjs";

const now = Date.parse("2026-10-30T12:00:00Z");
const issue = { error_type: "Articles", explanation: "Use a determiner", severity: "Minor" };
const entry = (entryId, source = "grammar", diagnoses = [issue]) => ({ entryId, source, timestamp: "2026-10-29T12:00:00Z", userInput: "I read book.", correction: "I read a book.", diagnoses });
const entries = [entry("a", "grammar", [issue, issue]), entry("b"), entry("text", "text"), entry("legacy", "unknown"), entry("clean", "grammar", [])];
const loadData = () => ({ entries, attempts: [{ score: 0, target_error_type: "Tense" }] });
const good = { observedPattern: "Articles omitted in saved checks.", principle: "A singular countable noun usually needs a determiner.", qualifications: "Proper names and fixed expressions differ.", keyStructure: "a/an/the + singular countable noun", possibleCauses: [{ hypothesis: "You may be overlooking countability.", evidenceIds: ["a"] }], examples: [{ entryId: "b", explanation: "Book is singular and countable here." }], drills: { phase1_selfCorrect: [{ incorrect: "I read book.", hint: "Book is countable and singular.", answer: "I read a book." }], phase2_transfer: [{ prompt: "Describe reading a newspaper.", structureHint: "article + noun", answer: "I read a newspaper." }], phase3_delayedRecall: [{ intent: "Say you finished reading a report.", structureUsed: "article + singular countable noun" }] }, relatedStructures: ["some/any + plural noun", "the + specific noun"] };

test("Coach uses distinct saved Grammar checks, never text, legacy or Practice evidence", () => {
  const data = getCoachPatterns({ days: 90 }, { loadData, now });
  assert.equal(data.checks, 3);
  assert.equal(data.patterns.length, 1);
  assert.equal(data.patterns[0].checks, 2);
  assert.equal(data.patterns[0].observations, 3);
  assert.equal(data.coverage.unclassified, 1);
  assert.equal(data.patterns[0].evidence, undefined);
  assert.deepEqual(buildCoachPatterns([entry("a", "grammar", [issue, issue])], { days: 90 }, now).patterns, []);
  assert.equal(buildCoachPatterns(Array.from({ length: 125 }, (_, id) => entry(String(id))), { days: 0 }, now).patterns[0].checks, 125);
});

test("Coach detail validates evidence, merges requests, caches content, and invalidates changed feedback", async () => {
  clearGrammarCoachCache(); let calls = 0;
  const llm = { config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return JSON.stringify(good); } };
  const deps = { loadData, now, getLLMManager: async () => llm };
  const options = { days: 90, errorType: "Articles" };
  const [one, two] = await Promise.all([explainCoachPattern(options, deps), explainCoachPattern(options, deps)]);
  assert.equal(calls, 1); assert.deepEqual(one, two);
  assert.equal((await explainCoachPattern(options, deps)).cached, true);
  await explainCoachPattern({ ...options, refresh: true }, deps); assert.equal(calls, 2);
  const changed = entries.map(item => item.entryId === "b" ? { ...item, correction: "I read the book." } : item);
  await explainCoachPattern(options, { ...deps, loadData: () => ({ entries: changed }) }); assert.equal(calls, 3);
  await assert.rejects(explainCoachPattern({ ...options, version: "stale" }, deps), { status: 409 });
  await assert.rejects(explainCoachPattern({ errorType: "Tense" }, deps), { status: 404 });
});

test("failed or fabricated explanations are not cached", async () => {
  clearGrammarCoachCache(); let calls = 0;
  const llm = { config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async () => { calls++; return JSON.stringify(calls === 1 ? { ...good, examples: [{ entryId: "invented", explanation: "Unsupported" }] } : good); } };
  const deps = { loadData, now, getLLMManager: async () => llm };
  await assert.rejects(explainCoachPattern({ errorType: "Articles" }, deps), { status: 503 });
  assert.equal((await explainCoachPattern({ errorType: "Articles" }, deps)).cached, false);
  assert.equal(calls, 2);
});

test("Overview keeps source identities, separate measures, dates and pagination", () => {
  const events = [
    { source: "log", id: "1", type: "grammar", timestamp: "2026-10-29T00:00:00Z" },
    { source: "log", id: "1", type: "grammar", timestamp: "2026-10-29T00:00:00Z" },
    { source: "attempts", id: "1", type: "review", timestamp: "2026-10-30T00:00:00Z" },
    { source: "attempts", id: "2", type: "practice", timestamp: "2020-01-01T00:00:00Z" },
    { source: "notes", id: "unknown", type: "ask", timestamp: null },
  ];
  const result = buildLearningOverview(events, { days: 30, limit: 1 }, { now });
  assert.deepEqual(result.summary.map(item => [item.type, item.count]), [["grammar", 1]]);
  assert.equal(result.pagination.total, 1); assert.equal(result.pagination.hasMore, false); assert.equal(result.undated, 1);
  assert.equal(result.events[0].source, "log");
  assert.equal(buildLearningOverview(events, { days: 0 }, { now }).pagination.total, 2);
  assert.throws(() => buildLearningOverview([], { days: -1 }), { status: 400 });
});

test("activity adapters preserve usable sources on failure and never reconstruct reviews from card state", async () => {
  const result = await loadLearningActivity({}, {
    readReviews: () => entries,
    readAttempts: () => [{ id: 1, activity_type: "review-vocabulary", target_pattern: "book", score: 100, created_at: "2026-10-29 12:00:00" }],
    readVocabulary: () => [{ word: "book", added: "2026-10-28" }, { word: "Book", added: "2026-10-28" }, { word: "undated" }],
    readNotes: () => { throw new Error("unavailable"); },
  });
  assert.equal(result.events.filter(item => item.type === "review").length, 0);
  assert.equal(result.events.filter(item => item.type === "vocabulary").length, 2);
  assert.equal(result.coverage.find(item => item.source === "Saved Ask notes").status, "unavailable");
  assert.equal(result.events.find(item => item.type === "grammar").timestamp, "2026-10-29T12:00:00+08:00");
  const data = await getLearningOverview({ days: 0 }, { now, loadActivity: async () => result });
  assert.equal(data.patterns[0].errorType, "Articles"); assert.equal(data.undated, 1);
});

test("Effort uses Beijing calendar dates, sentence totals, fixed windows and zero baseline", () => {
  const clock = Date.parse("2026-01-02T16:30:00Z"); // January 3 in Beijing.
  const events = [
    { type: "grammar", timestamp: "2026-01-02T16:00:00Z", title: "One sentence. Another sentence!" },
    { type: "practice", timestamp: "2026-01-02T15:59:59Z" },
    { type: "practice", timestamp: "2025-12-27T00:00:00Z" },
    { type: "text", timestamp: "2025-12-20T00:00:00Z", title: "A sentence. Another one." },
    { type: "review", timestamp: "2026-01-02T16:00:00Z", title: "Not a sentence attempt." },
    { type: "vocabulary", timestamp: "2026-01-02T16:00:00Z", title: "word" },
    { type: "grammar", timestamp: "2026-01-03T18:00:00Z", title: "Future." },
    { type: "grammar", timestamp: null, title: "Undated." },
  ];
  const trend = buildEffortTrend(events, clock);
  assert.equal(trend.daily.length, 7);
  assert.deepEqual(trend.daily.at(-1), { date: "2026-01-03", label: "01-03 Sat", count: 2 });
  assert.equal(trend.daily.at(-2).count, 1);
  assert.deepEqual(trend.momentum, { current: 3, previous: 1, percent: 200 });
  assert.deepEqual(trend.weekly.map(item => item.count), [0, 2, 1, 3]);
  assert.equal(trend.monthly.length, 6);
  assert.deepEqual(trend.monthly.slice(-2), [{ start: "2025-12-01", count: 3 }, { start: "2026-01-01", count: 3 }]);
  assert.equal(buildEffortTrend([], clock).momentum.percent, null);
  assert.equal(buildEffortTrend([events[0]], clock).momentum.percent, null);
  assert.equal(buildEffortTrend([events[2]], clock).momentum.percent, -100);
  const data = buildLearningOverview(events.map((item, id) => ({ ...item, id, source: "fixture" })), { days: 1, limit: 1 }, { now: clock });
  assert.deepEqual(data.effort, trend); // History filter and pagination cannot change effort.
  assert.equal(data.summary.some(item => item.type === "review"), false);
});

test("Priorities rank 30-day diagnosis hits, include single checks and exclude unknown sources", () => {
  const make = (id, types, timestamp = "2026-10-29T12:00:00Z", source = "grammar") => ({ entryId: id, source, timestamp, diagnoses: types.map(error_type => ({ error_type })) });
  const records = [make("one", ["Articles", "Articles", "Tense"]), make("two", ["Tense", "Agreement"], undefined, "text"), make("fourth", ["Word order"]),
    make("one", ["Articles", "Articles", "Tense"]), make("unknown", ["Legacy", "Legacy"], undefined, "unknown"),
    make("old", ["Old"], "2026-09-01T00:00:00Z"), make("future", ["Future"], "2026-11-01T00:00:00Z")];
  assert.deepEqual(buildOverviewPriorities(records, now), [{ errorType: "Articles", hits: 2 }, { errorType: "Tense", hits: 2 }, { errorType: "Agreement", hits: 1 }]);
  assert.deepEqual(buildLearningOverview([], { days: 90 }, { now, reviewEntries: records }).priorities, buildOverviewPriorities(records, now));
  assert.deepEqual(buildOverviewPriorities([], now), []);
});

test("CLI defaults are read-only; explanations are explicit; legacy task flags fail", async () => {
  let output = "", generations = 0;
  const io = { write: text => { output += text; }, writeError: text => { output += text; } };
  const list = () => getCoachPatterns({ days: 90 }, { loadData, now });
  const explain = async () => { generations++; return { explanation: good, evidence: [{ entryId: "b", original: "I read book.", correction: "I read a book." }] }; };
  assert.equal(await runCoach([], { ...io, list, explain }), 0); assert.equal(generations, 0);
  assert.match(output, /2 affected checks/);
  assert.equal(await runCoach(["--type", "Articles"], { ...io, list, explain }), 0); assert.equal(generations, 1);
  for (const flag of ["--complete=1", "--pause-plan", "--resources=web", "--goal=work"]) assert.equal(await runCoach([flag], { ...io, list, explain }), 1);
  assert.throws(() => parseLearningArgs(["--refresh"], "coach"));
  output = "";
  const data = buildLearningOverview([], { days: 30 }, { now });
  assert.equal(await runOverview([], { ...io, load: async options => { assert.equal(options.days, 30); return data; } }), 0);
  assert.match(output, /No dated activity/);
});
