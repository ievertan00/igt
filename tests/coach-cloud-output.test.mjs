import { test } from "node:test";
import assert from "node:assert/strict";
import custom from "../lib/server/llm/custom.mjs";
import deepseek from "../lib/server/llm/deepseek.mjs";
import { createServer } from "node:http";
import { generateCoachReport } from "../lib/application/coach-report.mjs";

test("Coach cloud reports reserve enough output for reasoning and identify token exhaustion", async () => {
  const bodies = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    bodies.push(JSON.parse(body));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "Planning the diagnostic report." } }] }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const config = { ModelProfileId: "fixture", CustomApiKeys: ["fixture"], CustomProModel: "reasoning-pro",
    CustomApiBase: `http://127.0.0.1:${server.address().port}` };
  const manager = { config, getCurrentProviderName: () => "custom",
    generateWithFallback: (input, system, options) => custom.generateWithFallback(input, system, { ...options, config }) };
  const deps = { getLLMManager: async () => manager, loadData: () => ({ entries: [{
    entryId: "cloud-budget", source: "grammar", timestamp: new Date().toISOString(), userInput: "I read book.", diagnoses: [],
  }] }) };
  try {
    await assert.rejects(generateCoachReport({ language: "zh-CN", refresh: true }, deps), { code: "COACH_REPORT_TRUNCATED" });
    assert.equal(bodies.length, 1, "token exhaustion must not trigger an identical language-validation retry");
    assert.equal(bodies[0].max_tokens, 32768);
    config.CoachOutputTokens = "49152";
    await assert.rejects(generateCoachReport({ language: "zh-CN", refresh: true }, deps), { code: "COACH_REPORT_TRUNCATED" });
    assert.equal(bodies.at(-1).max_tokens, 49152);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("OpenAI-compatible requests omit implicit output limits and honor explicit budgets", async () => {
  const bodies = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    bodies.push(JSON.parse(body));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "Complete response" } }] }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const config = { ModelProfileId: "fixture", DeepseekApiKeys: ["fixture"], DeepseekProModel: "reasoning-pro",
    DeepseekApiBase: `http://127.0.0.1:${server.address().port}` };
  try {
    for (const maxOutputTokens of [undefined, 32768]) {
      const options = { config, taskType: "handbook", maxOutputTokens };
      for (const generate of [deepseek.generate, deepseek.generateWithFallback]) {
        assert.equal(await generate("input", "system", options), "Complete response");
        assert.equal(bodies.at(-1).max_tokens, maxOutputTokens);
        assert.equal(Object.hasOwn(bodies.at(-1), "max_tokens"), maxOutputTokens !== undefined);
      }
      const result = await deepseek.generateWithTools("input", "system", [], async () => ({}), options);
      assert.equal(result.content, "Complete response");
      assert.equal(bodies.at(-1).max_tokens, maxOutputTokens);
      assert.equal(Object.hasOwn(bodies.at(-1), "max_tokens"), maxOutputTokens !== undefined);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

