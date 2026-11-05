import test from "node:test";
import assert from "node:assert/strict";
import { buildReportEvidence, generateCoachReport } from "../lib/application/coach-report.mjs";
import { createServer } from "node:http";
import { registerCoachRoutes } from "../lib/server/routes/coach.mjs";
import { dispatch } from "../lib/server/router.mjs";
import ollama from "../lib/server/llm/ollama.mjs";
import fs from "node:fs";
import path from "node:path";

const diagnostic = text => `## 1. Executive Summary\n${text}\n\n## 2. Learning Data & Evidence Analysis\nLimited saved writing.\n\n## 3. English Proficiency Assessment\nOnly observed writing.\n\n## 4. Language Knowledge & Weakness Diagnosis\n${Array.from({ length: 8 }, (_, i) => `### 4.${i + 1}. Diagnosis\nInsufficient evidence for mastery.`).join("\n\n")}\n\n## 5. Personalized Learning Recommendations\nFocus on the observed weaknesses.`;

const now = Date.parse("2026-11-03T12:00:00Z");
const entry = (id, source = "grammar") => ({ entryId: String(id), source, timestamp: new Date(now - id * 86400000).toISOString(), userInput: "I read book.", correction: "I read a book.", diagnoses: [] });
test("complete Markdown reports with quotes and newlines do not require a JSON envelope", async () => {
  const markdown = diagnostic('Check "a book" and the path `C:\\notes`. [S1]');
  const deps = { now, loadData: () => ({ entries: [entry(803)] }), getLLMManager: async () => ({
    config: {}, getCurrentProviderName: () => "ollama", generateWithFallback: async (_, system, options) => {
      assert.match(system, /Return only the complete report as Markdown/);
      assert.equal(options.jsonSchema, undefined, "long Markdown must not be constrained to a JSON string");
      return markdown;
    },
  }) };
  const result = await generateCoachReport({ language: "en", refresh: true }, deps);
  assert.equal(result.markdown, markdown.replace("[S1]", "[803]"));
  assert.deepEqual(result.evidenceIds, ["803"]);
});
test("fenced Markdown and legacy JSON preserve report text without changing source validation", async () => {
  const markdown = diagnostic('Use "a book". [S1]\n\n```text\nC:\\notes\n```');
  for (const raw of ["```markdown\n" + markdown + "\n```", JSON.stringify({ markdown }), "```json\n" + JSON.stringify({ markdown }) + "\n```"] ) {
    const result = await generateCoachReport({ language: "en", refresh: true }, {
      now, loadData: () => ({ entries: [entry(804)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async () => raw }),
    });
    assert.equal(result.markdown, markdown.replace("[S1]", "[804]"));
    assert.deepEqual(result.evidenceIds, ["804"]);
  }
});
test("invalid JSON envelopes retry as Markdown while incomplete and uncited Markdown stay rejected", async () => {
  let calls = 0;
  const deps = { now, loadData: () => ({ entries: [entry(805)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "ollama", generateWithFallback: async (_, system) => {
    calls++;
    if (calls === 1) return '{"markdown":"A report with an unescaped "quote"\nand newline."}';
    assert.match(system, /Return the complete report directly as Markdown, without JSON/);
    return diagnostic('Use "a book". [S1]');
  } }) };
  assert.deepEqual((await generateCoachReport({ language: "en", refresh: true }, deps)).evidenceIds, ["805"]);
  assert.equal(calls, 2);
  for (const [raw, code] of [["## 1. Executive Summary\nIncomplete [S1]", "COACH_REPORT_INVALID_STRUCTURE"], [diagnostic("Uncited finding."), "COACH_REPORT_INVALID_EVIDENCE"], [diagnostic("Unknown [S99]"), "COACH_REPORT_INVALID_EVIDENCE"]]) {
    await assert.rejects(generateCoachReport({ language: "en", refresh: true }, { ...deps,
      getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "ollama", generateWithFallback: async () => raw }),
    }), { code });
  }
});
test("slow local report and its validation retry can finish beyond the old 175-second deadline", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const outcome = generateCoachReport({ language: "en", refresh: true }, {
    now, loadData: () => ({ entries: [entry(801)] }), getLLMManager: async () => ({
      config: {}, getCurrentProviderName: () => "ollama", generateWithFallback: async () => {
        calls++;
        await new Promise(resolve => setTimeout(resolve, 100_000));
        return calls === 1 ? "{" : { markdown: diagnostic("Limited article evidence. [S1]"), evidenceIds: ["S1"] };
      },
    }),
  }).then(value => ({ value }), error => ({ error }));
  await new Promise(setImmediate);
  context.mock.timers.tick(100_000);
  await new Promise(setImmediate);
  assert.equal(calls, 2);
  context.mock.timers.tick(100_000);
  const result = await outcome;
  assert.equal(result.error?.code, undefined, result.error?.message);
  assert.deepEqual(result.value.evidenceIds, ["801"]);
});
test("configured report deadline still aborts generation and permits a fresh retry", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let signal, calls = 0;
  const llm = { config: { CoachReportTimeoutMs: "250" }, getCurrentProviderName: () => "ollama", generateWithFallback: async (_, __, options) => {
    calls++;
    signal = options.signal;
    if (calls > 1) return { markdown: diagnostic("Limited article evidence. [S1]"), evidenceIds: ["S1"] };
    return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("Cancelled")), { once: true }));
  } };
  const deps = { now, loadData: () => ({ entries: [entry(802)] }), getLLMManager: async () => llm };
  const outcome = generateCoachReport({ language: "en", refresh: true }, deps).catch(error => error);
  await new Promise(setImmediate);
  context.mock.timers.tick(249);
  assert.equal(signal.aborted, false);
  context.mock.timers.tick(1);
  assert.equal((await outcome).code, "COACH_REPORT_TIMEOUT");
  assert.equal(signal.aborted, true);
  assert.equal((await generateCoachReport({ language: "en" }, deps)).cached, false);
  assert.equal(calls, 2);
});
test("diagnostic evidence separates observations, affected records and distinct-input recurrence", () => {
  const diagnosis = { error_type: "Articles", severity: "Minor", explanation: "A singular count noun needs a determiner.", evidence: "book", suggestion: "a book" };
  const data = buildReportEvidence([
    { ...entry(0), refine: "I am reading a book.", diagnoses: [diagnosis, diagnosis, { error_type: "Punctuation" }] },
    { ...entry(1), userInput: " I  read book. ", diagnoses: [diagnosis] },
    { ...entry(2), userInput: "She bought car.", diagnoses: [diagnosis] },
    { ...entry(3), userInput: "I read a book." },
  ], {}, now);
  const articles = data.patternCandidates.find(item => item.errorType === "Article Usage");
  assert.equal(articles.category, "Grammar");
  assert.equal(articles.observations, 4);
  assert.equal(articles.affectedRecords, 3);
  assert.equal(articles.distinctInputs, 2);
  assert.equal(data.diagnosisStatistics.records, 4);
  assert.equal(data.duplicateInputs, 1);
  assert.equal(data.evidence[0].refine, "I am reading a book.");
  assert.equal(data.evidence[0].diagnoses[0].severity, "Minor");
  assert.equal(data.evidence[0].diagnoses[0].suggestion, "a book");
  assert.equal(buildReportEvidence([
    { ...entry(0), diagnoses: [diagnosis] }, { ...entry(1), diagnoses: [diagnosis] },
  ], {}, now).patternCandidates.length, 0, "retries cannot establish recurrence");
});

test("generation integrates pattern evidence into the diagnostic framework with short citations", async () => {
  const entries = [0, 1].map(id => ({ ...entry(id), userInput: id ? "She bought car." : "I read book.", diagnoses: [{ error_type: "Article Usage" }] }));
  await generateCoachReport({ language: "en", refresh: true }, { now, loadData: () => ({ entries }), getLLMManager: async () => ({
    config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async (input, system) => {
      const data = JSON.parse(input);
      assert.deepEqual(Object.keys(data.taxonomy), ["Grammar", "Vocabulary", "Mechanics", "Style", "Clarity"]);
      assert.deepEqual(data.patternCandidates[0].evidenceIds, ["S1", "S2"]);
      assert.equal(data.patternCandidates[0].distinctInputs, 2);
      assert.match(system, /integrate individual patterns HERE/);
      assert.match(system, /one concise.*paragraph/);
      assert.match(system, /Do not create a study plan/);
      assert.match(system, /Omit unsupported competencies entirely/);
      assert.match(system, /AI corrections\/refinements never establish mastery/);
      return { markdown: diagnostic("Article use needs attention. [S1] [S2]"), evidenceIds: ["S1", "S2"] };
    },
  }) });
});

test("incomplete diagnostic sections receive one retry and are never cached", async () => {
  let calls = 0;
  const deps = { now, loadData: () => ({ entries: [entry(5)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async (_, system) => {
    calls++;
    if (calls % 2 === 0) assert.match(system, /COACH_REPORT_INVALID_STRUCTURE/);
    return { markdown: "## 1. Executive Summary\nIncomplete report. [S1]", evidenceIds: ["S1"] };
  } }) };
  await assert.rejects(generateCoachReport({ language: "en", refresh: true }, deps), { code: "COACH_REPORT_INVALID_STRUCTURE" });
  await assert.rejects(generateCoachReport({ language: "en" }, deps), { code: "COACH_REPORT_INVALID_STRUCTURE" });
  assert.equal(calls, 4);
});
test("Ollama report requests preserve context/output budgets and reject truncated output", async () => {
  const originalFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ done_reason: "length", message: { content: '{"markdown":"cut off' } }) };
  };
  try {
    await assert.rejects(ollama.generateWithFallback("input", "prompt", {
      config: { OllamaGemmaProModel: "fixture" }, taskType: "handbook",
      contextTokens: 16384, maxOutputTokens: 8192,
    }), { code: "LLM_OUTPUT_TRUNCATED" });
    assert.equal(body.options.num_ctx, 16384);
    assert.equal(body.options.num_predict, 8192);
  } finally { globalThis.fetch = originalFetch; }
});
test("report generation requests a larger context window for local models", async () => {
  const deps = { now, loadData: () => ({ entries: [entry(123)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "ollama", generateWithFallback: async (_, __, options) => {
    assert.equal(options.contextTokens, 16384);
    assert.equal(options.maxOutputTokens, 8192);
    return { markdown: diagnostic("检查名词限定词并在新语境中练习。[S1]"), evidenceIds: ["S1"] };
  } }) };
  await generateCoachReport({ refresh: true }, deps);
});
test("short model source labels resolve to saved records and unused listed sources are omitted", async () => {
  const deps = { now, loadData: () => ({ entries: [entry(3), entry(4)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async input => {
    const data = JSON.parse(input);
    assert.equal(data.evidence[0].entryId, "S1");
    return { markdown: diagnostic("根据原句，建议检查单数可数名词前的限定词。[S1, S2]"), evidenceIds: ["S1"] };
  } }) };
  const result = await generateCoachReport({ refresh: true }, deps);
  assert.match(result.markdown, /\[3\]/);
  assert.deepEqual(result.evidenceIds, ["3", "4"]);
});
test("Chinese citation repair keeps the requested language explicit at the end of both prompts", async () => {
  let calls = 0;
  const deps = { now, loadData: () => ({ entries: [entry(806)] }), getLLMManager: async () => ({
    config: {}, getCurrentProviderName: () => "ollama", generateWithFallback: async (input, system) => {
      calls++;
      const data = JSON.parse(input);
      assert.match(data.outputRequirements, /简体中文/);
      assert.match(data.outputRequirements, /\[S1\]/);
      assert.ok(system.endsWith(data.outputRequirements), "language and citation instructions must follow all repair feedback");
      if (calls === 1) return diagnostic("根据原始输入，单数可数名词前缺少限定词。来源 S1。");
      assert.match(system, /COACH_REPORT_INVALID_EVIDENCE/);
      return diagnostic("根据原始输入，单数可数名词前缺少限定词。[S1]");
    },
  }) };
  const report = await generateCoachReport({ language: "zh-CN", refresh: true }, deps);
  assert.equal(calls, 2);
  assert.deepEqual(report.evidenceIds, ["806"]);
});

test("Chinese reports retry English-only output with explicit language instructions", async () => {
  let calls = 0;
  const llm = { config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async (input, system) => {
    assert.match(system, /简体中文/);
    calls++;
    return { markdown: calls === 1 ? "## Finding\nOriginal [0]: I read book." : diagnostic("## 学习分析\n根据你的原句，建议检查单数可数名词前的限定词。[0]"), evidenceIds: ["0"] };
  } };
  const deps = { now, loadData: () => ({ entries: [{ ...entry(0), userInput: "I write report." }] }), getLLMManager: async () => llm };
  const report = await generateCoachReport({ language: "zh-CN", refresh: true }, deps);
  assert.match(report.markdown, /学习分析/);
  assert.equal(calls, 2);
  llm.generateWithFallback = async () => ({ markdown: diagnostic("## Finding\nEnglish only [0]"), evidenceIds: ["0"] });
  await assert.rejects(generateCoachReport({ language: "zh-CN", refresh: true }, deps), { code: "COACH_REPORT_LANGUAGE_MISMATCH" });
});

test("bounded citation ranges expand to exact sources and invalid endpoints are rejected", async () => {
  let citation = "S1–S2";
  const deps = { now, loadData: () => ({ entries: [entry(10), entry(11)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async () => ({ markdown: diagnostic(`Observed difficulty. [${citation}]`), evidenceIds: [] }) }) };
  const result = await generateCoachReport({ language: "en", refresh: true }, deps);
  assert.deepEqual(result.evidenceIds, ["10", "11"]);
  assert.match(result.markdown, /\[10\] \[11\]/);
  for (const invalid of ["S1-S999999999", "S2-S1", "S0-S1"]) {
    citation = invalid;
    await assert.rejects(generateCoachReport({ language: "en", refresh: true }, deps), { code: "COACH_REPORT_INVALID_EVIDENCE" });
  }
});
test("malformed JSON and unsupported citations receive one validation retry", async () => {
  for (const bad of ['{"markdown":"unfinished', { markdown: diagnostic("这是错误的来源引用，请重新核对。[S999]"), evidenceIds: ["S999"] }]) {
    let calls = 0;
    const deps = { now, loadData: () => ({ entries: [entry(77)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async (_, system) => {
      calls++;
      if (calls === 1) return bad;
      assert.match(system, /failed validation/);
      return { markdown: diagnostic("建议检查名词前的限定词并换场景练习。[S1]"), evidenceIds: ["S1"] };
    } }) };
    const report = await generateCoachReport({ refresh: true }, deps);
    assert.equal(calls, 2);
    assert.deepEqual(report.evidenceIds, ["77"]);
  }
});
test("report includes clean checks, excludes other sources, and samples across chronology", () => {
  const data = buildReportEvidence([...Array.from({ length: 120 }, (_, i) => entry(i)), entry(121, "text"), entry(122, "unknown")], {}, now);
  assert.equal(data.totalChecks, 120);
  assert.equal(data.evidence.length, 80);
  assert.equal(data.evidence[0].entryId, "0");
  assert.equal(data.evidence.at(-1).entryId, "119");
  assert.equal(data.duplicateInputs, 119);
  assert.equal(data.coverage.unclassified, 1);
  assert.equal(data.sampled, true);
  assert.equal(data.observationPeriod.end, entry(0).timestamp);
  assert.equal(data.observationPeriod.start, entry(119).timestamp);
  assert.equal(Object.hasOwn(data, "monthly"), false);
});
test("report validates evidence, caches, refreshes and rejects bad input and empty windows", async () => {
  let calls = 0;
  const llm = { config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async () => { calls++; return { markdown: diagnostic("## 学习分析\n建议检查单数可数名词前的限定词。[0] I read book."), evidenceIds: ["0"] }; } };
  const deps = { now, loadData: () => ({ entries: [entry(0)] }), getLLMManager: async () => llm };
  const [first, second] = await Promise.all([generateCoachReport({}, deps), generateCoachReport({}, deps)]);
  assert.deepEqual(first, second); assert.equal(calls, 1);
  assert.equal((await generateCoachReport({}, deps)).cached, true);
  await generateCoachReport({ refresh: true }, deps); assert.equal(calls, 2);
  await generateCoachReport({ language: "en" }, deps); assert.equal(calls, 3);
  await assert.rejects(generateCoachReport({ language: "bad" }, deps), { status: 400 });
  await assert.rejects(generateCoachReport({}, { ...deps, loadData: () => ({ entries: [] }) }), { status: 404 });
  llm.generateWithFallback = async () => ({ markdown: diagnostic("这是一条缺乏记录支持的错误分析 [unknown]"), evidenceIds: ["unknown"] });
  await assert.rejects(generateCoachReport({ refresh: true }, deps), { status: 503 });
  llm.generateWithFallback = async () => ({ markdown: diagnostic("建议检查单数可数名词前的限定词 [0] 和未知记录 [unknown]"), evidenceIds: ["0"] });
  await assert.rejects(generateCoachReport({ refresh: true }, deps), { status: 503 });
  llm.generateWithFallback = async () => new Promise(() => {});
  await assert.rejects(generateCoachReport({ refresh: true }, { ...deps, timeoutMs: 5 }), { status: 503 });
});
test("HTTP report route returns report and actionable empty-window errors", async () => {
  fs.mkdirSync(path.join(process.cwd(), ".tmp-coach-runtime"), { recursive: true });
  const reportDirectory = fs.mkdtempSync(path.join(process.cwd(), ".tmp-coach-runtime", "route-test-"));
  registerCoachRoutes({ reportDirectory, now, loadData: () => ({ entries: [entry(0)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async () => ({ markdown: diagnostic("建议检查单数可数名词前的限定词 [0]"), evidenceIds: ["0"] }) }) });
  const server = createServer(dispatch);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/coach/report`, { method: "POST", body: JSON.stringify({ refresh: true }) });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.markdown, diagnostic("建议检查单数可数名词前的限定词 [0]"));
    assert.ok(report.savedPath);
    const list = await (await fetch(`http://127.0.0.1:${server.address().port}/coach/reports`)).json();
    assert.equal(list.length, 1);
    const saved = await (await fetch(`http://127.0.0.1:${server.address().port}/coach/reports/${list[0].savedId}`)).json();
    assert.equal(saved.markdown, report.markdown);
    const bad = await fetch(`http://127.0.0.1:${server.address().port}/coach/report`, { method: "POST", body: JSON.stringify({ days: -1 }) });
    assert.equal(bad.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(reportDirectory, { recursive: true, force: true }); }
});
