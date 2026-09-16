import { colors, paint } from "../../cli/ui/index.mjs";
import { runGrammarCheck } from "../../cli/commands/grammar.mjs";
import { runTrans } from "../../cli/commands/translation.mjs";
import { renderModuleGuide } from "./catalog.mjs";

export async function collectText(ctx, initial = "") {
  const lines = initial ? [initial] : [];
  process.stdout.write(paint(colors.gray, "Enter text one line at a time. Submit a blank line when finished.\n"));
  while (true) {
    const line = await ctx.askLine(ctx.rl, paint(colors.cyan, lines.length ? "  + " : "  > "));
    if (line === null || !line.trim()) break;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

export async function runTextModule(args, ctx) {
  const action = (args[0] || "help").toLowerCase();
  if (action === "help" || action === "list") {
    process.stdout.write(`\n${renderModuleGuide("text")}\n\n`);
    return;
  }
  if (!["check", "translate", "translation"].includes(action)) {
    process.stdout.write(paint(colors.yellow, "Usage: /text [check|translate]\n\n"));
    return;
  }

  const initial = args.slice(1).join(" ").trim();
  const text = await collectText(ctx, initial);
  if (!text) {
    process.stdout.write(paint(colors.yellow, "No text submitted.\n\n"));
    return;
  }
  if (action === "check") {
    await runGrammarCheck(text, ctx.sessionState?.lastTargetPath || "", ctx.grammarCtx);
  } else {
    await runTrans(text, ctx);
  }
}
