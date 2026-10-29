import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { askTurn, saveAsk } from "../lib/application/ask.mjs";
import { askLanguagePrompt, validateAskLanguage } from "../lib/features/ask/language.mjs";
import * as history from "../lib/features/ask/history.mjs";

const response = { title: "现在完成时用法", answer: "I have lived here for years.", related: [], tags: ["present-perfect", "since-for"], category: "Grammar" };

test("explicit language overrides mixed-language history for Web and session requests; omission preserves prompts", async (t) => {
  const prompts = [];
  const llm = { generateWithFallback: async (question, prompt) => { prompts.push(prompt); return JSON.stringify({ ...response, question }); }, getCurrentProvider: () => ({ getModelName: () => "fixture" }) };
  const config = { Prompts: { AskPrompt: "History: {{history}}" } };
  t.after(() => history.reset("language-test"));
  for (const language of [undefined, "zh-CN", "en"]) {
    await askTurn({ question: "用中文提问", messages: [{ question: "Earlier", answer: "Earlier English answer" }], language, config, llm });
    await askTurn({ question: "English question", sessionId: "language-test", language, config, llm });
  }
  assert.ok(!prompts[0].includes("RESPONSE LANGUAGE"));
  assert.ok(!prompts[1].includes("RESPONSE LANGUAGE"));
  for (const prompt of prompts.slice(2, 4)) { assert.match(prompt, /beginner-friendly Simplified Chinese/); assert.match(prompt, /Keep English examples/); }
  for (const prompt of prompts.slice(4)) assert.match(prompt, /Use clear English/);
  await assert.rejects(askTurn({ question: "Test", messages: [], language: "fr", config, llm }), { code: "INVALID_REQUEST" });
  assert.equal(prompts.length, 6, "Invalid language must not call the provider");
  assert.equal(askLanguagePrompt(undefined), "");
  assert.throws(() => validateAskLanguage(null), { status: 400 });
});

test("summary language separates saved versions and retries; single answers stay verbatim", async (t) => {
  const parent = path.join(process.cwd(), ".cache");
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, "ask-language-"));
  t.after(() => { assert.equal(path.dirname(dir), parent); fs.rmSync(dir, { recursive: true, force: true }); });
  const config = { AskDir: dir, Prompts: { AskCompactPrompt: "Summarize the conversation." } };
  const messages = [{ question: "First", ...response }, { question: "第二个问题", ...response, answer: "中文解释，保留 since 和 for。" }];
  let calls = 0;
  const llm = { generateWithFallback: async (_, prompt) => {
    calls++;
    return JSON.stringify({ ...response, answer: prompt.includes("Use clear English") ? "English summary with since and for." : "中文总结：since 和 for。" });
  } };
  const zh = await saveAsk({ messages, language: "zh-CN", config, llm });
  const en = await saveAsk({ messages, language: "en", config, llm });
  assert.notEqual(zh.vaultFile, en.vaultFile);
  assert.match(fs.readFileSync(path.join(dir, zh.vaultFile), "utf8"), /中文总结/);
  assert.match(fs.readFileSync(path.join(dir, en.vaultFile), "utf8"), /English summary/);
  for (const [language, expected] of [["zh-CN", zh], ["en", en]]) assert.equal((await saveAsk({ messages, language, config, llm })).vaultFile, expected.vaultFile);
  assert.equal(calls, 2, "Retries reuse the version for their selected language");
  const single = await saveAsk({ messages: [messages[0]], language: "zh-CN", config, llm });
  assert.equal(single.response.answer, messages[0].answer);
  assert.equal(calls, 2, "Saving one answer never translates it");
  const again = await saveAsk({ messages: [messages[0]], language: "en", config, llm });
  assert.equal(single.vaultFile, again.vaultFile);
});
