#!/usr/bin/env node
// Interactive Grammar Tool v3 — cross-platform Node.js entry point

import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { colors, paint, ansi, renderStatusBar, applyTheme } from "./lib/cli/ui/index.mjs";
import configLoader from "./lib/shared/config-loader.mjs";
import { api } from "./lib/cli/api-client.mjs";
import { startServer, stopServer, startTtsSidecar, stopTtsSidecar } from "./lib/cli/server-manager.mjs";
import { handleCommand } from "./lib/cli/commands/dispatch.mjs";
import { runGrammarCheck } from "./lib/cli/commands/grammar.mjs";
import { showSessionSummary } from "./lib/cli/commands/stats.mjs";
import { resolveModel } from "./lib/server/llm/model-resolver.mjs";
import { validateInput, isMainlyChinese } from "./lib/cli/validate-input.mjs";
import { runTrans } from "./lib/cli/commands/translation.mjs";
import { createPasteFilter } from "./lib/cli/paste-filter.mjs";

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
let lastGrammarResult = null;
let sessionSentenceCount = 0;

let resizeTimer = null;
let isResizing = false;
let isUIStopped = false;

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
  if (isResizing || isUIStopped) return;
  const { rows = 24, cols = 80 } = process.stdout;

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
      api
        .getStatusMessage()
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

// ─── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  // Clear screen and reset cursor to top-left
  try {
    process.stdout.write(process.platform === "win32" ? "\x1b[2J\x1b[0f" : "\x1b[2J\x1b[H");
  } catch {}

  const config = configLoader.load();
  applyTheme(config.Theme || "auto");
  const targetPath = process.env.IGT_REVIEW_PATH || config.ReviewPath || "";
  const rows = process.stdout.rows || 24;
  const cols_val = process.stdout.columns || 80;
  const sep = "─".repeat(Math.min(66, Math.max(20, cols_val - 3)));

  process.stdout.write("\n");
  process.stdout.write(
    `${paint(colors.bold + colors.yellow, "IGT")}  ${paint(colors.brightCyan, "Interactive Grammar Tool")}\n`,
  );
  process.stdout.write(`${paint(colors.gray, `Terminal: ${cols_val}x${rows}`)}\n`);
  process.stdout.write(
    `${paint(colors.gray, sep)}\n`,
  );
  process.stdout.write(
    `${paint(colors.gray, "Model  ")}${paint(colors.gray, getModel(config).model)}\n`,
  );
  process.stdout.write(
    `${paint(colors.gray, "Usage  type text to check · /help for commands · ")}\n`,
  );
  process.stdout.write(
    `${paint(colors.gray, sep)}\n`,
  );

  const ok = await startServer(({ port }) => {
    process.stdout.write(`${paint(colors.gray, `● server  port ${port}`)}\n\n`);
  });
  if (!ok) process.exit(1);

  // Auto-launch the configured local TTS adapter (e.g. CosyVoice shim) so `igt`
  // alone brings up voice. No-op unless IGT_TTS_SIDECAR is set.
  startTtsSidecar(config.Tts?.Sidecar);

  const stopUI = () => {
    isUIStopped = true;
    clearInterval(uiInterval);
    try {
      fs.writeSync(1, ansi.resetScrollingRegion);
    } catch {}
  };

  const _origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, enc, cb) => {
    const result = _origWrite(chunk, enc, cb);
    // After any "erase to end of screen" (ED), immediately redraw the status
    // bar so readline's _refreshLine doesn't permanently wipe it.  We must NOT
    // replace \x1b[J with \x1b[K here — doing so breaks readline's multi-line
    // refresh and causes the ghost-character / cursor-desync bug on wrapped lines.
    if (!isUIStopped && typeof chunk === "string" && /\x1b\[(?:0?|2)J/.test(chunk) && lastStatus) {
      _origWrite(lastStatus);
    }
    return result;
  };

  // Route stdin through a bracketed-paste filter before readline reads it. With
  // bracketed paste enabled (ansi.enableBracketedPaste), a pasted block arrives
  // wrapped in markers; the filter strips them and collapses the block's newlines
  // to spaces so a multi-line paste lands as ONE input line instead of readline
  // firing a submission per line. readline reads the filtered PassThrough, not the
  // raw TTY, so we drive raw mode ourselves.
  const pasteFeed = createPasteFilter();
  const filteredStdin = new PassThrough();
  const feedStdin = (chunk) => {
    const out = pasteFeed(chunk.toString("utf8"));
    if (out) filteredStdin.write(out);
  };
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.on("data", feedStdin);
  process.stdout.write(ansi.enableBracketedPaste);

  const rl = createInterface({
    input: filteredStdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
    removeHistoryDuplicates: true,
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
    stopUI();
    stopServer();
    stopTtsSidecar();
    // Leave the terminal the way we found it: turn bracketed paste back off and
    // restore cooked mode, so the user's shell isn't left in raw/paste mode.
    try { fs.writeSync(1, ansi.disableBracketedPaste); } catch {}
    try { if (process.stdin.isTTY) process.stdin.setRawMode(false); } catch {}
  };

  async function asyncExit() {
    try {
      await api.unloadOllama();
    } catch {}
    process.exit(0);
  }

  rl.on("SIGINT", () => {
    if (sigintHandler) sigintHandler();
    else asyncExit();
  });
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
  process.on("SIGTERM", () => asyncExit());
  process.on("SIGHUP", () => asyncExit());

  const grammarCtx = {
    onSigint: (h) => {
      sigintHandler = h;
    },
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
      stopUI();
      process.stdout.write(process.platform === "win32" ? "\x1b[2J\x1b[0f" : "\x1b[2J\x1b[H");
      await showSessionSummary(sessionSentenceCount);
      rl.close();
      await asyncExit();
    }

    if (text.startsWith("/")) {
      await handleCommand(text, {
        rl,
        askLine,
        config,
        sessionState: {
          get lastSubmittedText() {
            return lastSubmittedText;
          },
          get lastGrammarResult() {
            return lastGrammarResult;
          },
          get lastTargetPath() {
            return lastTargetPath;
          },
          get sessionSentenceCount() {
            return sessionSentenceCount;
          },
        },
        grammarCtx,
        setSigint: (h) => {
          sigintHandler = h;
        },
        attachStdin: () => {
          if (globalEscHandler) process.stdin.on("data", globalEscHandler);
          process.stdin.on("data", feedStdin);
          if (process.stdin.isTTY) process.stdin.setRawMode(true);
          // After a child ran with stdio:"inherit", the parent's stdin does not
          // resume reading on its own — without this, feedStdin never fires again
          // and the prompt goes dead (Enter/keys stop working). Re-issue the read.
          process.stdin.resume();
          process.stdout.write(ansi.enableBracketedPaste);
        },
        detachStdin: () => {
          if (globalEscHandler) process.stdin.removeListener("data", globalEscHandler);
          process.stdin.removeListener("data", feedStdin);
          // Hand a normal cooked terminal (no paste markers) to the spawned child,
          // which manages its own readline/raw mode.
          process.stdout.write(ansi.disableBracketedPaste);
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          // Removing the data listeners is not enough to stop the parent's own
          // libuv read of the TTY — without pause() the parent keeps consuming
          // stdin bytes and starves the inherited child's prompt, so keys/Enter in
          // the child (e.g. igt-add's "Save?") do nothing. resume() in attachStdin.
          process.stdin.pause();
        },
        refreshUI: () => updateUI(configLoader.load()),
        refreshStats: async () => {
          try {
            const stats = await api.getStats();
            if (stats.totalInputs !== undefined) totalInputs = stats.totalInputs;
            if (stats.totalDiagnoses !== undefined) totalDiagnoses = stats.totalDiagnoses;
            updateUI(configLoader.load());
          } catch {}
        },
        stopUI,
      });
      continue;
    }

    if (isMainlyChinese(text)) {
      await runTrans(text, { setSigint: (h) => { sigintHandler = h; } });
      continue;
    }

    const rejection = validateInput(text, { lastSubmittedText, lastSubmittedProvider });
    if (rejection) {
      process.stdout.write(`${paint(colors.yellow, rejection)}\n\n`);
      continue;
    }
    lastSubmittedText = text;
    lastSubmittedProvider = process.env.IGT_LLM_PROVIDER || "gemini";
    lastTargetPath = targetPath;
    lastGrammarResult = await runGrammarCheck(text, targetPath, grammarCtx);
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
