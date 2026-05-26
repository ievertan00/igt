import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { colors, paint, applyTheme } from "../ui/index.mjs";
import { themes } from "../ui/themes.mjs";
import { api } from "../api-client.mjs";
import { showHelp } from "./help.mjs";
import { runUndo } from "./undo.mjs";
import { runReview } from "./review.mjs";
import { runStats, runToday, showSessionSummary } from "./stats.mjs";
import { runGrammarCheck } from "./grammar.mjs";
import { runAsk } from "./ask.mjs";
import { resolveModel } from "../../server/llm/model-resolver.mjs";
import configLoader from "../../shared/config-loader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..", "..");

function runNode(script, args, ctx) {
  return new Promise((resolve) => {
    if (ctx.rl) ctx.rl.pause();
    if (ctx.detachStdin) ctx.detachStdin();
    const child = spawn(process.execPath, [path.join(projectRoot, script), ...args], {
      stdio: "inherit",
      env: process.env,
    });
    ctx.setSigint(() => {
      child.kill();
      ctx.setSigint(() => {});
    });
    child.on("close", () => {
      ctx.setSigint(() => {});
      if (ctx.rl) ctx.rl.resume();
      if (ctx.attachStdin) ctx.attachStdin();
      resolve();
    });
  });
}

async function switchOllamaFamily(family, ctx) {
  ctx.config.OllamaFamily = family;
  await api.switchProvider("ollama");
  process.env.IGT_LLM_PROVIDER = "ollama";
  Object.assign(ctx.config, configLoader.load());
  ctx.config.OllamaFamily = family;
  configLoader.saveConfig(ctx.config);
  const { model } = resolveModel("ollama", "grammar", ctx.config);
  ctx.refreshUI();
  const label = family === "phi" ? "Phi-4" : "Gemma 4";
  process.stdout.write(paint(colors.gray, `Switched to local ${label} (Ollama: ${model})\n`));
}

// ─── Command registry ─────────────────────────────────────────────────────────
// Map: alias → async handler(args, ctx)
// To add a command, register() below — no switch edits needed.

const COMMANDS = new Map();

function register(aliases, handler) {
  for (const a of aliases) COMMANDS.set(a, handler);
}

register(["help"], async (_args, _ctx) => {
  showHelp();
});

register(["handbook", "h"], async (_args, ctx) => {
  await runNode("tools/igt-handbook.mjs", [], ctx);
  process.stdout.write("\n");
});

register(["practice", "p"], async (args, ctx) => {
  const m = args.join(" ").match(/^([A-Ca-c][12])\s+(\d+)$/);
  const nodeArgs = m ? [`--level=${m[1].toUpperCase()}`, `--count=${m[2]}`] : args;
  await runNode("tools/igt-practice.mjs", nodeArgs, ctx);
  process.stdout.write("\n");
});

register(["assess", "as"], async (_args, ctx) => {
  await runNode("tools/igt-assess.mjs", [], ctx);
  process.stdout.write("\n");
});

register(["add", "a"], async (args, ctx) => {
  const words = args
    .join(" ")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  if (!words.length)
    process.stdout.write(paint(colors.yellow, "Usage: /add <word1>, <word2>, …\n\n"));
  else for (const w of words) await runNode("tools/igt-add.mjs", [w], ctx);
});

register(["vocab", "v", "word", "w"], async (args, ctx) => {
  if (args.includes("--list") || args.includes("list")) {
    await runNode("tools/igt-vocab.mjs", ["--list"], ctx);
    process.stdout.write("\n");
  } else {
    try {
      const seed = await api.seedVocab();
      if (seed.seeded > 0)
        process.stdout.write(
          paint(colors.gray, `  Seeded ${seed.seeded} new word(s) into SRS deck.\n\n`),
        );
    } catch {}
    process.stdout.write(
      paint(colors.gray, "SRS Word: Master your saved vocabulary with active recall.\n"),
    );
    process.stdout.write(
      paint(
        colors.gray,
        "Guidance: Recite the word/definition, press [Enter] to reveal, then grade yourself.\n\n",
      ),
    );
    const n = parseInt(args[0], 10);
    await runReview(ctx.askLine, ctx.rl, Number.isFinite(n) ? n : 20, "vocab");
  }
});

register(["gemini", "qwen", "deepseek", "ollama"], async (cmd, ctx) => {
  // cmd here is the alias itself, passed as first element
  await api.switchProvider(cmd);
  process.env.IGT_LLM_PROVIDER = cmd;
  Object.assign(ctx.config, configLoader.load());
  ctx.refreshUI();
  process.stdout.write(paint(colors.gray, `Switched to ${cmd}\n`));
});

register(["phi"], async (_args, ctx) => switchOllamaFamily("phi", ctx));
register(["gemma"], async (_args, ctx) => switchOllamaFamily("gemma", ctx));

register(["theme"], async (_args, ctx) => {
  const themeNames = Object.keys(themes);
  process.stdout.write(paint(colors.bold + colors.yellow, "Available Themes:\n"));
  themeNames.forEach((name, idx) => {
    process.stdout.write(`  ${paint(colors.cyan, String(idx + 1))} - ${name}\n`);
  });
  process.stdout.write("\n");
  const choice = await ctx.askLine(
    ctx.rl,
    paint(colors.gray, "Select a theme number (or press Enter to cancel) ❯ "),
  );
  const idx = parseInt(choice.trim(), 10) - 1;
  if (!isNaN(idx) && idx >= 0 && idx < themeNames.length) {
    const selectedTheme = themeNames[idx];
    applyTheme(selectedTheme);
    ctx.config.Theme = selectedTheme;
    configLoader.updateEnv({ IGT_THEME: selectedTheme });
    if (ctx.refreshUI) ctx.refreshUI();
    process.stdout.write(paint(colors.green, `\nTheme set to '${selectedTheme}'.\n\n`));
  } else {
    process.stdout.write(paint(colors.yellow, "\nCancelled or invalid selection.\n\n"));
  }
});

register(["llm"], async (args, ctx) => {
  await runNode("tools/igt-llm.mjs", args, ctx);
  process.stdout.write("\n");
});

register(["undo", "u"], async (args, ctx) => {
  await runUndo(ctx.askLine, ctx.rl, args[0] ? parseInt(args[0], 10) : 1, ctx.refreshStats);
});

register(["review", "r"], async (args, ctx) => {
  process.stdout.write(
    paint(colors.gray, "SRS Review: Drill your grammar mistakes to build muscle memory.\n"),
  );
  process.stdout.write(
    paint(
      colors.gray,
      "Guidance: Read the context, guess the correction, then press [Enter] to verify.\n\n",
    ),
  );
  await runReview(ctx.askLine, ctx.rl, args[0] ? parseInt(args[0], 10) : 10, "grammar");
});

register(["stats", "st"], async (_args, _ctx) => {
  await runStats();
});

register(["today"], async (_args, ctx) => {
  await runToday(ctx.askLine, ctx.rl);
});

register(["ask"], async (args, ctx) => {
  await runAsk(args, ctx);
});

register(["retry"], async (_args, ctx) => {
  if (!ctx.sessionState.lastSubmittedText) {
    process.stdout.write(paint(colors.yellow, "Nothing to retry yet.\n\n"));
  } else {
    await runGrammarCheck(
      ctx.sessionState.lastSubmittedText,
      ctx.sessionState.lastTargetPath,
      ctx.grammarCtx,
    );
  }
});

register(["exit", "quit", "q"], async (_args, ctx) => {
  if (ctx.stopUI) ctx.stopUI();
  process.stdout.write(process.platform === "win32" ? "\x1b[2J\x1b[0f" : "\x1b[2J\x1b[H");
  await showSessionSummary(ctx.sessionState.sessionSentenceCount);
  ctx.rl.close();
  try {
    await api.unloadOllama();
  } catch {}
  process.exit(0);
});

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function handleCommand(raw, ctx) {
  const parts =
    raw
      .slice(1)
      .trim()
      .match(/[^\s"']+|"([^"]*)"|'([^']*)'/g)
      ?.map((p) => {
        if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'")))
          return p.slice(1, -1);
        return p;
      }) || [];
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);
  process.stdout.write("\n");
  if (!cmd) return;

  const handler = COMMANDS.get(cmd);
  if (!handler) {
    process.stdout.write(
      paint(colors.yellow, `Unknown command /${cmd} — type /help for a list.\n`),
    );
    return;
  }

  // Provider-switch commands receive the cmd name as their first "arg"
  if (["gemini", "qwen", "deepseek", "ollama"].includes(cmd)) {
    await handler(cmd, ctx);
  } else {
    await handler(args, ctx);
  }
}
