import test from "node:test";
import assert from "node:assert/strict";
import { buildReportEvidence, generateCoachReport } from "../lib/application/coach-report.mjs";
import { createServer } from "node:http";
import { registerCoachRoutes } from "../lib/server/routes/coach.mjs";
import { dispatch } from "../lib/server/router.mjs";
import ollama from "../lib/server/llm/ollama.mjs";
import fs from "node:fs";
import path from "node:path";

const now = Date.parse("2026-11-03T12:00:00Z");
const entry = (id, source = "grammar") => ({ entryId: String(id), source, timestamp: new Date(now - id * 86400000).toISOString(), userInput: "I read book.", correction: "I read a book.", diagnoses: [] });
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
    return { markdown: "检查名词限定词并在新语境中练习。[S1]", evidenceIds: ["S1"] };
  } }) };
  await generateCoachReport({ refresh: true }, deps);
});
test("short model source labels resolve to saved records and unused listed sources are omitted", async () => {
  const deps = { now, loadData: () => ({ entries: [entry(3), entry(4)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async input => {
    const data = JSON.parse(input);
    assert.equal(data.evidence[0].entryId, "S1");
    return { markdown: "根据原句，建议检查单数可数名词前的限定词。[S1, S2]", evidenceIds: ["S1"] };
  } }) };
  const result = await generateCoachReport({ refresh: true }, deps);
  assert.match(result.markdown, /\[3\]/);
  assert.deepEqual(result.evidenceIds, ["3", "4"]);
});
test("Chinese reports retry English-only output with explicit language instructions", async () => {
  let calls = 0;
  const llm = { config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async (input, system) => {
    assert.match(system, /简体中文/);
    calls++;
    return { markdown: calls === 1 ? "## Finding\nOriginal [0]: I read book." : "## 学习分析\n根据你的原句，建议检查单数可数名词前的限定词。[0]", evidenceIds: ["0"] };
  } };
  const deps = { now, loadData: () => ({ entries: [{ ...entry(0), userInput: "I write report." }] }), getLLMManager: async () => llm };
  const report = await generateCoachReport({ language: "zh-CN", refresh: true }, deps);
  assert.match(report.markdown, /学习分析/);
  assert.equal(calls, 2);
  llm.generateWithFallback = async () => ({ markdown: "## Finding\nEnglish only [0]", evidenceIds: ["0"] });
  await assert.rejects(generateCoachReport({ language: "zh-CN", refresh: true }, deps), { code: "COACH_REPORT_LANGUAGE_MISMATCH" });
});
test("malformed JSON and unsupported citations receive one validation retry", async () => {
  for (const bad of ['{"markdown":"unfinished', { markdown: "这是错误的来源引用，请重新核对。[S999]", evidenceIds: ["S999"] }]) {
    let calls = 0;
    const deps = { now, loadData: () => ({ entries: [entry(77)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async (_, system) => {
      calls++;
      if (calls === 1) return bad;
      assert.match(system, /failed validation/);
      return { markdown: "建议检查名词前的限定词并换场景练习。[S1]", evidenceIds: ["S1"] };
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
  assert.equal(Object.values(data.monthly).reduce((a, b) => a + b), 120);
});
test("report validates evidence, caches, refreshes and rejects bad input and empty windows", async () => {
  let calls = 0;
  const llm = { config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async () => { calls++; return { markdown: "## 学习分析\n建议检查单数可数名词前的限定词。[0] I read book.", evidenceIds: ["0"] }; } };
  const deps = { now, loadData: () => ({ entries: [entry(0)] }), getLLMManager: async () => llm };
  const [first, second] = await Promise.all([generateCoachReport({}, deps), generateCoachReport({}, deps)]);
  assert.deepEqual(first, second); assert.equal(calls, 1);
  assert.equal((await generateCoachReport({}, deps)).cached, true);
  await generateCoachReport({ refresh: true }, deps); assert.equal(calls, 2);
  await generateCoachReport({ language: "en" }, deps); assert.equal(calls, 3);
  await assert.rejects(generateCoachReport({ language: "bad" }, deps), { status: 400 });
  await assert.rejects(generateCoachReport({}, { ...deps, loadData: () => ({ entries: [] }) }), { status: 404 });
  llm.generateWithFallback = async () => ({ markdown: "这是一条缺乏记录支持的错误分析 [unknown]", evidenceIds: ["unknown"] });
  await assert.rejects(generateCoachReport({ refresh: true }, deps), { status: 503 });
  llm.generateWithFallback = async () => ({ markdown: "建议检查单数可数名词前的限定词 [0] 和未知记录 [unknown]", evidenceIds: ["0"] });
  await assert.rejects(generateCoachReport({ refresh: true }, deps), { status: 503 });
  llm.generateWithFallback = async () => new Promise(() => {});
  await assert.rejects(generateCoachReport({ refresh: true }, { ...deps, timeoutMs: 5 }), { status: 503 });
});
test("HTTP report route returns report and actionable empty-window errors", async () => {
  fs.mkdirSync(path.join(process.cwd(), ".tmp-coach-runtime"), { recursive: true });
  const reportDirectory = fs.mkdtempSync(path.join(process.cwd(), ".tmp-coach-runtime", "route-test-"));
  registerCoachRoutes({ reportDirectory, now, loadData: () => ({ entries: [entry(0)] }), getLLMManager: async () => ({ config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async () => ({ markdown: "建议检查单数可数名词前的限定词 [0]", evidenceIds: ["0"] }) }) });
  const server = createServer(dispatch);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/coach/report`, { method: "POST", body: JSON.stringify({ refresh: true }) });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.markdown, "建议检查单数可数名词前的限定词 [0]");
    assert.ok(report.savedPath);
    const list = await (await fetch(`http://127.0.0.1:${server.address().port}/coach/reports`)).json();
    assert.equal(list.length, 1);
    const saved = await (await fetch(`http://127.0.0.1:${server.address().port}/coach/reports/${list[0].savedId}`)).json();
    assert.equal(saved.markdown, report.markdown);
    const bad = await fetch(`http://127.0.0.1:${server.address().port}/coach/report`, { method: "POST", body: JSON.stringify({ days: -1 }) });
    assert.equal(bad.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(reportDirectory, { recursive: true, force: true }); }
});
