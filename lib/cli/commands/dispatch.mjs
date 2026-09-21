import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { colors, paint, applyTheme } from "../ui/index.mjs";
import { themes } from "../ui/themes.mjs";
import { api } from "../api-client.mjs";
import { showHelp } from "./help.mjs";
import { runReview } from "./review.mjs";
import { runStats, runToday } from "./stats.mjs";
import { runAsk } from "./ask.mjs";
import { runChat } from "./chat.mjs";
import { runVoice, rememberEnglish } from "./listen.mjs";
import { runTrans } from "./translation.mjs";
import { runWordPractice } from "./quiz.mjs";
import { runPractice, runChoicePractice } from "./practice.mjs";
import { resolveModel } from "../../server/llm/model-resolver.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { renderModuleIndex } from "../../features/modules/catalog.mjs";
import { runSentenceModule } from "../../features/modules/sentence.mjs";
import { runTextModule } from "../../features/modules/text.mjs";
import { assertRegisteredCommand } from "./registry.mjs";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..", "..");

function runNode(script, args, ctx) {
  return new Promise((resolve) => {
    if (ctx.rl) ctx.rl.pause();
    if (ctx.detachStdin) ctx.detachStdin();
    const child = spawn(process.execPath, [path.join(projectRoot, script), ...args], {
      stdio: script === "tools/igt-add.mjs" ? ["inherit", "inherit", "inherit", "ipc"] : "inherit",
      env: process.env,
    });
    child.on("message", (message) => {
      if (message?.type === "english-expression") rememberEnglish(message.text);
    });
    ctx.setSigint(() => {
      child.kill();
      ctx.setSigint(() => {});
    });
    child.on("close", () => {
      ctx.setSigint(() => {});
      if (ctx.rl) ctx.rl.resume();
      if (ctx.attachStdin) ctx.attachStdin();
      applyTheme(ctx.config.Theme || "auto");
      resolve();
    });
  });
}

async function switchOllamaGemma(ctx) {
  ctx.config.OllamaFamily = "gemma";
  await api.switchProvider("ollama");
  process.env.IGT_LLM_PROVIDER = "ollama";
  Object.assign(ctx.config, configLoader.load());
  ctx.config.OllamaFamily = family;
  configLoader.saveConfig(ctx.config);
  const { model } = resolveModel("ollama", "grammar", ctx.config);
  ctx.refreshUI();
  process.stdout.write(paint(colors.gray, `Switched to local Gemma 4 (Ollama: ${model})\n`));
}

// ─── Command registry ─────────────────────────────────────────────────────────
// Map: alias → async handler(args, ctx)
// To add a command, register() below — no switch edits needed.

const COMMANDS = new Map();

function register(aliases, handler) {
  if (!aliases.some((alias) => {
    try { assertRegisteredCommand(alias); return true; }
    catch { return false; }
  })) throw new Error(`Missing command metadata for /${aliases[0]}`);
  for (const a of aliases) COMMANDS.set(a, handler);
}

register(["help"], async (_args, _ctx) => {
  showHelp();
});

register(["modules", "module", "m"], async (args, _ctx) => {
  if (args[0] === "sentence") {
    await runSentenceModule([], _ctx);
    return;
  }
  if (args[0] === "text") {
    await runTextModule([], _ctx);
    return;
  }
  process.stdout.write("\n  Learning modules\n  ────────────────\n");
  process.stdout.write(`${renderModuleIndex()}\n\n`);
  process.stdout.write("  Use /sentence or /text to open a module. /word remains the vocabulary entry point.\n\n");
});

register(["sentence", "sentent"], async (args, ctx) => {
  await runSentenceModule(args, ctx);
});

register(["text"], async (args, ctx) => {
  await runTextModule(args, ctx);
});

register(["handbook", "h"], async (args, ctx) => {
  await runNode("tools/igt-handbook.mjs", args, ctx);
  process.stdout.write("\n");
});

register(["coach", "plan"], async (args, ctx) => {
  await runNode("tools/igt-coach.mjs", args, ctx);
  process.stdout.write("\n");
});

async function runPracticeEntry(mode, args, ctx) {
  if (mode === "word") {
    await runWordPractice(args, ctx);
  } else if (mode === "sentence") {
    await runPractice(["sentence", ...args], ctx);
  } else if (mode === "choice") {
    await runChoicePractice(args, ctx);
  } else {
    process.stdout.write(paint(colors.yellow, "Usage: /practice [word|sentence|choice]\n\n"));
  }
}

register(["practice", "p"], async (args, ctx) => {
  const mode = args[0]?.toLowerCase();
  await runPracticeEntry(mode, args.slice(1), ctx);
  process.stdout.write("\n");
});

register(["pw"], async (args, ctx) => runPracticeEntry("word", args, ctx));
register(["ps"], async (args, ctx) => runPracticeEntry("sentence", args, ctx));
register(["pc"], async (args, ctx) => runPracticeEntry("choice", args, ctx));

register(["word", "w", "a"], async (args, ctx) => {
  const subcommand = args[0]?.toLowerCase();
  if (subcommand === "review") {
    const count = args[1] === undefined ? 20 : Number(args[1]);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      process.stdout.write(paint(colors.yellow, "Usage: /word review [1-100]\n\n"));
      return;
    }
    try {
      const seed = await api.seedVocab();
      if (seed.seeded > 0)
        process.stdout.write(paint(colors.gray, `  Seeded ${seed.seeded} new word(s) into SRS deck.\n\n`));
    } catch {}
    process.stdout.write(paint(colors.gray, "SRS Word: Master your saved vocabulary with active recall.\n"));
    process.stdout.write(paint(colors.gray, "Guidance: Type your recall first, press [Enter] to reveal, then grade yourself.\n\n"));
    await runReview(ctx.askLine, ctx.rl, count, "vocab", ctx.config);
  } else if (args.includes("--list") || subcommand === "list") {
    await runNode("tools/igt-vocab.mjs", ["--list"], ctx);
    process.stdout.write("\n");
  } else if (args.length > 0 && !Number.isInteger(Number(args[0]))) {
    // A word argument is both lookup and add: existing entries are returned,
    // while new entries go through the vocabulary lookup-and-save flow.
    await runNode("tools/igt-add.mjs", [args.join(" ")], ctx);
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
    const n = Number(args[0]);
    if (args[0] && (!Number.isInteger(n) || n < 1 || n > 100)) {
      process.stdout.write(paint(colors.yellow, "Usage: /word [1-100] or /word <word or phrase>\n\n"));
      return;
    }
    await runReview(ctx.askLine, ctx.rl, Number.isFinite(n) ? n : 20, "vocab", ctx.config);
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

register(["gemma"], async (_args, ctx) => switchOllamaGemma(ctx));

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

register(["provider", "llm"], async (args, ctx) => {
  await runNode("tools/igt-llm.mjs", args, ctx);
  process.stdout.write("\n");
});

register(["stats", "st"], async (_args, _ctx) => {
  await runStats();
});

register(["today"], async (_args, ctx) => {
  await runToday(ctx.askLine, ctx.rl, ctx.config);
});

register(["ask"], async (args, ctx) => {
  await runAsk(args, ctx);
});

register(["chat"], async (args, ctx) => {
  await runChat(args, ctx);
});

register(["voice"], async (args, ctx) => runVoice(args, ctx));

register(["explain", "e"], async (args, ctx) => {
  const result = ctx.sessionState.lastGrammarResult;
  if (!result || !ctx.sessionState.lastSubmittedText) {
    process.stdout.write(paint(colors.yellow, "  No recent grammar check to explain. Submit a sentence first.\n\n"));
    return;
  }

  const original = ctx.sessionState.lastSubmittedText;
  const corrected = result.correction || "No correction provided.";

  let diagnosesText = "No specific errors identified.";
  if (Array.isArray(result.diagnoses) && result.diagnoses.length > 0) {
    diagnosesText = result.diagnoses
      .map(d => `- ${d.error_type || d.type}: ${d.explanation}`)
      .join("\n");
  }

  const userQuestion = args.length > 0
    ? args.join(" ")
    : "Explain the corrections made to my last sentence.";

  const payload = `I recently submitted this sentence for a grammar check:
Original: "${original}"
Corrected: "${corrected}"

The following errors were identified:
${diagnosesText}

My question is: ${userQuestion}`;

  // Reset the ask session on the server before starting a new context-heavy thread
  try { await api.resetAsk(); } catch {}

  await runAsk([], ctx, {
    initialPayload: payload,
    initialDisplayQuery: userQuestion
  });
});

register(["translate", "tr"], async (args, ctx) => {
  const text = args.join(" ").trim();
  if (!text) {
    process.stdout.write(`${paint(colors.yellow, "Please enter text to translate.")}\n\n`);
    return;
  }
  await runTrans(text, ctx);
});

register(["exit", "quit", "q"], async (_args, ctx) => {
  if (ctx.stopUI) ctx.stopUI();
  process.stdout.write(process.platform === "win32" ? "\x1b[2J\x1b[0f" : "\x1b[2J\x1b[H");
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
