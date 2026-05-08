#!/usr/bin/env node
// Interactive Grammar Tool v3 — cross-platform Node.js entry point

import { createInterface } from "node:readline";
import http from "node:http";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { colors, paint, Spinner, renderBarChart, box, wrapText } from "./lib/ui.mjs";
import configLoader from "./lib/config-loader.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_PORT = 18964;
const SERVER_HOST = "127.0.0.1";
const SERVER_BASE = `http://${SERVER_HOST}:${SERVER_PORT}`;

// ─── Server ────────────────────────────────────────────────────────────────────

let serverProcess = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ping() {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_BASE}/health`, { timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

function killPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync("netstat -ano", { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts[1] && parts[1].endsWith(`:${port}`) && /^\d+$/.test(parts.at(-1))) {
          pids.add(parts.at(-1));
        }
      }
      for (const pid of pids) {
        try { execSync(`taskkill /PID ${pid} /F`, { stdio: "pipe" }); } catch {}
      }
    } else {
      execSync(`lsof -ti :${port} | xargs kill -9`, { shell: true, stdio: "pipe" });
    }
  } catch {}
}

async function startServer() {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
  killPort(SERVER_PORT);
  await sleep(200);

  let serverStderr = "";
  serverProcess = spawn(process.execPath, [path.join(__dirname, "lib", "igt-http-server.mjs")], {
    env: { ...process.env, IGT_SERVER_PORT: String(SERVER_PORT), IGT_SERVER_HOST: SERVER_HOST },
    stdio: ["ignore", "ignore", "pipe"],
  });
  serverProcess.stderr.on("data", (d) => { serverStderr += d.toString(); });
  serverProcess.on("error", (e) => process.stderr.write(`Server spawn error: ${e.message}\n`));

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    await sleep(100);
    if (serverProcess.exitCode !== null) {
      process.stderr.write("Error: Server failed to start\n");
      if (serverStderr) process.stderr.write(serverStderr);
      return false;
    }
    if (await ping()) {
      process.stdout.write(`${paint(colors.gray, `● server  port ${SERVER_PORT}`)}\n`);
      return true;
    }
  }
  process.stderr.write("Error: Server startup timeout\n");
  if (serverStderr) process.stderr.write(serverStderr);
  return false;
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
}

// ─── HTTP ──────────────────────────────────────────────────────────────────────

async function callGrammar(text, signal) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ text });
    const req = http.request(
      {
        hostname: SERVER_HOST, port: SERVER_PORT, path: "/grammar", method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body, "utf8") },
        signal,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (res.statusCode !== 200) {
            const err = new Error(parsed.error || `HTTP ${res.statusCode}`);
            err.status = res.statusCode;
            reject(err);
          } else resolve(parsed);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── Render ────────────────────────────────────────────────────────────────────

const SC = {
  review:     { h: colors.yellow,  b: colors.yellow },
  correction: { h: colors.green,   b: colors.green  },
  refine:     { h: colors.cyan,    b: colors.cyan   },
  diagnosis:  { h: colors.magenta, b: colors.magenta },
  rule:       { h: colors.blue,    b: colors.blue   },
  tip:        { h: colors.cyan,    b: colors.cyan   },
};

const cols = () => Math.max(40, (process.stdout.columns || 80) - 1);

function printLine(text, color) {
  const w = cols();
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const cand = line ? `${line} ${word}` : word;
    if (cand.length > w && line) {
      process.stdout.write(paint(color, line) + "\n");
      line = word;
    } else {
      line = cand;
    }
  }
  if (line) process.stdout.write(paint(color, line) + "\n");
}

function emitSection(label, key, lines) {
  if (!lines.length) return;
  const sc = SC[key];
  process.stdout.write("\n" + paint(sc.h, `**${label}**`) + "\n");
  for (const l of lines) printLine(l, sc.b);
}

function splitLines(value) {
  if (!value) return [];
  return String(value).split("\n").map((s) => s.trim()).filter(Boolean);
}

// data is the structured object from the server: {review, correction, refine, diagnoses[], rule, tip}
function renderResponse(data) {
  emitSection("Review",     "review",     splitLines(data.review));
  emitSection("Correction", "correction", splitLines(data.correction));
  emitSection("Refine",     "refine",     splitLines(data.refine));

  if (Array.isArray(data.diagnoses) && data.diagnoses.length) {
    const lines = data.diagnoses.map((d) => `- ${d.error_type || "Error"} (${d.severity || "Minor"}): ${d.explanation || ""}`);
    emitSection("Diagnosis", "diagnosis", lines);
  }

  emitSection("Rule", "rule", splitLines(data.rule).map((s) => s.startsWith("- ") ? s : `- ${s}`));
  emitSection("Tip",  "tip",  splitLines(data.tip ).map((s) => s.startsWith("- ") ? s : `- ${s}`));
}

// ─── Logging ───────────────────────────────────────────────────────────────────

function dataToMarkdown(data) {
  const sections = [];
  const push = (label, body) => { if (body && body.trim()) sections.push(`**${label}**\n${body.trim()}`); };
  push("Review",     data.review);
  push("Correction", data.correction);
  push("Refine",     data.refine);
  if (Array.isArray(data.diagnoses) && data.diagnoses.length) {
    push("Diagnosis", data.diagnoses.map((d) => `- ${d.error_type || "Error"} (${d.severity || "Minor"}): ${d.explanation || ""}`).join("\n"));
  }
  if (data.rule) push("Rule", splitLines(data.rule).map((s) => s.startsWith("- ") ? s : `- ${s}`).join("\n"));
  if (data.tip)  push("Tip",  splitLines(data.tip ).map((s) => s.startsWith("- ") ? s : `- ${s}`).join("\n"));
  return sections.join("\n\n");
}

function logResult(targetPath, text, data) {
  if (!targetPath) return;
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const content = dataToMarkdown(data);
  try { fs.appendFileSync(targetPath, `\n---\n### [${ts}]\n**User Input**: ${text}\n**Output**:\n${content}`, "utf8"); }
  catch { process.stdout.write(paint(colors.yellow, "Warning: Could not log entry.\n")); }
}

// ─── Input ─────────────────────────────────────────────────────────────────────
// sigintHandler is swapped by context: idle = no-op, input = clear line, http = abort

let sigintHandler = () => {};
let globalEscHandler = null;

// Uses rl 'line' event directly (not question()) to allow clean SIGINT cancellation
// without leaving stale question callbacks that fire on the next Enter keypress.
function askLine(rl, prompt) {
  return new Promise((resolve) => {
    let settled = false;

    const onLine = (line) => {
      if (settled) return;
      settled = true;
      rl.removeListener("line", onLine);
      sigintHandler = () => {};
      resolve(line);
    };

    sigintHandler = () => {
      if (settled) return;
      settled = true;
      rl.removeListener("line", onLine);
      rl.write(null, { ctrl: true, name: 'e' });
      rl.write(null, { ctrl: true, name: 'u' });
      process.stdout.write("^C\n");
      sigintHandler = () => {};
      resolve(null);
    };

    rl.on("line", onLine);
    rl.setPrompt(prompt);
    rl.prompt();
  });
}

// ─── Grammar check ─────────────────────────────────────────────────────────────

async function runGrammarCheck(text, targetPath) {
  const spinner = new Spinner("Thinking");
  spinner.start();

  const controller = new AbortController();
  let cancelled = false;

  sigintHandler = () => {
    cancelled = true;
    controller.abort();
    sigintHandler = () => {};
    spinner.stop(true);
    process.stdout.write("\n" + paint(colors.gray, "Cancelled.\n"));
  };

  let resp = null;
  try {
    resp = await callGrammar(text, controller.signal);
  } catch (err) {
    if (!cancelled) {
      const msg = err.message || "";
      if (err.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/i.test(msg)) {
        process.stdout.write(paint(colors.yellow, "\n  API limit reached. Wait a moment and try again.\n"));
      } else if (err.name !== "AbortError" && err.code !== "ABORT_ERR") {
        process.stdout.write(paint(colors.red, `\n  Error: ${msg}\n`));
      }
    }
  } finally {
    sigintHandler = () => {};
    spinner.stop(true);
  }

  if (cancelled || !resp) return;

  const sep = "─".repeat(Math.min(44, Math.max(20, cols() - 3)));
  process.stdout.write("\n");
  process.stdout.write(`${paint(colors.gray, "Input  ")}${paint(colors.white, text)}\n`);
  process.stdout.write(`${paint(colors.gray, sep)}\n`);
  renderResponse(resp.data);
  process.stdout.write("\n");
  if (resp.perf) {
    const { llm_ms, total_ms } = resp.perf;
    process.stdout.write(`${paint(colors.gray, `${Math.round(llm_ms)}ms llm  ·  ${Math.round(total_ms)}ms total`)}\n`);
  }

  sessionSentenceCount++;
  logResult(targetPath, text, resp.data);
}

// ─── Commands ──────────────────────────────────────────────────────────────────

function runNode(rl, script, ...args) {
  return new Promise((resolve) => {
    if (rl) rl.pause();
    if (globalEscHandler) process.stdin.removeListener("data", globalEscHandler);
    
    const child = spawn(process.execPath, [path.join(__dirname, script), ...args], {
      stdio: "inherit", env: process.env,
    });
    sigintHandler = () => { child.kill(); sigintHandler = () => {}; };
    child.on("close", () => { 
      sigintHandler = () => {}; 
      if (rl) rl.resume();
      if (globalEscHandler) process.stdin.on("data", globalEscHandler);
      resolve(); 
    });
  });
}

function fetchJson(method, pathPart, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: SERVER_HOST, port: SERVER_PORT, path: pathPart, method,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    };
    if (body) opts.headers["Content-Length"] = Buffer.byteLength(body, "utf8");
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (res.statusCode !== 200) reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          else resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runUndo(rl, n) {
  if (!Number.isFinite(n) || n < 1) {
    process.stdout.write(paint(colors.yellow, "Usage: /undo [N]   (delete the last N inputs; default 1)\n\n"));
    return;
  }
  let preview;
  try {
    preview = await fetchJson("GET", `/inputs/last?n=${n}`);
  } catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`)); return;
  }
  if (!preview.rows || preview.rows.length === 0) {
    process.stdout.write(paint(colors.gray, "Nothing to undo.\n\n")); return;
  }
  process.stdout.write(`${paint(colors.yellow, `About to delete the last ${preview.rows.length} input(s):`)}\n`);
  for (const r of preview.rows) {
    const text = r.original_text.replace(/\s+/g, " ").slice(0, 80);
    process.stdout.write(`  ${paint(colors.gray, `#${r.id}`)}  ${paint(colors.white, text)}\n`);
  }
  const confirm = await askLine(rl, paint(colors.yellow, "Proceed? (y/N): "));
  if (!confirm || !/^y(es)?$/i.test(confirm.trim())) {
    process.stdout.write(paint(colors.gray, "Cancelled.\n\n")); return;
  }
  try {
    const r = await fetchJson("POST", "/undo", JSON.stringify({ n }));
    process.stdout.write(`${paint(colors.green, "Deleted")}: ${r.deleted_inputs} input(s), ${r.deleted_diagnoses} diagnoses, ${r.deleted_cards} cards, ${r.deleted_vocab} vocab, ${r.deleted_advice} advice rows\n\n`);
  } catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
  }
}

function diffHighlight(original, corrected) {
  const ow = original.trim().split(/\s+/);
  const cw = corrected.trim().split(/\s+/);
  const n = ow.length, m = cw.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = ow[i-1].toLowerCase() === cw[j-1].toLowerCase()
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
  const parts = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ow[i-1].toLowerCase() === cw[j-1].toLowerCase()) {
      parts.unshift({ word: cw[j-1], changed: ow[i-1] !== cw[j-1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      parts.unshift({ word: cw[j-1], changed: true }); j--;
    } else {
      i--;
    }
  }
  return parts.map(({ word, changed }) =>
    changed ? paint(colors.bold + colors.green, word) : word
  ).join(" ");
}

function parseVocabPrompt(prompt) {
  if (!prompt || !prompt.startsWith("VOCAB|||")) return null;
  const parts = prompt.split("|||");
  // old format had a dir field (8 parts); new format omits it (7 parts)
  const [, word, pos, zh, meaning, example, note] = parts.length === 8
    ? [parts[0], parts[2], parts[3], parts[4], parts[5], parts[6], parts[7]]
    : parts;
  return { word, pos, zh, meaning, example, note };
}

function renderVocabCard(vocab, mask) {
  const FW = 52;
  const MASK = paint(colors.gray, "___");
  const lbl  = (t) => paint(colors.gray, t.padEnd(10));

  const title = mask === "word"
    ? MASK
    : paint(colors.bold + colors.yellow, vocab.word);

  let body = "";
  if (vocab.pos)     body += `  ${lbl("PoS")}${paint(colors.gray, vocab.pos)}\n`;
  if (vocab.meaning) body += `  ${lbl("Meaning")}${paint(colors.white, wrapText(vocab.meaning, FW, 12))}\n`;
  if (vocab.zh)      body += `  ${lbl("中文")}${mask === "zh" ? MASK : paint(colors.green, vocab.zh)}\n`;
  if (vocab.example) {
    let ex = vocab.example;
    if (mask === "word") {
      const esc = vocab.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      ex = ex.replace(new RegExp(`\\b${esc}\\b`, "gi"), "___");
    }
    body += `  ${lbl("Example")}${paint(colors.cyan, wrapText(ex, FW, 12))}\n`;
  }
  if (vocab.note)    body += `  ${lbl("Note")}${paint(colors.brightCyan, wrapText(vocab.note, FW, 12))}`;

  return box(title, body.trimEnd(), { width: 70 });
}

async function runReview(rl, limit, type = "all") {
  let preview;
  try {
    const typeParam = type !== "all" ? `&type=${type}` : "";
    preview = await fetchJson("GET", `/review/due?limit=${Math.max(1, limit)}${typeParam}`);
  } catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`)); return;
  }
  const cards = preview.cards || [];
  if (cards.length === 0) {
    const msg = type === "vocab" ? "No vocab cards due. Come back tomorrow.\n\n" : "No cards due. Come back tomorrow.\n\n";
    process.stdout.write(paint(colors.gray, msg)); return;
  }

  process.stdout.write(`${paint(colors.yellow, `${cards.length} card(s) due — Ctrl+C to stop.`)}\n\n`);
  let correctCount = 0;
  let wrongCount = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const vocab = parseVocabPrompt(c.prompt);

    process.stdout.write(`${paint(colors.gray, `Card ${i + 1}/${cards.length}`)}\n\n`);

    let vocabMask = null;
    if (vocab) {
      vocabMask = Math.random() < 0.5 ? "word" : "zh";
      const dirHint = vocabMask === "word"
        ? paint(colors.gray, "[中文 → word]")
        : paint(colors.gray, "[word → 中文]");
      process.stdout.write(`${dirHint}\n\n`);
      process.stdout.write(renderVocabCard(vocab, vocabMask) + "\n\n");
    } else {
      const hintTypes = c.hint ? c.hint.split(" · ") : [];
      const hintLabel = hintTypes.length > 1
        ? `[${c.hint}] errors:`
        : hintTypes.length === 1
          ? `[${c.hint}] error:`
          : null;
      if (hintLabel) process.stdout.write(`${paint(colors.yellow, hintLabel)}\n\n`);
      process.stdout.write(`${paint(colors.cyan, c.prompt)}\n`);
    }

    const enter = await askLine(rl, paint(colors.gray, "  Show Answer [Enter] ❯ "));
    if (enter === null) { process.stdout.write("\n"); break; }

    if (vocab) {
      process.stdout.write(renderVocabCard(vocab, null) + "\n\n");
    } else {
      process.stdout.write(`${diffHighlight(c.prompt, c.answer)}\n`);
    }

    const choice = await askLine(rl, paint(colors.gray, "  Found it? [y/n/d=delete] ❯ "));
    if (choice === null) { process.stdout.write("\n"); break; }

    if (/^d/i.test(choice.trim())) {
      try {
        await fetchJson("POST", "/review/delete", JSON.stringify({ card_id: c.id }));
        process.stdout.write(`${paint(colors.gray, "Card deleted.")}\n\n`);
      } catch (e) {
        process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
      }
      continue;
    }

    const selfCorrect = !/^n/i.test(choice.trim());
    let result;
    try {
      result = await fetchJson("POST", "/review/grade", JSON.stringify({ card_id: c.id, correct: selfCorrect }));
    } catch (e) {
      process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
      continue;
    }

    if (selfCorrect) {
      correctCount++;
      process.stdout.write(`${paint(colors.green, "✓")} ${paint(colors.gray, `→ next due ${result.next.dueDate} (interval ${result.next.intervalDays}d)`)}\n\n`);
    } else {
      wrongCount++;
      process.stdout.write(`${paint(colors.red, "✗")} ${paint(colors.gray, `→ reset to 1d`)}\n\n`);
    }
  }

  const total = correctCount + wrongCount;
  if (total > 0) {
    const pct = Math.round((correctCount / total) * 100);
    process.stdout.write(`${paint(colors.gray, "─".repeat(40))}\n`);
    process.stdout.write(`${paint(colors.yellow, `Reviewed ${total}, ${correctCount} correct (${pct}%), ${wrongCount} reset.`)}\n\n`);
  }
}

function getModel(config) {
  const p = (process.env.IGT_LLM_PROVIDER || config.LLMProvider || "gemini").toLowerCase();
  const k = { gemini: "GeminiFlashModel", qwen: "QwenFlashModel", deepseek: "DeepseekFlashModel", ollama: "OllamaModel" };
  return { provider: p, model: config[k[p]] || p };
}

async function handleCommand(raw, config, rl) {
  const parts = raw.slice(1).trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  process.stdout.write("\n");

  switch (cmd) {
    case "help": showHelp(); break;
    case "handbook": case "h":
      await runNode(rl, "tools/igt-handbook.mjs"); process.stdout.write("\n"); break;
    case "practice": case "p": {
      const m = args.join(" ").match(/^([A-Ca-c][12])\s+(\d+)$/);
      const nodeArgs = m ? [`--level=${m[1].toUpperCase()}`, `--count=${m[2]}`] : args;
      await runNode(rl, "tools/igt-practice.mjs", ...nodeArgs); process.stdout.write("\n"); break;
    }
    case "assess": case "as":
      await runNode(rl, "tools/igt-assess.mjs"); process.stdout.write("\n"); break;
    case "add": case "a":
      if (!args.length) process.stdout.write(paint(colors.yellow, "Usage: /add <word or phrase>\n\n"));
      else await runNode(rl, "tools/igt-add.mjs", args.join(" "));
      break;
    case "vocab": case "v":
      if (args.includes("--list") || args.includes("list")) {
        await runNode(rl, "tools/igt-vocab.mjs", "--list"); process.stdout.write("\n");
      } else {
        try {
          const seed = await fetchJson("POST", "/vocab/seed", "{}");
          if (seed.seeded > 0)
            process.stdout.write(paint(colors.gray, `  Seeded ${seed.seeded} new word(s) into SRS deck.\n\n`));
        } catch {}
        const n = parseInt(args[0], 10);
        await runReview(rl, Number.isFinite(n) ? n : 20, "vocab");
      }
      break;
    case "gemini": case "qwen": case "deepseek": case "ollama":
      await fetchJson("POST", "/switch", JSON.stringify({ provider: cmd }));
      process.env.IGT_LLM_PROVIDER = cmd;
      process.stdout.write(paint(colors.gray, `Switched to ${getModel(config).model}\n`));
      break;
    case "llm":
      await runNode(rl, "lib/llm-switch.mjs", ...args); process.stdout.write("\n"); break;
    case "undo": case "u":
      await runUndo(rl, args[0] ? parseInt(args[0], 10) : 1);
      break;
    case "review": case "r":
      await runReview(rl, args[0] ? parseInt(args[0], 10) : 10);
      break;
    case "stats": case "st":
      await runStats();
      break;
    case "today":
      await runToday(rl, config);
      break;
    case "retry":
      if (!lastSubmittedText) {
        process.stdout.write(paint(colors.yellow, "Nothing to retry yet.\n\n"));
      } else {
        await runGrammarCheck(lastSubmittedText, lastTargetPath);
      }
      break;
    case "exit": case "quit": case "q":
      await showSessionSummary(); stopServer(); rl.close(); process.exit(0);
      break;
    default:
      process.stdout.write(paint(colors.yellow, `Unknown command /${cmd} — type /help for a list.\n`));
  }
}

function showHelp() {
  const sep = "─".repeat(Math.min(54, Math.max(30, cols() - 3)));
  const row = (c, d) => process.stdout.write(`${paint(colors.cyan, c)}${paint(colors.gray, d)}\n`);
  process.stdout.write(`\n  ${paint(colors.yellow, "Commands")}\n  ${paint(colors.gray, sep)}\n`);
  row("/handbook  (/h)   ", "Generate your personal error handbook");
  row("/practice  (/p)   ", "Targeted grammar exercises (CEFR-aware)");
  row("/practice B2 10   ", "Shorthand for --level=B2 --count=10");
  row("/assess    (/as)  ", "Estimate your CEFR proficiency level");
  row("/add <w>   (/a)   ", "Add a word to your Obsidian vocabulary note");
  row("/vocab     (/v)   ", "Review saved vocabulary (quiz or list)");
  row("/review    (/r)   ", "SRS review of cards due today (cloze + diagnoses)");
  row("/stats     (/st)  ", "Analytics dashboard: errors by hour, length, mastery");
  row("/today            ", "Adaptive daily plan: SRS + practice focus area");
  row("/retry            ", "Re-run the last input with the same model");
  row("/undo [N]  (/u)   ", "Delete the last N inputs and their diagnoses/cards (default 1)");
  row("/gemini           ", "Switch to Gemini model");
  row("/qwen             ", "Switch to Qwen model");
  row("/deepseek         ", "Switch to Deepseek model");
  row("/ollama           ", "Switch to local Phi-4 (Ollama)");
  row('"""               ', "Multiline mode (blank line or \"\"\" to submit)");
  row("/exit      (/q)   ", "Quit IGT");
  process.stdout.write("\n");
}

// ─── Input validation ─────────────────────────────────────────────────────────

let lastSubmittedText = "";
let lastSubmittedProvider = "";
let lastTargetPath = "";

const TEST_PATTERNS = /^(test(ing)?|hello|hi|hey|ok|okay|yes|no|sure|thanks|thank you|lol|haha|asdf|qwerty|foo|bar|baz|abc|xyz|aaa+|bbb+|ccc+|zzz+|123|1234|12345)[!?.\s]*$/i;

function validateInput(text) {
  if (text.length < 10)
    return "Input too short — type a complete sentence.";
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (words.length < 2)
    return "Input too short — needs at least two words.";
  if (TEST_PATTERNS.test(text))
    return "Looks like a test input — type a sentence you actually want checked.";
  const nonSpace = text.replace(/\s/g, "");
  if (nonSpace.length > 4) {
    const counts = {};
    for (const c of nonSpace) counts[c] = (counts[c] || 0) + 1;
    if (Math.max(...Object.values(counts)) / nonSpace.length > 0.6)
      return "Input looks like noise — type a real sentence.";
  }
  if (text === lastSubmittedText && (process.env.IGT_LLM_PROVIDER || "gemini") === lastSubmittedProvider)
    return "Duplicate — same text as your last submission.";
  return null;
}

// ─── Session ───────────────────────────────────────────────────────────────────

let sessionSentenceCount = 0;

async function runToday(rl, config) {
  let stats, due;
  try {
    [stats, due] = await Promise.all([
      fetchJson("GET", "/stats"),
      fetchJson("GET", "/review/due?limit=100"),
    ]);
  } catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`)); return;
  }

  const dueCount = due.cards?.length || 0;
  const clozeDrillCount = Math.min(3, dueCount);
  const focusType = stats.mastery?.find(r => r.mastery === "frequent")?.error_type?.split(" / ").pop() || null;

  const sep = "─".repeat(44);
  process.stdout.write(`\n  ${paint(colors.yellow, "TODAY'S PLAN")}  ${paint(colors.gray, "(estimated 10 min)")}\n`);
  process.stdout.write(`${paint(colors.gray, sep)}\n`);
  const reviewMin = Math.max(2, Math.round(dueCount * 0.6));
  process.stdout.write(`${paint(colors.gray, "1.")} ${paint(colors.white, "SRS reviews   ")}${paint(colors.cyan, `${dueCount} card(s) due`)}  ${paint(colors.gray, `(~${reviewMin} min)`)}  /review\n`);
  process.stdout.write(`${paint(colors.gray, "2.")} ${paint(colors.white, "Cloze drill   ")}${paint(colors.cyan, `${clozeDrillCount} card(s)`)}  ${paint(colors.gray, "(~3 min)")}  /review --count=${clozeDrillCount}\n`);
  process.stdout.write(`${paint(colors.gray, "3.")} ${paint(colors.white, "Free practice ")}${paint(colors.cyan, "1 paragraph")}  ${paint(colors.gray, "(~4 min)")}  /practice --count=1\n`);
  if (focusType) {
    process.stdout.write(`${paint(colors.gray, sep)}\n`);
    process.stdout.write(`${paint(colors.gray, "Focus: ")}${paint(colors.magenta, focusType)}  ${paint(colors.gray, "(most frequent error — target it today)")}\n`);
  }
  process.stdout.write(`${paint(colors.gray, sep)}\n\n`);

  if (dueCount > 0) {
    const go = await askLine(rl, paint(colors.gray, "  Start SRS review now? (Y/n): "));
    if (go === null || /^n/i.test(go.trim())) return;
    await runReview(rl, 10);
  }
}

async function runStats() {
  let data;
  try { data = await fetchJson("GET", "/stats"); }
  catch (e) { process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`)); return; }

  const W = Math.min(72, Math.max(40, (process.stdout.columns || 80) - 4));
  process.stdout.write("\n");

  if (data.byLength && data.byLength.length) {
    renderBarChart(
      data.byLength.map(r => ({ label: `${r.bucket} words`, value: parseFloat(r.avg_errors.toFixed(2)) })),
      { title: "Errors / input  by sentence length", color: colors.magenta, maxWidth: W }
    );
  }

  if (data.cefrTrajectory && data.cefrTrajectory.length) {
    const levels = ["A1","A2","B1","B2","C1","C2"];
    process.stdout.write(`${paint(colors.yellow, "CEFR trajectory")}\n`);
    for (const row of data.cefrTrajectory) {
      const idx = levels.indexOf(row.level);
      const bar = paint(colors.green, "█".repeat(Math.max(1, idx * 3 + 1)));
      process.stdout.write(`${paint(colors.gray, row.day)}  ${bar} ${paint(colors.white, row.level)}\n`);
    }
    process.stdout.write("\n");
  }

  if (data.mastery && data.mastery.length) {
    const byCat = { frequent: [], occasional: [], rare: [], mastered: [] };
    for (const r of data.mastery) (byCat[r.mastery] || []).push(r.error_type.split(" / ").pop());
    const catColor = { frequent: colors.red, occasional: colors.yellow, rare: colors.cyan, mastered: colors.green };

    process.stdout.write(`${paint(colors.yellow, "Mastery  (30-day window)")}\n`);

    for (const [cat, items] of Object.entries(byCat)) {
      const label = paint(catColor[cat], cat.padEnd(11));
      const countStr = paint(colors.gray, `${String(items.length).padStart(2)} type${items.length !== 1 ? "s" : " "}`);
      if (items.length === 0) continue;

      // For frequent/occasional show up to top 5 items on separate indented lines
      if (cat === "frequent" || cat === "occasional") {
        process.stdout.write(`${label}  ${countStr}\n`);
        const shown = items.slice(0, 5);
        for (const item of shown) {
          process.stdout.write(`             ${paint(colors.gray, "· ")}${paint(colors.white, item)}\n`);
        }
        if (items.length > 5) {
          process.stdout.write(`             ${paint(colors.gray, `· … +${items.length - 5} more`)}\n`);
        }
      } else {
        // rare/mastered: single line with up to 4 items inline
        const preview = items.slice(0, 4).join("  ·  ");
        const more = items.length > 4 ? paint(colors.gray, `  +${items.length - 4} more`) : "";
        process.stdout.write(`${label}  ${countStr}   ${paint(colors.gray, preview)}${more}\n`);
      }
    }
    process.stdout.write("\n");
  }
}

async function showSessionSummary() {
  if (sessionSentenceCount === 0) return;
  let s;
  try { s = await fetchJson("GET", "/session/summary"); } catch { return; }
  if (!s || s.no_session) return;

  const errPerSent = s.total_inputs > 0 ? (s.total_errors / s.total_inputs).toFixed(1) : "0";
  const avg7 = s.avg_errors_7day.toFixed(1);
  const trend = s.total_inputs > 0 && s.avg_errors_7day > 0
    ? (parseFloat(errPerSent) < parseFloat(avg7) ? paint(colors.green, " ↑ improving") : paint(colors.yellow, " → stable"))
    : "";

  const sep = "─".repeat(44);
  process.stdout.write(`\n  ${paint(colors.gray, sep)}\n`);
  process.stdout.write(`${paint(colors.yellow, "Session Summary")}\n`);
  process.stdout.write(`${paint(colors.gray, sep)}\n`);
  process.stdout.write(`${paint(colors.gray, "Sentences      ")}${paint(colors.white, String(s.total_inputs))}\n`);
  process.stdout.write(`${paint(colors.gray, "Errors/sent    ")}${paint(colors.white, errPerSent)}${paint(colors.gray, `  vs 7-day avg ${avg7}`)}${trend}\n`);
  if (s.top_error) process.stdout.write(`${paint(colors.gray, "Top error      ")}${paint(colors.cyan, s.top_error)}\n`);
  process.stdout.write(`${paint(colors.gray, "Cards added    ")}${paint(colors.white, String(s.cards_added))}  ${paint(colors.gray, `due tomorrow: ${s.cards_due_tomorrow}`)}\n`);
  process.stdout.write(`${paint(colors.gray, sep)}\n\n`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  process.env.GEMINI_SYSTEM_MD = "false";
  process.env.GEMINI_TELEMETRY_ENABLED = "false";

  const config = configLoader.load();
  const targetPath = process.env.IGT_REVIEW_PATH || config.ReviewPath || "";

  process.stdout.write("\n");
  process.stdout.write(`${paint(colors.bold + colors.yellow, "IGT")}  ${paint(colors.white, "Interactive Grammar Tool")}\n`);
  process.stdout.write(`${paint(colors.gray, "──────────────────────────────────────────────")}\n`);
  process.stdout.write(`${paint(colors.gray, "Model  ")}${paint(colors.cyan, getModel(config).model)}\n`);
  process.stdout.write(`${paint(colors.gray, 'Usage  type text to check · /help for commands · """ for multiline')}\n\n`);

  if (!await startServer()) process.exit(1);

  const rl = createInterface({
    input: process.stdin, output: process.stdout,
    terminal: true, historySize: 100, removeHistoryDuplicates: true,
  });

  globalEscHandler = (chunk) => {
    if (chunk.length === 1 && chunk[0] === 0x1b) {
      rl.write(null, { ctrl: true, name: "e" });
      rl.write(null, { ctrl: true, name: "u" });
    }
  };

  rl.on("SIGINT", () => sigintHandler());
  process.stdin.on("data", globalEscHandler);
  process.on("exit", stopServer);

  while (true) {
    const { model } = getModel(config);
    const line = await askLine(rl, `${paint(colors.cyan, model + " ❯")} `);
    if (line === null) continue;
    const text = line.trim();
    if (!text) continue;

    if (["exit", "quit", "q"].includes(text.toLowerCase())) {
      await showSessionSummary(); stopServer(); rl.close(); process.exit(0);
    }

    if (text === '"""') {
      process.stdout.write(`${paint(colors.gray, 'multiline  ·  blank line or """ to submit · Ctrl+C to cancel')}\n`);
      const lines = [];
      while (true) {
        const l = await askLine(rl, `${paint(colors.cyan, "❯")} `);
        if (l === null) { lines.length = 0; break; }
        if (l.trim() === '"""' || (l.trim() === '' && lines.length > 0)) break;
        lines.push(l);
      }
      const combined = lines.join("\n").trim();
      if (combined) {
        const multiRejection = validateInput(combined);
        if (multiRejection) {
          process.stdout.write(`${paint(colors.yellow, multiRejection)}\n\n`);
        } else {
          lastSubmittedText = combined;
          lastSubmittedProvider = process.env.IGT_LLM_PROVIDER || "gemini";
          lastTargetPath = targetPath;
          await runGrammarCheck(combined, targetPath);
        }
      }
      continue;
    }

    if (text.startsWith("/")) { await handleCommand(text, config, rl); continue; }

    const rejection = validateInput(text);
    if (rejection) {
      process.stdout.write(`${paint(colors.yellow, rejection)}\n\n`);
      continue;
    }
    lastSubmittedText = text;
    lastSubmittedProvider = process.env.IGT_LLM_PROVIDER || "gemini";
    lastTargetPath = targetPath;
    await runGrammarCheck(text, targetPath);
  }
}

main().catch((err) => { process.stderr.write(`Fatal: ${err.message}\n`); process.exit(1); });
