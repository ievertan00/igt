import { colors, paint } from "../../cli/ui/index.mjs";
import { runGrammarCheck } from "../../cli/commands/grammar.mjs";
import { runTrans } from "../../cli/commands/translation.mjs";
import { renderModuleGuide } from "./catalog.mjs";

export async function runSentenceModule(args, ctx) {
  const action = (args[0] || "help").toLowerCase();
  if (action === "help" || action === "list") {
    process.stdout.write(`\n${renderModuleGuide("sentence")}\n\n`);
    return;
  }
  if (action === "translate" || action === "translation") {
    const text = args.slice(1).join(" ").trim();
    if (!text) {
      process.stdout.write(paint(colors.yellow, "Usage: /sentence translate <text>\n\n"));
      return;
    }
    await runTrans(text, ctx);
    return;
  }
  if (action !== "check") {
    process.stdout.write(paint(colors.yellow, "Usage: /sentence [check|translate]\n\n"));
    return;
  }
  const text = args.slice(1).join(" ").trim();
  if (!text) {
    process.stdout.write(paint(colors.yellow, "Usage: /sentence check <text>\n\n"));
    return;
  }
  await runGrammarCheck(text, ctx.sessionState?.lastTargetPath || "", ctx.grammarCtx);
}
