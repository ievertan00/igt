import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { askTurn, saveAsk } from "../lib/application/ask.mjs";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "igt-ask-contract-"));
const llm = {
  generateWithFallback: async (question, systemPrompt, options) => {
    assert.equal(question, "How do I use present perfect?");
    assert.match(systemPrompt, /Earlier question/);
    assert.equal(options.taskType, "ask");
    assert.equal(options.jsonSchema.type, "object");
    return JSON.stringify({
      question,
      title: "Present perfect",
      answer: "Use it for past actions connected to the present.",
      related: ["When should I use past simple?"]
    });
  },
  getCurrentProvider: () => ({ getModelName: () => "smoke-model" })
};
const config = {
  Prompts: { AskPrompt: "Answer clearly. History: {{history}}" },
  AskFile: path.join(tempRoot, "configured-ask-log.md")
};

try {
  const result = await askTurn({
    messages: [{ question: "Earlier question", answer: "Earlier answer" }],
    question: "How do I use present perfect?",
    llm,
    config
  });
  assert.equal(result.response.data.answer, "Use it for past actions connected to the present.");
  assert.equal(result.response.perf.model, "smoke-model");

  const saved = saveAsk({
    messages: [{ question: "How do I use present perfect?", answer: result.response.data.answer }],
    config
  });
  assert.equal(saved.saved, true);
  assert.equal(saved.vaultFile, "How do I use present perfect.md");
  assert.equal(fs.existsSync(path.join(tempRoot, saved.vaultFile)), true);
  const original = fs.readFileSync(path.join(tempRoot, saved.vaultFile), "utf8");
  const duplicate = saveAsk({ messages: [{ question: "How do I use present perfect?", answer: result.response.data.answer }], config });
  assert.equal(duplicate.vaultFile, saved.vaultFile, "Identical snapshots reuse the existing note");
  assert.equal(fs.readFileSync(path.join(tempRoot, saved.vaultFile), "utf8"), original, "Duplicate saving preserves metadata too");
  const expanded = saveAsk({ messages: [
    { question: "How do I use present perfect?", answer: result.response.data.answer },
    { question: "Another example?", answer: "I have lived here for years." },
  ], config });
  assert.notEqual(expanded.vaultFile, saved.vaultFile, "Different snapshots with the same title get separate notes");
  assert.equal(fs.readFileSync(path.join(tempRoot, saved.vaultFile), "utf8"), original, "Historical content remains intact");
  assert.match(fs.readFileSync(path.join(tempRoot, expanded.vaultFile), "utf8"), /I have lived here for years/);
  const repeatedExpanded = saveAsk({ messages: [
    { question: "How do I use present perfect?", answer: result.response.data.answer },
    { question: "Another example?", answer: "I have lived here for years." },
  ], config });
  assert.equal(repeatedExpanded.vaultFile, expanded.vaultFile);
  console.log("ask contract smoke ok");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
