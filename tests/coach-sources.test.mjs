import test from "node:test";
import assert from "node:assert/strict";
import { parseCoachPracticeLog, loadCoachReportData } from "../lib/application/coach-sources.mjs";
import { buildReportEvidence, generateCoachReport } from "../lib/application/coach-report.mjs";
import { reportMarkdown } from "../lib/application/coach-report-store.mjs";

const block = (date, answer = "I read book.", hints = "- Hints used: 2/3\n") => `## Practice · ${date}
- Mode: practice-sentence
- Context: work
${hints}- Prompt: 请描述阅读。
- Your answer: ${answer}
- Reference answer: I read a book.
- Score: 95
- Feedback: Check the determiner.
This is saved model feedback, not learner output.

`;
const now = Date.parse("2026-11-04T12:00:00Z");
test("Practice Markdown preserves source, originals, prompts, feedback and assistance separately", () => {
  const text = block("2026-11-03T10:00:00.000Z");
  const [entry] = parseCoachPracticeLog(`# Practice log\n\n${text}`.replace(/\n/g, "\r\n"));
  assert.equal(entry.source, "practice");
  assert.equal(entry.userInput, "I read book.");
  assert.equal(entry.correction, "");
  assert.equal(entry.practice.referenceAnswer, "I read a book.");
  assert.equal(entry.practice.hintsUsed, 2);
  assert.match(entry.practice.feedback, /not learner output/);
  assert.equal(Object.hasOwn(entry.practice, "score"), false);
  assert.equal(parseCoachPracticeLog(text + block("2026-11-04T10:00:00Z"))[0].entryId,
    parseCoachPracticeLog(text)[0].entryId, "appending preserves existing source IDs");
  assert.equal(parseCoachPracticeLog(block("invalid", "" )).length, 0);
  assert.equal(parseCoachPracticeLog(block("2026-11-03", "I read a book.", ""))[0].practice.hintsUsed, null);
  assert.equal(parseCoachPracticeLog(block("2026-11-03", "I read a book.", "- Hints used: 0/3\n"))[0].practice.hintsUsed, 0);
});

test("Coach reads the configured Practice log and discloses missing or unreadable sources", () => {
  const grammar = { source: "grammar", entryId: "g1", userInput: "I write.", timestamp: "2026-11-03", diagnoses: [] };
  const deps = { config: { PracticePath: "C:\\fixtures\\02_Practice_Log.md" }, readReviews: () => ({ entries: [grammar] }),
    readFile: file => { assert.equal(file, "C:\\fixtures\\02_Practice_Log.md"); return block("2026-11-03"); } };
  const data = loadCoachReportData(0, deps);
  assert.equal(data.entries.length, 2);
  assert.equal(data.sourceStatus.practice, "available");
  for (const [code, status] of [["ENOENT", "missing"], ["EACCES", "unavailable"]]) {
    const result = loadCoachReportData(0, { ...deps, readFile: () => { throw Object.assign(new Error("fixture"), { code }); } });
    assert.equal(result.entries.length, 1);
    assert.equal(result.sourceStatus.practice, status);
  }
  const partial = loadCoachReportData(0, { ...deps, readReviews: () => { throw new Error("Unavailable"); } });
  assert.equal(partial.entries.length, 1);
  assert.equal(partial.sourceStatus.grammar, "unavailable");
});

test("sampling retains both sources when Practice greatly outnumbers Grammar", () => {
  const grammar = { source: "grammar", entryId: "g1", timestamp: "2026-10-15", userInput: "I write.", diagnoses: [] };
  const practice = Array.from({ length: 200 }, (_, i) => ({ source: "practice", entryId: `p${i}`, timestamp: new Date(now - i * 86400000).toISOString(), userInput: `Answer ${i}`, diagnoses: [] }));
  const data = buildReportEvidence([...practice, grammar], {}, now);
  assert.equal(data.evidence.length, 80);
  assert.equal(data.evidence.filter(item => item.source === "grammar").length, 1);
  assert.equal(data.evidence.filter(item => item.source === "practice").length, 79);
});

test("report evidence includes Practice-only windows and excludes other sources", async () => {
  const practice = parseCoachPracticeLog(block("2026-11-03T10:00:00Z") + block("2026-09-01T10:00:00Z", "I read a book."));
  const text = { source: "text", entryId: "text1", timestamp: "2026-11-03", userInput: "Other source", diagnoses: [] };
  const data = buildReportEvidence([...practice, text], { days: 7 }, now);
  assert.equal(data.totalChecks, 1);
  assert.deepEqual(data.sourceCounts, { grammar: 0, practice: 1 });
  assert.equal(data.coverage.excludedOtherSources, 1);
  assert.equal(data.evidence[0].source, "practice");
  assert.equal(data.evidence[0].practice.hintsUsed, 2);
  assert.notEqual(data.version, buildReportEvidence([{ ...practice[0], practice: { ...practice[0].practice, hintsUsed: 0 } }], { days: 7 }, now).version);
  let markdown = "## 1. Executive Summary\nLimited evidence. [S1]\n## 2. Learning Data & Evidence Analysis\nPractice only.\n## 3. English Proficiency Assessment\nWriting only.\n## 4. Language Knowledge & Weakness Diagnosis\nPossible article difficulty.\n## 5. Personalized Learning Recommendations\nFocus on noun phrases.";
  markdown = markdown.replace("Possible article difficulty.", Array.from({ length: 8 }, (_, i) => `### 4.${i + 1}. Diagnosis\nInsufficient evidence.`).join("\n\n"));
  const result = await generateCoachReport({ days: 7, language: "en", refresh: true }, {
    now, loadData: () => ({ entries: practice }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async (input, system) => {
      assert.equal(JSON.parse(input).evidence[0].practice.referenceAnswer, "I read a book.");
      assert.match(system, /Hints used > 0 means assisted performance/);
      return { markdown, evidenceIds: ["S1"] };
    } }),
  });
  const exported = reportMarkdown(result);
  assert.match(exported, /Source: 02_Practice_Log/);
  assert.match(exported, /Hints used: 2/);
  assert.match(exported, /Reference answer \(unverified\): I read a book/);
  assert.doesNotMatch(exported, /practice-log-[a-f0-9]/);
});
