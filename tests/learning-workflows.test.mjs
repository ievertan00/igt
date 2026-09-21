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
import { runReview } from "../lib/cli/commands/review.mjs";
import { runVoice, runListen } from "../lib/cli/commands/listen.mjs";
import { runTrans } from "../lib/cli/commands/translation.mjs";
import { runWordPractice } from "../lib/cli/commands/quiz.mjs";
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
  assert.doesNotMatch(output, /145 due/);
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

test("daily plan shows coach tasks from the diagnosis seam", async (t) => {
  let output = "";
  t.mock.method(process.stdout, "write", (chunk) => { output += chunk; return true; });
  t.mock.method(api, "getStats", async () => ({ dueCounts: { grammar: 0, vocab: 0 }, priorities: [] }));
  t.mock.method(api, "getTodayEffort", async () => ({ inputs_today: 1, vocab_added_today: 0, grammar_reviewed: 0, vocab_reviewed: 0 }));
  const config = {
    loadLearningDiagnosis: async () => ({
      priorities: [{
        errorType: "Grammar / Verb Tense",
        practiceAttempts: 0,
        prescription: [{ name: "识别", task: "标记时间线", check: "完成 5 题" }],
      }],
    }),
  };
  await runToday(async () => { assert.fail("No review prompt expected"); }, null, config);
  assert.match(output, /Coach tasks for today/);
  assert.match(output, /标记时间线/);
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
  runListen([], ctx);
  await new Promise(setImmediate);
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
  t.mock.method(api, "generatePractice", async (mode, count) => {
    generatedCount = count;
    assert.equal(mode, "word");
    return { data: { questions: [{
      kind: "expression",
      target_word: "fall behind",
      pos: "phrasal verb",
      prompt_zh: "你的项目进度落后了，向经理解释原因。",
      focus: "Pair with 'on' to name what you are behind on.",
      reference_answer: "I've fallen behind on the project because I was out sick.",
    }] } };
  });
  t.mock.method(api, "evaluatePractice", async () => ({
    data: { score: 85, corrected_answer: "I've fallen behind on the project because I was out sick.", feedback_zh: "用 fall behind on 表示落后于某事。" },
  }));
  const ctx = { setSigint() {}, rl: null, askLine: async () => "I fell behind the project because I was sick." };
  await runWordPractice([], ctx);
  assert.equal(generatedCount, 5);
  assert.match(output, /用词造句/);
  assert.match(output, /场景/);
  assert.match(output, /fall behind/);
});

test("help exposes the public learning workflows", (t) => {
  let output = "";
  t.mock.method(process.stdout, "write", (chunk) => { output += chunk; return true; });
  showHelp();
  for (const command of ["/word", "/w", "/a", "/practice", "/practice word", "/practice sentence", "/practice choice", "/pw", "/ps", "/pc", "/text", "/ask", "/coach", "/stats", "/theme", "/provider", "/voice"]) assert.ok(output.includes(command));
  assert.doesNotMatch(output, /\/add(?:\s|$)|\/listen|\/retry|\/vocab|\/drill|\/mc|\/quiz|\/today/);
  assert.doesNotMatch(output, /on by default/);
});

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import configLoader from "../lib/shared/config-loader.mjs";
import { getStats } from "../lib/db/stats.mjs";
import { closeAll } from "../lib/db/connection.mjs";

test("stats exposes only vocabulary due cards after grammar SRS removal", async (t) => {
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
  assert.deepEqual(result.dueCounts, { grammar: 0, vocab: 8 });
});

import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { EventEmitter } from "node:events";
import { handleCommand } from "../lib/cli/commands/dispatch.mjs";

test("word lookup-and-add replays the returned English entry", async (t) => {
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
  await handleCommand("/word 跟进", ctx);
  runListen([], ctx);
  await new Promise(setImmediate);
  assert.equal(spoken.at(-1), "follow up. I will follow up tomorrow.");
});

test("word review subcommand opens the vocabulary SRS deck", async (t) => {
  let output = "";
  let spawned = false;
  t.mock.method(process.stdout, "write", (chunk) => { output += chunk; return true; });
  t.mock.method(api, "seedVocab", async () => ({ seeded: 0 }));
  t.mock.method(api, "getDue", async () => ({ cards: [] }));
  t.mock.method(childProcess, "spawn", () => {
    spawned = true;
    throw new Error("lookup subprocess should not run");
  });
  const ctx = { config: {}, askLine: async () => null, rl: null, setSigint() {} };
  await handleCommand("/word review 5", ctx);
  assert.equal(spawned, false);
  assert.match(output, /No vocab cards due/);
});

test("vocabulary review hides English and grades blank recall as incorrect", async (t) => {
  let output = "";
  let grade = null;
  let deleted = null;
  t.mock.method(process.stdout, "write", (chunk) => { output += chunk; return true; });
  t.mock.method(api, "getDue", async () => ({ cards: [{
    id: 42,
    source_type: "vocab",
    word: "follow up",
    pos: "phrasal verb",
    zh: "跟进",
    meaning: "to do something after an earlier action",
    example: "I will follow up tomorrow.",
  }] }));
  t.mock.method(api, "gradeCard", async (_id, correct) => { grade = correct; return { next: { intervalDays: 1 } }; });
  t.mock.method(api, "deleteCard", async (id) => { deleted = id; return {}; });
  const answers = ["", "d"];
  await runReview(async () => answers.shift(), null, 1, "vocab", { Tts: { Enabled: false } });
  assert.equal(grade, false);
  assert.equal(deleted, 42);
  assert.match(output, /Your answer: \(blank\)/);
});
