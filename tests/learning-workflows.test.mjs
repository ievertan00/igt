import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../lib/cli/api-client.mjs';
import { runChat } from '../lib/cli/commands/chat.mjs';
import { isEnabled } from '../lib/cli/tts.mjs';

test('chat handles voice and exit locally without sending commands to the model', async (t) => {
  const messages = [];
  t.mock.method(api, 'resetChat', async () => ({}));
  t.mock.method(api, 'callChat', async (text) => { messages.push(text); return { data: { reply: '', corrections: [] } }; });
  const lines = ['/voice', '/exit'];
  const config = { Tts: { Enabled: false } };
  const before = isEnabled(config);
  await runChat([], { config, rl: null, setSigint() {}, askLine: async () => lines.shift() ?? null });
  assert.deepEqual(messages, []);
  assert.equal(isEnabled(config), !before);
});

import { runToday } from "../lib/cli/commands/stats.mjs";
import { runVoice, runListen } from "../lib/cli/commands/listen.mjs";
import { runTrans } from "../lib/cli/commands/translation.mjs";
import { runQuiz, runWordQuiz } from "../lib/cli/commands/quiz.mjs";
import { showHelp } from "../lib/cli/commands/help.mjs";

test("voice on/off are idempotent and status does not toggle", () => {
  const ctx = { config: { Tts: { Enabled: false } } };
  runVoice(["off"], ctx);
  runVoice(["off"], ctx);
  assert.equal(isEnabled(ctx.config), false);
  runVoice(["on"], ctx);
  runVoice(["on"], ctx);
  runVoice(["status"], ctx);
  assert.equal(isEnabled(ctx.config), true);
  runVoice(["off"], ctx);
});

test("chat sends ordinary English and keeps unknown slash commands local", async (t) => {
  const messages = [];
  t.mock.method(api, "resetChat", async () => ({}));
  t.mock.method(api, "callChat", async (text) => { messages.push(text); return { data: { reply: "What happened next?", corrections: [] } }; });
  const ctx = { config: { Tts: { Enabled: false } }, rl: null, setSigint() {} };
  runVoice(["off"], ctx);
  const lines = ["/unknown", "I gave a work update.", "/exit"];
  ctx.askLine = async () => lines.shift() ?? null;
  await runChat([], ctx);
  assert.deepEqual(messages, ["I gave a work update."]);
});

test("daily plan shows vocabulary activity without grammar inputs and opens vocabulary review", async (t) => {
  let output = "";
  let seeded = 0;
  let reviewType;
  t.mock.method(process.stdout, "write", (chunk) => { output += chunk; return true; });
  t.mock.method(api, "getStats", async () => ({ dueCounts: { grammar: 145, vocab: 8 }, priorities: [] }));
  t.mock.method(api, "getTodayEffort", async () => ({ inputs_today: 0, vocab_added_today: 3, grammar_reviewed: 0, vocab_reviewed: 4 }));
  t.mock.method(api, "seedVocab", async () => { seeded++; return {}; });
  t.mock.method(api, "getDue", async ({ type }) => { reviewType = type; return { cards: [] }; });
  await runToday(async () => "w", null, {});
  assert.match(output, /145 due/);
  assert.match(output, /8 due/);
  assert.match(output, /Words added: 3/);
  assert.match(output, /0 grammar · 4 vocabulary/);
  assert.match(output, /Listen/);
  assert.match(output, /work message/);
  assert.equal(seeded, 1);
  assert.equal(reviewType, "vocab");
});

test("daily plan handles a fresh learner without prompting for nonexistent cards", async (t) => {
  t.mock.method(api, "getStats", async () => ({ dueCounts: { grammar: 0, vocab: 0 }, priorities: [] }));
  t.mock.method(api, "getTodayEffort", async () => ({ inputs_today: 0, vocab_added_today: 0, grammar_reviewed: 0, vocab_reviewed: 0 }));
  await runToday(async () => { assert.fail("No review prompt expected"); }, null, {});
});

test("listen uses English translation and quiz feedback even with automatic voice off", async (t) => {
  const spoken = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    spoken.push(JSON.parse(options.body).input);
    return { ok: false, status: 503 };
  });
  const ctx = { config: { Tts: { Enabled: false } }, setSigint() {}, rl: null };
  runVoice(["off"], ctx);
  t.mock.method(api, "callTranslation", async () => ({ data: { translation: "Could you clarify the deadline?" } }));
  await runTrans("请说明截止日期", ctx);
  runListen([], ctx);
  await new Promise(setImmediate);
  assert.equal(spoken.at(-1), "Could you clarify the deadline?");
  t.mock.method(api, "callTranslation", async () => ({ data: { translation: "请说明截止日期。" } }));
  await runTrans("Please clarify the deadline.", ctx);
  runListen([], ctx);
  await new Promise(setImmediate);
  assert.equal(spoken.at(-1), "Please clarify the deadline.");

  const question = { chinese: "我昨天完成了报告。", error_type: "Verb Tense", reference_answer: "I finished the report yesterday." };
  t.mock.method(api, "generateQuiz", async () => ({ data: { questions: [question] } }));
  t.mock.method(api, "evaluateQuiz", async () => ({ data: { score: 80, corrected_answer: question.reference_answer, feedback_zh: "注意过去时。" } }));
  ctx.askLine = async () => "I finish the report yesterday.";
  await runQuiz([], ctx);
  runListen([], ctx);
  await new Promise(setImmediate);
  assert.equal(spoken.at(-1), question.reference_answer);
  assert.equal(isEnabled(ctx.config), false);
  const calls = spoken.length;
  runListen(["--stop"], ctx);
  assert.equal(spoken.length, calls);
  runListen(["Thanks", "for", "your", "help."], ctx);
  await new Promise(setImmediate);
  assert.equal(spoken.at(-1), "Thanks for your help.");
});

test("word quiz generates scenario production prompts and evaluates usage", async (t) => {
  let output = "";
  let generatedCount = null;
  t.mock.method(process.stdout, "write", (chunk) => { output += chunk; return true; });
  t.mock.method(api, "generateWordQuiz", async (count) => {
    generatedCount = count;
    return { data: { questions: [{
      word: "fall behind",
      pos: "phrasal verb",
      chinese: "你的项目进度落后了，向经理解释原因。",
      focus: "Pair with 'on' to name what you are behind on.",
      reference_answer: "I've fallen behind on the project because I was out sick.",
    }] } };
  });
  t.mock.method(api, "evaluateWordQuiz", async () => ({
    data: { score: 85, corrected_answer: "I've fallen behind on the project because I was out sick.", feedback_zh: "用 fall behind on 表示落后于某事。" },
  }));
  const ctx = { setSigint() {}, rl: null, askLine: async () => "I fell behind the project because I was sick." };
  await runWordQuiz([], ctx);
  assert.equal(generatedCount, 5);
  assert.match(output, /用词造句/);
  assert.match(output, /场景/);
  assert.match(output, /fall behind/);
});

test("help exposes vocabulary, listening, and everyday/work workflows", (t) => {
  let output = "";
  t.mock.method(process.stdout, "write", (chunk) => { output += chunk; return true; });
  showHelp();
  for (const command of ["/add", "/word", "/voice", "/listen", "/quiz", "/today"]) assert.ok(output.includes(command));
  assert.match(output, /work email/);
  assert.doesNotMatch(output, /on by default/);
});

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import configLoader from "../lib/shared/config-loader.mjs";
import { getStats } from "../lib/db/stats.mjs";
import { closeAll } from "../lib/db/connection.mjs";

test("stats counts all due grammar and vocabulary cards, excluding future cards", async (t) => {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const cacheDir = path.join(projectRoot, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const dbPath = path.join(cacheDir, "learning-test-" + Date.now() + ".db");
  const db = new Database(dbPath);
  t.after(() => { closeAll(); if (db.open) db.close(); if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); });
  db.exec(fs.readFileSync(path.join(projectRoot, "migrations", "001_initial_schema.sql"), "utf8"));
  const insert = db.prepare("INSERT INTO srs_cards (source_type, prompt, answer, due_date) VALUES (?, 'test', 'test', date('now', ?))");
  db.transaction(() => {
    for (let i = 0; i < 145; i++) insert.run("input", "-1 day");
    for (let i = 0; i < 8; i++) insert.run("vocab", "0 days");
    insert.run("input", "+1 day");
    insert.run("vocab", "+1 day");
  })();
  db.close();
  closeAll();
  t.mock.method(configLoader, "load", () => ({ DbPath: dbPath }));
  const result = await getStats();
  assert.deepEqual(result.dueCounts, { grammar: 145, vocab: 8 });
});

import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { EventEmitter } from "node:events";
import { handleCommand } from "../lib/cli/commands/dispatch.mjs";

test("add replays the returned English entry, not a Chinese lookup term", async (t) => {
  const spoken = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    spoken.push(JSON.parse(options.body).input);
    return { ok: false, status: 503 };
  });
  t.mock.method(childProcess, "spawn", (_exe, args, options) => {
    assert.ok(args[0].endsWith("igt-add.mjs"));
    assert.equal(args[1], "跟进");
    assert.equal(options.stdio[3], "ipc");
    const child = new EventEmitter();
    child.kill = () => {};
    process.nextTick(() => {
      child.emit("message", { type: "english-expression", text: "follow up. I will follow up tomorrow." });
      child.emit("close", 0);
    });
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const ctx = { config: { Theme: "auto", Tts: { Enabled: false } }, setSigint() {} };
  await handleCommand("/add 跟进", ctx);
  await handleCommand("/listen", ctx);
  await new Promise(setImmediate);
  assert.equal(spoken.at(-1), "follow up. I will follow up tomorrow.");
});
