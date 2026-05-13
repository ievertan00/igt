#!/usr/bin/env node
// Interactive Grammar Tool v3 — cross-platform Node.js entry point

import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { colors, paint, ansi, renderStatusBar } from "./lib/ui.mjs";
import configLoader from "./lib/config-loader.mjs";
import { api } from "./lib/api-client.mjs";
import { startServer, stopServer } from "./lib/server-manager.mjs";
import { handleCommand } from "./lib/commands/dispatch.mjs";
import { runGrammarCheck } from "./lib/commands/grammar.mjs";
import { showSessionSummary } from "./lib/commands/stats.mjs";
import { resolveModel } from "./lib/llm/model-resolver.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── State ──────────────────────────────────────────────────────────────────────

let totalInputs = 0;
let totalDiagnoses = 0;
let currentStatusMessage = "Keep practicing!";
let currentStatusAuthor = "";
let scrollOffset = 0;
let lastRows = 0;
let lastCols = 0;
let lastStatus = "";
let sigintHandler = null;
let globalEscHandler = null;
let lastSubmittedText = "";
let lastSubmittedProvider = "";
let lastTargetPath = "";
let sessionSentenceCount = 0;

let resizeTimer = null;
let isResizing = false;

// ─── UI ─────────────────────────────────────────────────────────────────────────

function getModel(config) {
  const provider = (process.env.IGT_LLM_PROVIDER || config.LLMProvider || "gemini").toLowerCase();
  try {
    const { model } = resolveModel(provider, "grammar", config);
    return { provider, model };
  } catch (err) {
    return { provider, model: provider };
  }
}

function sweepStatusBar() {
  const currentRows = process.stdout.rows || 24;
  // Sweep a large area to catch any "dirty" scrolls from wraps.
  // 15 lines up from the bottom should be plenty for even extreme wraps.
  let sweep = ansi.saveCursor;
  for (let r = Math.max(1, currentRows - 15); r <= currentRows; r++) {
    sweep += `\x1b[${r};1H` + ansi.clearLine;
  }
  sweep += ansi.restoreCursor;
  process.stdout.write(sweep);
}

function updateUI(config) {
  if (isResizing) return;
  const rows = process.stdout.rows || 24;
  const cols = process.stdout.columns || 80;

  if (rows !== lastRows || cols !== lastCols) {
    if (lastRows > 0 || lastCols > 0) {
      sweepStatusBar();
    }
    process.stdout.write(ansi.saveCursor + ansi.setScrollingRegion(rows) + ansi.restoreCursor);
    lastRows = rows;
    lastCols = cols;
  }
  const { model } = getModel(config);
  const status = renderStatusBar(
    { totalInputs, totalDiagnoses, model },
    { content: currentStatusMessage, author: currentStatusAuthor },
    rows,
    scrollOffset,
  );
  if (status !== lastStatus) {
    process.stdout.write(status);
    lastStatus = status;
  }
}

// ─── Input ──────────────────────────────────────────────────────────────────────

function askLine(rl, prompt) {
  return new Promise((resolve) => {
    let settled = false;
    const onLine = (line) => {
      if (settled) return;
      settled = true;
      rl.removeListener("line", onLine);
      sigintHandler = null;
      api.getStatusMessage()
        .then((msg) => {
          if (msg && msg.content) {
            if (msg.content !== currentStatusMessage) scrollOffset = 0;
            currentStatusMessage = msg.content;
            currentStatusAuthor = msg.author || "";
            updateUI(configLoader.load());
          }
        })
        .catch(() => {});
      resolve(line);
    };
    sigintHandler = () => {
      if (settled) return;
      settled = true;
      rl.removeListener("line", onLine);
      rl.write(null, { ctrl: true, name: "e" });
      rl.write(null, { ctrl: true, name: "u" });
      process.stdout.write("^C\n");
      sigintHandler = null;
      resolve(null);
    };
    rl.on("line", onLine);
    rl.setPrompt(prompt);
    rl.prompt();
    if (lastStatus) process.stdout.write(lastStatus);
  });
}

// ─── Validation ─────────────────────────────────────────────────────────────────

const TEST_PATTERNS = /^(test(ing)?|hello|hi|hey|ok|okay|yes|no|sure|thanks|thank you|lol|haha|asdf|qwerty|foo|bar|baz|abc|xyz|aaa+|bbb+|ccc+|zzz+|123|1234|12345)[!?.\s]*$/i;

function validateInput(text) {
  if (text.length < 10) return "Input too short — type a complete sentence.";
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (words.length < 2) return "Input too short — needs at least two words.";
  if (TEST_PATTERNS.test(text)) return "Looks like a test input — type a sentence you actually want checked.";
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

// ─── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  // Clear screen and reset cursor to top-left
  try {
    process.stdout.write(process.platform === "win32" ? "\x1b[2J\x1b[0f" : "\x1b[2J\x1b[H");
  } catch {}

  const config = configLoader.load();
  const targetPath = process.env.IGT_REVIEW_PATH || config.ReviewPath || "";
  const rows = process.stdout.rows || 24;
  const cols_val = process.stdout.columns || 80;

  process.stdout.write("\n");
  process.stdout.write(`${paint(colors.bold + colors.yellow, "IGT")}  ${paint(colors.brightCyan, "Interactive Grammar Tool")}\n`);
  process.stdout.write(`${paint(colors.gray, `Terminal: ${cols_val}x${rows}`)}\n`);
  process.stdout.write(`${paint(colors.gray, "──────────────────────────────────────────────────────────────────")}\n`);
  process.stdout.write(`${paint(colors.gray, "Model  ")}${paint(colors.gray, getModel(config).model)}\n`);
  process.stdout.write(`${paint(colors.gray, 'Usage  type text to check · /help for commands · """ for multiline')}\n`);
  process.stdout.write(`${paint(colors.gray, "──────────────────────────────────────────────────────────────────")}\n`);

  const ok = await startServer(({ port }) => {
    process.stdout.write(`${paint(colors.gray, `● server  port ${port}`)}\n\n`);
  });
  if (!ok) process.exit(1);

  const _origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, enc, cb) => {
    if (typeof chunk === "string") chunk = chunk.replace(/\x1b\[0?J/g, "\x1b[K");
    return _origWrite(chunk, enc, cb);
  };

  const rl = createInterface({
    input: process.stdin, output: process.stdout,
    terminal: true, historySize: 100, removeHistoryDuplicates: true,
  });

  const initRows = process.stdout.rows || 24;
  process.stdout.write(ansi.saveCursor + ansi.setScrollingRegion(initRows) + ansi.restoreCursor);
  lastStatus = "";
  updateUI(config);

  (async () => {
    try {
      const [stats, msg] = await Promise.all([api.getStats(), api.getStatusMessage()]);
      if (stats.totalInputs !== undefined) totalInputs = stats.totalInputs;
      if (stats.totalDiagnoses !== undefined) totalDiagnoses = stats.totalDiagnoses;
      if (msg && msg.content) {
        if (msg.content !== currentStatusMessage) scrollOffset = 0;
        currentStatusMessage = msg.content;
        currentStatusAuthor = msg.author || "";
      }
      updateUI(config);
    } catch {}
  })();

  const uiInterval = setInterval(() => {
    scrollOffset++;
    updateUI(config);
  }, 300);

  globalEscHandler = (chunk) => {
    if (chunk.length === 1 && chunk[0] === 0x1b) {
      rl.write(null, { ctrl: true, name: "e" });
      rl.write(null, { ctrl: true, name: "u" });
      if (lastStatus) process.stdout.write(lastStatus);
    }
  };

  const cleanup = () => {
    clearInterval(uiInterval);
    try { fs.writeSync(1, ansi.resetScrollingRegion); } catch {}
    stopServer();
    try { execSync(process.platform === "win32" ? "cls" : "clear", { stdio: "inherit", shell: true }); } catch {}
  };

  rl.on("SIGINT", () => { if (sigintHandler) sigintHandler(); else process.exit(0); });
  process.stdin.on("data", globalEscHandler);
  process.stdout.on("resize", () => {
    isResizing = true;
    if (resizeTimer) clearTimeout(resizeTimer);

    // Eagerly re-set scrolling region on every signal to protect the bottom area
    // from readline wraps. We use _origWrite to bypass the J->K interceptor.
    const rows = process.stdout.rows || 24;
    _origWrite(ansi.saveCursor + ansi.setScrollingRegion(rows) + ansi.restoreCursor);

    resizeTimer = setTimeout(() => {
      isResizing = false;
      sweepStatusBar();
      lastRows = 0; // Force updateUI to fully re-render
      updateUI(configLoader.load());
    }, 150);
  });
  process.on("exit", cleanup);
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGHUP", () => process.exit(0));

  const grammarCtx = {
    onSigint: (h) => { sigintHandler = h; },
    onResult: ({ inputs, diagnoses }) => {
      sessionSentenceCount++;
      totalInputs += inputs;
      totalDiagnoses += diagnoses;
      updateUI(configLoader.load());
    },
  };

  while (true) {
    const { model } = getModel(config);
    const line = await askLine(rl, `${paint(colors.cyan, model + " ❯")} `);
    if (line === null) continue;
    const text = line.trim();
    if (!text) continue;

    if (["exit", "quit", "q"].includes(text.toLowerCase())) {
      await showSessionSummary(sessionSentenceCount);
      rl.close();
      process.exit(0);
    }

    if (text === '"""') {
      process.stdout.write(`${paint(colors.gray, 'multiline  ·  blank line or """ to submit · Ctrl+C to cancel')}\n`);
      const lines = [];
      while (true) {
        const l = await askLine(rl, `${paint(colors.cyan, "❯")} `);
        if (l === null) { lines.length = 0; break; }
        if (l.trim() === '"""' || (l.trim() === "" && lines.length > 0)) break;
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
          await runGrammarCheck(combined, targetPath, grammarCtx);
        }
      }
      continue;
    }

    if (text.startsWith("/")) {
      await handleCommand(text, {
        rl,
        askLine,
        config,
        sessionState: {
          get lastSubmittedText() { return lastSubmittedText; },
          get lastTargetPath() { return lastTargetPath; },
          get sessionSentenceCount() { return sessionSentenceCount; },
        },
        grammarCtx,
        setSigint: (h) => { sigintHandler = h; },
        attachStdin: () => { if (globalEscHandler) process.stdin.on("data", globalEscHandler); },
        detachStdin: () => { if (globalEscHandler) process.stdin.removeListener("data", globalEscHandler); },
        refreshUI: () => updateUI(configLoader.load()),
        refreshStats: async () => {
          try {
            const stats = await api.getStats();
            if (stats.totalInputs !== undefined) totalInputs = stats.totalInputs;
            if (stats.totalDiagnoses !== undefined) totalDiagnoses = stats.totalDiagnoses;
            updateUI(configLoader.load());
          } catch {}
        },
      });
      continue;
    }

    const rejection = validateInput(text);
    if (rejection) {
      process.stdout.write(`${paint(colors.yellow, rejection)}\n\n`);
      continue;
    }
    lastSubmittedText = text;
    lastSubmittedProvider = process.env.IGT_LLM_PROVIDER || "gemini";
    lastTargetPath = targetPath;
    await runGrammarCheck(text, targetPath, grammarCtx);
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
