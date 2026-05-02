#!/usr/bin/env node
// Interactive Grammar Tool v3 — cross-platform Node.js entry point

import { createInterface } from "node:readline";
import http from "node:http";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { colors, paint, Spinner } from "./lib/ui.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_PORT = 18964;
const SERVER_HOST = "127.0.0.1";
const SERVER_BASE = `http://${SERVER_HOST}:${SERVER_PORT}`;

// ─── Config ────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)/);
    if (!m) continue;
    const key = m[1].trim();
    if (key in process.env) continue;
    let val = m[2].trim();
    if (val.startsWith('"')) {
      const end = val.indexOf('"', 1);
      val = end !== -1 ? val.slice(1, end) : val.slice(1);
    } else if (val.startsWith("'")) {
      const end = val.indexOf("'", 1);
      val = end !== -1 ? val.slice(1, end) : val.slice(1);
    } else {
      const h = val.indexOf("#");
      if (h !== -1) val = val.slice(0, h).trim();
    }
    process.env[key] = val;
  }
}

function loadConfig() {
  const p = path.join(__dirname, "lib", "igt_config.json");
  if (!fs.existsSync(p)) { process.stderr.write("Error: igt_config.json not found\n"); process.exit(1); }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

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
      process.stdout.write(`  ${paint(colors.gray, `● server  port ${SERVER_PORT}`)}\n`);
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

const SECTION_RE = /^\*\*(Review|Correction|Refine|Diagnosis|Rule|Tip)\*\*/i;
const LIST_SECTIONS = new Set(["diagnosis", "rule", "tip"]);
const SC = {
  review:     { h: colors.yellow,  b: colors.yellow },
  correction: { h: colors.green,   b: colors.green  },
  refine:     { h: colors.cyan,    b: colors.cyan   },
  diagnosis:  { h: colors.magenta, b: colors.gray   },
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

function sanitize(line, section) {
  line = line.replace(/^\[(.+)\]$/, "$1").replace(/^"([^"]+)"$/, "$1").replace(/^'(.+)'$/, "$1").trim();
  if (LIST_SECTIONS.has(section) && line && !line.startsWith("- ")) line = `- ${line}`;
  return line;
}

function emitLines(text, section, color, seen) {
  const items = LIST_SECTIONS.has(section)
    ? text.split(/\s+(?=- )/).map((s) => s.trim()).filter(Boolean)
    : [text];
  for (const item of items) {
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    printLine(item, color);
  }
}

function renderResponse(content) {
  let section = "";
  let first = true;
  const seen = new Set();
  for (const raw of content.split("\n")) {
    const m = raw.match(SECTION_RE);
    if (m) {
      if (!first) process.stdout.write("\n");
      first = false;
      section = m[1].toLowerCase();
      seen.clear();
      const sc = SC[section];
      process.stdout.write(paint(sc.h, `**${m[1]}**`) + "\n");
      const rest = sanitize(raw.replace(SECTION_RE, "").replace(/^:\s*/, "").trim(), section);
      if (rest) emitLines(rest, section, sc.b, seen);
      continue;
    }
    if (!raw.trim()) continue;
    const sc = SC[section] || { b: colors.white };
    emitLines(sanitize(raw.trim(), section), section, sc.b, seen);
  }
}

// ─── Logging ───────────────────────────────────────────────────────────────────

function logResult(targetPath, text, content) {
  if (!targetPath) return;
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  try { fs.appendFileSync(targetPath, `\n---\n### [${ts}]\n**User Input**: ${text}\n**Output**:\n${content}`, "utf8"); }
  catch { process.stdout.write(paint(colors.yellow, "  Warning: Could not log entry.\n")); }
}

// ─── Input ─────────────────────────────────────────────────────────────────────
// sigintHandler is swapped by context: idle = no-op, input = clear line, http = abort

let sigintHandler = () => {};

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
    process.stdout.write("\n" + paint(colors.gray, "  Cancelled.\n"));
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
  process.stdout.write(`  ${paint(colors.gray, "Input  ")}${paint(colors.white, text)}\n`);
  process.stdout.write(`  ${paint(colors.gray, sep)}\n`);
  renderResponse(resp.content);
  process.stdout.write("\n");
  if (resp.perf) {
    const { llm_ms, total_ms } = resp.perf;
    process.stdout.write(`  ${paint(colors.gray, `${Math.round(llm_ms)}ms llm  ·  ${Math.round(total_ms)}ms total`)}\n`);
  }

  logResult(targetPath, text, resp.content);
}

// ─── Commands ──────────────────────────────────────────────────────────────────

function runNode(script, ...args) {
  return new Promise((resolve) => {
    spawn(process.execPath, [path.join(__dirname, script), ...args], {
      stdio: "inherit", env: process.env,
    }).on("close", resolve);
  });
}

function getModel(config) {
  const p = (process.env.IGT_LLM_PROVIDER || config.LLMProvider || "gemini").toLowerCase();
  const k = { gemini: "GeminiFlashModel", qwen: "QwenFlashModel", deepseek: "DeepseekFlashModel" };
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
      await runNode("tools/igt-handbook.mjs"); process.stdout.write("\n"); break;
    case "practice": case "p": {
      const m = args.join(" ").match(/^([A-Ca-c][12])\s+(\d+)$/);
      const nodeArgs = m ? [`--level=${m[1].toUpperCase()}`, `--count=${m[2]}`] : args;
      await runNode("tools/igt-practice.mjs", ...nodeArgs); process.stdout.write("\n"); break;
    }
    case "assess": case "as":
      await runNode("tools/igt-assess.mjs"); process.stdout.write("\n"); break;
    case "add": case "a":
      if (!args.length) process.stdout.write(paint(colors.yellow, "  Usage: /add <word or phrase>\n\n"));
      else await runNode("tools/igt-add.mjs", args.join(" "));
      break;
    case "vocab": case "v":
      await runNode("tools/igt-vocab.mjs", ...args); process.stdout.write("\n"); break;
    case "gemini": case "qwen": case "deepseek":
      await runNode("lib/llm-switch.mjs", "switch", cmd);
      process.env.IGT_LLM_PROVIDER = cmd;
      process.stdout.write(paint(colors.gray, `  Switched to ${getModel(config).model}\n`));
      break;
    case "llm":
      await runNode("lib/llm-switch.mjs", ...args); process.stdout.write("\n"); break;
    case "exit": case "quit": case "q":
      stopServer(); rl.close(); process.exit(0);
      break;
    default:
      process.stdout.write(paint(colors.yellow, `  Unknown command /${cmd} — type /help for a list.\n`));
  }
}

function showHelp() {
  const sep = "─".repeat(Math.min(54, Math.max(30, cols() - 3)));
  const row = (c, d) => process.stdout.write(`  ${paint(colors.cyan, c)}${paint(colors.gray, d)}\n`);
  process.stdout.write(`\n  ${paint(colors.yellow, "Commands")}\n  ${paint(colors.gray, sep)}\n`);
  row("/handbook  (/h)   ", "Generate your personal error handbook");
  row("/practice  (/p)   ", "Targeted grammar exercises (CEFR-aware)");
  row("/practice B2 10   ", "Shorthand for --level=B2 --count=10");
  row("/assess    (/as)  ", "Estimate your CEFR proficiency level");
  row("/add <w>   (/a)   ", "Add a word to your Obsidian vocabulary note");
  row("/vocab     (/v)   ", "Review saved vocabulary (quiz or list)");
  row("/gemini           ", "Switch to Gemini model");
  row("/qwen             ", "Switch to Qwen model");
  row("/deepseek         ", "Switch to Deepseek model");
  row('"""               ', "Enter multiline input mode");
  row("/exit      (/q)   ", "Quit IGT");
  process.stdout.write("\n");
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  process.env.GEMINI_SYSTEM_MD = "false";
  process.env.GEMINI_TELEMETRY_ENABLED = "false";

  loadEnv();
  const config = loadConfig();
  const targetPath = process.env.IGT_REVIEW_PATH || config.ReviewPath || "";

  process.stdout.write("\n");
  process.stdout.write(`  ${paint(colors.bold + colors.yellow, "IGT")}  ${paint(colors.white, "Interactive Grammar Tool")}\n`);
  process.stdout.write(`  ${paint(colors.gray, "──────────────────────────────────────────────")}\n`);
  process.stdout.write(`  ${paint(colors.gray, "Model  ")}${paint(colors.cyan, getModel(config).model)}\n`);
  process.stdout.write(`  ${paint(colors.gray, 'Usage  type text to check · /help for commands · """ for multiline')}\n\n`);

  if (!await startServer()) process.exit(1);

  const rl = createInterface({
    input: process.stdin, output: process.stdout,
    terminal: true, historySize: 100, removeHistoryDuplicates: true,
  });
  rl.on("SIGINT", () => sigintHandler());
  process.on("exit", stopServer);

  while (true) {
    const { model } = getModel(config);
    const line = await askLine(rl, `  ${paint(colors.cyan, model + " ❯")} `);
    if (line === null) continue;
    const text = line.trim();
    if (!text) continue;

    if (["exit", "quit", "q"].includes(text.toLowerCase())) {
      stopServer(); rl.close(); process.exit(0);
    }

    if (text === '"""') {
      process.stdout.write(`  ${paint(colors.gray, 'multiline  ·  """ on its own line to submit')}\n`);
      const lines = [];
      while (true) {
        const l = await askLine(rl, `  ${paint(colors.cyan, "❯")} `);
        if (l === null) continue;
        if (l.trim() === '"""') break;
        lines.push(l);
      }
      const combined = lines.join("\n").trim();
      if (combined) await runGrammarCheck(combined, targetPath);
      continue;
    }

    if (text.startsWith("/")) { await handleCommand(text, config, rl); continue; }

    await runGrammarCheck(text, targetPath);
  }
}

main().catch((err) => { process.stderr.write(`Fatal: ${err.message}\n`); process.exit(1); });
