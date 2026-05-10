import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { colors, paint } from "../ui.mjs";
import { api } from "../api-client.mjs";
import { showHelp } from "./help.mjs";
import { runUndo } from "./undo.mjs";
import { runReview } from "./review.mjs";
import { runStats, runToday, showSessionSummary } from "./stats.mjs";
import { runGrammarCheck } from "./grammar.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");

function runNode(script, args, ctx) {
  return new Promise((resolve) => {
    if (ctx.rl) ctx.rl.pause();
    if (ctx.detachStdin) ctx.detachStdin();
    const child = spawn(process.execPath, [path.join(projectRoot, script), ...args], {
      stdio: "inherit", env: process.env,
    });
    ctx.setSigint(() => { child.kill(); ctx.setSigint(() => {}); });
    child.on("close", () => {
      ctx.setSigint(() => {});
      if (ctx.rl) ctx.rl.resume();
      if (ctx.attachStdin) ctx.attachStdin();
      resolve();
    });
  });
}

export async function handleCommand(raw, ctx) {
  const parts = raw.slice(1).trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  process.stdout.write("\n");
  switch (cmd) {
    case "help":
      showHelp();
      break;
    case "handbook":
    case "h":
      await runNode("tools/igt-handbook.mjs", [], ctx);
      process.stdout.write("\n");
      break;
    case "practice":
    case "p": {
      const m = args.join(" ").match(/^([A-Ca-c][12])\s+(\d+)$/);
      const nodeArgs = m ? [`--level=${m[1].toUpperCase()}`, `--count=${m[2]}`] : args;
      await runNode("tools/igt-practice.mjs", nodeArgs, ctx);
      process.stdout.write("\n");
      break;
    }
    case "assess":
    case "as":
      await runNode("tools/igt-assess.mjs", [], ctx);
      process.stdout.write("\n");
      break;
    case "add":
    case "a":
      if (!args.length) process.stdout.write(paint(colors.yellow, "Usage: /add <word or phrase>\n\n"));
      else await runNode("tools/igt-add.mjs", [args.join(" ")], ctx);
      break;
    case "vocab":
    case "v":
      if (args.includes("--list") || args.includes("list")) {
        await runNode("tools/igt-vocab.mjs", ["--list"], ctx);
        process.stdout.write("\n");
      } else {
        try {
          const seed = await api.seedVocab();
          if (seed.seeded > 0) {
            process.stdout.write(paint(colors.gray, `  Seeded ${seed.seeded} new word(s) into SRS deck.\n\n`));
          }
        } catch {}
        const n = parseInt(args[0], 10);
        await runReview(ctx.askLine, ctx.rl, Number.isFinite(n) ? n : 20, "vocab");
      }
      break;
    case "gemini":
    case "qwen":
    case "deepseek":
    case "ollama":
      await api.switchProvider(cmd);
      process.env.IGT_LLM_PROVIDER = cmd;
      ctx.refreshUI();
      process.stdout.write(paint(colors.gray, `Switched to ${cmd}\n`));
      break;
    case "phi": {
      const model = ctx.config.OllamaPhiModel || "phi4";
      await api.switchModel("ollama", model);
      process.env.IGT_LLM_PROVIDER = "ollama";
      ctx.config.OllamaModel = model;
      ctx.refreshUI();
      process.stdout.write(paint(colors.gray, `Switched to local Phi-4 (Ollama: ${model})\n`));
      break;
    }
    case "gemma": {
      const model = ctx.config.OllamaGemmaModel || "gemma4:e4b";
      await api.switchModel("ollama", model);
      process.env.IGT_LLM_PROVIDER = "ollama";
      ctx.config.OllamaModel = model;
      ctx.refreshUI();
      process.stdout.write(paint(colors.gray, `Switched to local Gemma 4 (Ollama: ${model})\n`));
      break;
    }
    case "llm":
      await runNode("lib/llm/switch.mjs", args, ctx);
      process.stdout.write("\n");
      break;
    case "undo":
    case "u":
      await runUndo(ctx.askLine, ctx.rl, args[0] ? parseInt(args[0], 10) : 1, ctx.refreshStats);
      break;
    case "review":
    case "r":
      await runReview(ctx.askLine, ctx.rl, args[0] ? parseInt(args[0], 10) : 10);
      break;
    case "stats":
    case "st":
      await runStats();
      break;
    case "today":
      await runToday(ctx.askLine, ctx.rl);
      break;
    case "retry":
      if (!ctx.sessionState.lastSubmittedText) {
        process.stdout.write(paint(colors.yellow, "Nothing to retry yet.\n\n"));
      } else {
        await runGrammarCheck(ctx.sessionState.lastSubmittedText, ctx.sessionState.lastTargetPath, ctx.grammarCtx);
      }
      break;
    case "exit":
    case "quit":
    case "q":
      await showSessionSummary(ctx.sessionState.sessionSentenceCount);
      ctx.rl.close();
      process.exit(0);
      break;
    default:
      process.stdout.write(paint(colors.yellow, `Unknown command /${cmd} — type /help for a list.\n`));
  }
}
