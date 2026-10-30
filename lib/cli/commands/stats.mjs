import { runOverview } from "./learning.mjs";
import { colors, paint } from "../ui/index.mjs";
import { api } from "../api-client.mjs";
import { runReview } from "./review.mjs";

export async function runStats(args = []) {
  return runOverview(args);
}
export async function runToday(askLine, rl, config = null) {
  let stats, effort;
  try {
    [stats, effort] = await Promise.all([api.getStats(), api.getTodayEffort()]);
  } catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
    return;
  }

  const sep = "─".repeat(44);
  process.stdout.write("\n  " + paint(colors.cyan, "Today's learning") + "\n");
  process.stdout.write("  " + paint(colors.gray, sep) + "\n");
  process.stdout.write(`  Sentences checked: ${effort.inputs_today} · Words added: ${effort.vocab_added_today}\n`);
  process.stdout.write(`  Cards reviewed: ${effort.grammar_reviewed} grammar · ${effort.vocab_reviewed} vocabulary\n\n`);

  const vocabDue = stats.dueCounts?.vocab;
  const dueLabel = (count) => Number.isInteger(count) ? `${count} due` : "check with the review command";
  const focusType = stats.priorities?.[0]?.error_type?.split(" / ").pop();
  process.stdout.write("  " + paint(colors.yellow, "Choose a short practice session") + "\n");
  process.stdout.write(`  Vocabulary  ${dueLabel(vocabDue)} — /word 5 (also imports newly saved words)\n`);
  process.stdout.write("  Listen      Repeat an English expression after a correction, translation, or word lookup.\n");
  process.stdout.write("              Repeat aloud, then use the expression in your own sentence.\n");
  process.stdout.write("  Express     Write a short daily update or work message at the main prompt.\n");
  process.stdout.write("              Use one saved expression; /explain explores the feedback.\n");
  process.stdout.write("  Converse    /chat — try clarifying a request or giving a work update.\n");
  if (focusType) {
    process.stdout.write(`\n  Recent focus: ${focusType}\n`);
    process.stdout.write("  /practice for fresh grammar drills, or /word for vocabulary review.\n");
  } else {
    process.stdout.write("\n  Start with your own sentences; recorded mistakes will guide future quizzes.\n");
  }
  if (!stats.dueCounts) {
    process.stdout.write(paint(colors.gray, "  Restart IGT to load review counts from the updated server.\n"));
  }
  process.stdout.write("  " + paint(colors.gray, sep) + "\n");

  if (vocabDue > 0) {
    const choice = await askLine(rl, paint(colors.gray, "  Start [w] vocabulary / [Enter] later: "));
    if (choice === null) return;
    const type = choice.trim().toLowerCase();
    if (type === "w") {
      try { await api.seedVocab(); }
      catch (e) {
        process.stdout.write(paint(colors.yellow, `Could not import saved words: ${e.message}\n`));
      }
      await runReview(askLine, rl, 5, config);
    }
  }
}
