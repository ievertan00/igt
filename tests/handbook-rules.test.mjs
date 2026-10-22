import test from "node:test";
import assert from "node:assert/strict";
import { generateTailoredRule } from "../lib/features/handbook/generator.mjs";
import { hashExamples } from "../lib/features/handbook/cache.mjs";
import { buildHandbook, explainHandbookRule } from "../lib/application/handbook.mjs";

const examples = [{ original_text: "I bought book.", correction: "I bought a book.", explanation: "Use an article.", remember: "A singular countable noun needs a determiner." }];
const config = { GeminiProModel: "test-pro" };
const data = { totalInputs: 2, entries: [
  { entryId: "one", timestamp: "2026-10-20T10:00:00Z", userInput: examples[0].original_text, ...examples[0], diagnoses: [{ error_type: "Articles", severity: "Minor", explanation: examples[0].explanation }] },
  { entryId: "two", timestamp: "2026-10-21T10:00:00Z", userInput: "She bought book.", correction: "She bought a book.", diagnoses: [{ error_type: "Articles", severity: "Minor", explanation: "Use an article." }] },
] };

function harness() {
  const stored = new Map();
  let calls = 0;
  let fail = false;
  const llm = { getCurrentProviderName: () => "gemini", generate: async (prompt, system, options) => {
    calls++;
    assert.equal(options.taskType, "handbook");
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (fail) throw new Error("private upstream detail");
    return "## Articles\nUse a determiner.";
  } };
  const cache = { load: (type) => stored.get(type), save: (type, hash, rule) => stored.set(type, { hash, rule, generatedAt: rule.generatedAt }) };
  const generate = (extra = {}) => generateTailoredRule({ llm, config, errorType: "Articles", examples, incremental: true, cache, useReference: false, ...extra });
  return { generate, calls: () => calls, fail: (value) => { fail = value; }, stored };
}

test("rules coalesce concurrent requests and reuse a valid saved explanation", async () => {
  const h = harness();
  const [first, second] = await Promise.all([h.generate(), h.generate()]);
  assert.deepEqual(first, second);
  assert.equal(h.calls(), 1);
  const cached = await h.generate();
  assert.equal(cached.cached, true);
  assert.equal(h.calls(), 1);
});

test("notes, explanation, model and prompt changes invalidate rules", async () => {
  const h = harness();
  await h.generate();
  await h.generate({ examples: [{ ...examples[0], explanation: "An updated explanation" }] });
  await h.generate({ examples: [{ ...examples[0], remember: "An updated note" }] });
  await h.generate({ config: { GeminiProModel: "another-pro" } });
  await h.generate({ config: { ...config, Prompts: { HandbookGrammarRulePrompt: "Explain {{errorType}}: {{examplesText}}" } } });
  assert.equal(h.calls(), 5);
  assert.notEqual(hashExamples([{ original_text: "a|b", correction: "c" }]), hashExamples([{ original_text: "a", correction: "b|c" }]));
});

test("failed generation is retryable and never cached", async () => {
  const h = harness();
  h.fail(true);
  assert.equal(await h.generate(), null);
  assert.equal(h.stored.size, 0);
  h.fail(false);
  assert.ok((await h.generate()).content);
  assert.equal(h.calls(), 2);
});

test("tool-assisted rules use the handbook model and endpoint changes invalidate the cache", async () => {
  const stored = new Map();
  let calls = 0;
  const llm = { getCurrentProviderName: () => "custom", generateWithTools: async (prompt, system, tools, execute, options) => {
    assert.equal(options.taskType, "handbook");
    calls++;
    return { content: "## Rule\nA useful explanation." };
  } };
  const cache = { load: (type) => stored.get(type), save: (type, hash, rule) => stored.set(type, { hash, rule }) };
  const base = { llm, errorType: "Articles", examples, cache, incremental: true, useReference: true };
  await generateTailoredRule({ ...base, config: { CustomProModel: "pro", CustomApiBase: "https://first.example/v1" } });
  await generateTailoredRule({ ...base, config: { CustomProModel: "pro", CustomApiBase: "https://second.example/v1" } });
  assert.equal(calls, 2);
});

test("category evidence and generation are independent of search and pagination", async () => {
  const snapshot = buildHandbook(data, { errorType: "Articles", search: "She", limit: 1 });
  assert.equal(snapshot.pagination.total, 1);
  assert.equal(snapshot.evidence.count, 2);
  assert.equal(snapshot.evidence.days, 2);
  let seen;
  const result = await explainHandbookRule({ days: 0, errorType: "Articles", version: snapshot.ruleVersion }, {
    loadData: async () => data, getLLMManager: async () => ({}),
    generate: async (input) => { seen = input; return { content: "A rule" }; },
  });
  assert.equal(seen.examples.length, 2);
  assert.equal(result.exampleCount, 2);
});

test("missing categories and stale snapshots never call the model", async () => {
  const deps = { loadData: () => data, getLLMManager: () => { throw new Error("Must not call"); } };
  await assert.rejects(explainHandbookRule({ errorType: "Tense" }, deps), { status: 404 });
  await assert.rejects(explainHandbookRule({ errorType: "Articles", version: "old" }, deps), { status: 409 });
  await assert.rejects(explainHandbookRule({ errorType: "" }, deps), { status: 400 });
});
