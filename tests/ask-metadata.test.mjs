import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { askTurn, saveAsk } from "../lib/application/ask.mjs";
import { listAskNotes } from "../lib/application/ask-notes.mjs";
import { askMetadata, readAskMetadata } from "../lib/features/ask/metadata.mjs";
import * as history from "../lib/features/ask/history.mjs";

function fixture(t) {
  const parent = path.join(process.cwd(), ".cache");
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, "ask-metadata-"));
  t.after(() => { assert.equal(path.dirname(dir), parent); fs.rmSync(dir, { recursive: true, force: true }); });
  return { AskDir: dir, Prompts: { AskPrompt: "History: {{history}}", AskCompactPrompt: "Combine the consultation." } };
}
const answer = { title: '现在完成时：since 与 for 的区别', question: "When should I use since?", answer: "Use **since** for a starting point.\n\nI have lived here since 2020.", tags: ["present-perfect", "since-for"], category: "Grammar", related: [] };

test("CLI and Web generate metadata in their existing answer request and save without another model call", async (t) => {
  const config = fixture(t);
  let calls = 0;
  const llm = {
    generateWithFallback: async (input, prompt, options) => {
      calls++; assert.match(prompt, /retrieval metadata/); assert.match(prompt, /Simplified Chinese/); assert.ok(options.jsonSchema.required.includes("tags"));
      return JSON.stringify(answer);
    }, getCurrentProvider: () => ({ getModelName: () => "fixture" }),
  };
  const web = await askTurn({ messages: [], question: answer.question, config, llm });
  const saved = await saveAsk({ messages: [web.response.data], config, getLLMManager: () => { throw new Error("no extra call"); } });
  assert.equal(calls, 1);
  assert.equal(saved.metadata.metadataSource, "ai");
  assert.equal(saved.vaultFile, `${answer.title}.md`);
  const cli = await askTurn({ sessionId: "metadata-test", question: answer.question, config, llm });
  t.after(() => history.reset("metadata-test"));
  assert.deepEqual(cli.response.data.tags, answer.tags);
  const retry = await saveAsk({ sessionId: "metadata-test", config });
  assert.equal(calls, 2);
  assert.equal(retry.vaultFile, saved.vaultFile);
  assert.deepEqual(retry.metadata, saved.metadata);
  const note = listAskNotes(config).notes[0];
  assert.equal(note.title, answer.title);
  assert.equal(note.category, "Grammar");
  assert.deepEqual(note.tags, answer.tags);
  const parsed = readAskMetadata(note.content);
  assert.ok(parsed.body.includes(answer.answer));
  assert.ok(!parsed.body.includes("metadataSource:"));
});

test("whole-conversation save generates metadata in its existing summary request", async (t) => {
  const config = fixture(t);
  let calls = 0;
  const llm = { generateWithFallback: async (input, prompt) => {
    calls++; assert.match(input, /Another example/); assert.match(prompt, /retrieval metadata/); return JSON.stringify(answer);
  } };
  const result = await saveAsk({ messages: [answer, { question: "Another example?", answer: "I have worked here for years." }], config, llm });
  assert.equal(calls, 1);
  assert.deepEqual(result.metadata.tags, answer.tags);
  assert.equal(result.vaultFile, `${answer.title}.md`);
});

test("metadata normalization, YAML quoting, unsafe filenames and legacy notes", async (t) => {
  const config = fixture(t);
  const message = { ...answer, title: '冠词:CON?与[名词]', tags: ["#since for", "since for", "中文 标签", null, "<bad>"] };
  const result = await saveAsk({ messages: [message], config });
  assert.equal(result.vaultFile, "冠词CON与名词.md");
  assert.deepEqual(result.metadata.tags, ["since-for", "中文-标签", "bad"]);
  fs.writeFileSync(path.join(config.AskDir, "legacy.md"), "**Date**: 2026-01-01\n\nOld note.");
  const legacy = listAskNotes(config).notes.find((note) => note.id === "legacy.md");
  assert.equal(legacy.title, ""); assert.equal(legacy.category, ""); assert.deepEqual(legacy.tags, []);
  assert.equal(readAskMetadata(legacy.content).body, legacy.content);
  const fallback = askMetadata({ title: "Useful note", category: "invented", tags: "bad" });
  assert.equal(fallback.metadataSource, "fallback"); assert.equal(fallback.category, "Other");
  const quoted = await saveAsk({ messages: [{ ...answer, question: "A different question", title: 'since：起点\n--- / Starting point' }], config });
  assert.equal(readAskMetadata(fs.readFileSync(path.join(config.AskDir, quoted.vaultFile), "utf8")).title, 'since：起点 ---');
});

test("legacy English titles are translated once using only the title; retries reuse the Chinese filename", async (t) => {
  const config = fixture(t);
  let calls = 0;
  const old = { ...answer, title: "Since vs for" };
  const llm = { generateWithFallback: async (input, prompt, options) => {
    calls++;
    assert.deepEqual(JSON.parse(input), { title: "Since vs for" });
    assert.match(prompt, /Simplified Chinese/);
    assert.deepEqual(options.jsonSchema.required, ["title"]);
    return '```json\n{"title":"since 与 for 的区别"}\n```';
  } };
  const [a, b] = await Promise.all([saveAsk({ messages: [old], config, llm }), saveAsk({ messages: [old], config, llm })]);
  assert.equal(a.vaultFile, "since 与 for 的区别.md");
  assert.equal(b.vaultFile, a.vaultFile);
  const retry = await saveAsk({ messages: [old], config });
  assert.equal(retry.vaultFile, a.vaultFile);
  assert.equal(calls, 1);
  assert.equal(listAskNotes(config).notes.length, 1);
});

test("a missing AI title is generated even when the original question is Chinese", async (t) => {
  const config = fixture(t);
  let calls = 0;
  const result = await saveAsk({ messages: [{ question: "这里为什么用过去式？", answer: "The event happened yesterday." }], config,
    llm: { generateWithFallback: async (input) => { calls++; assert.deepEqual(JSON.parse(input), { title: "这里为什么用过去式？" }); return '{"title":"过去事件的时态选择"}'; } } });
  assert.equal(calls, 1);
  assert.equal(result.vaultFile, "过去事件的时态选择.md");
});

test("invalid or unavailable Chinese title generation never writes an English filename or clears CLI history", async (t) => {
  const config = fixture(t);
  const old = { ...answer, title: "English title" };
  history.append("title-failure", { ...old, response: old });
  t.after(() => history.reset("title-failure"));
  for (const raw of ['{"title":"Still English"}', 'invalid', '{"title":""}']) {
    await assert.rejects(saveAsk({ sessionId: "title-failure", config, llm: { generateWithFallback: async () => raw } }), { code: "ASK_CHINESE_TITLE_REQUIRED" });
    assert.equal(history.get("title-failure").length, 1);
    assert.equal(listAskNotes(config).notes.length, 0);
  }
  await assert.rejects(saveAsk({ messages: [old], config, getLLMManager: () => { throw new Error("Offline"); } }), { code: "ASK_CHINESE_TITLE_REQUIRED" });
  const saved = await saveAsk({ sessionId: "title-failure", config, llm: { generateWithFallback: async () => '{"title":"中文标题"}' } });
  assert.equal(saved.vaultFile, "中文标题.md");
  assert.equal(history.get("title-failure").length, 0);
});
