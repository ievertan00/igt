import { colors, paint, renderBarChart, renderSparkline, renderLineChart } from "../ui/index.mjs";
import { api } from "../api-client.mjs";
import { runReview } from "./review.mjs";
import fs from "node:fs";
import configLoader from "../../shared/config-loader.mjs";
import { parseVocab, parsePractice } from "../../domain/vault-parser.mjs";

export async function runStats() {
  let data;
  try { data = await api.getStats(); }
  catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
    return;
  }
  const config = configLoader.load();
  const W = Math.min(72, Math.max(40, (process.stdout.columns || 80) - 4));
  process.stdout.write("\n");

  if (data.dailyEffort) {
    process.stdout.write(`  ${paint(colors.magenta, "[ Effort Trend: Last 7 Days ]")}\n\n`);
    const dailyValues = [...data.dailyEffort].reverse().map(d => d.count);
    const dailyLabels = [...data.dailyEffort].reverse().map(d => d.day.split("-").pop());
    renderLineChart(dailyValues, dailyLabels, { color: colors.cyan });

    const getMessage = (m, count) => {
      if (m > 20) return paint(colors.green, "Exceptional momentum! You're accelerating.");
      if (m > 0) return paint(colors.green, "Great progress! Your consistency is paying off.");
      if (m === 0 && count > 0) return paint(colors.yellow, "Solid stability. Keep up the rhythm.");
      if (m > -20 && count > 0) return paint(colors.yellow, "A bit quieter than usual. Stay the course.");
      if (count > 0) return paint(colors.red, "Significant dip in activity. Time to re-engage?");
      return paint(colors.red, "No activity recorded. Start your first session today!");
    };

    const momSign = data.momentum >= 0 ? "+" : "";
    process.stdout.write(`  Weekly:  ${paint(colors.white, String(data.currentWeekCount).padStart(3))} inputs (${paint(data.momentum >= 0 ? colors.green : colors.red, `${momSign}${data.momentum}%`)}) vs last week. ${getMessage(data.momentum, data.currentWeekCount)}\n`);
    
    const monthMomSign = data.monthlyMomentum >= 0 ? "+" : "";
    process.stdout.write(`  Monthly: ${paint(colors.white, String(data.currentMonthCount).padStart(3))} inputs (${paint(data.monthlyMomentum >= 0 ? colors.green : colors.red, `${monthMomSign}${data.monthlyMomentum}%`)}) vs last month. ${getMessage(data.monthlyMomentum, data.currentMonthCount)}\n\n`);
  }

  // Top 3 Priorities
  if (data.priorities && data.priorities.length) {
    process.stdout.write(`  ${paint(colors.yellow, "[ Top 3 Priorities ]")}\n`);
    data.priorities.forEach((p, i) => {
      const shortType = p.error_type.split(" / ").pop();
      process.stdout.write(`  ${i + 1}. ${shortType} (${p.hits} hits)\n`);
      process.stdout.write(`     Fix: ${paint(colors.gray, `/practice --type "${shortType}"`)}\n`);
    });
    process.stdout.write("\n");
  }

  // Vault Snapshot
  process.stdout.write(`  ${paint(colors.cyan, "[ Vault Snapshot ]")}\n`);
  let vocabStats = { total: "N/A", addedThisWeek: 0 };
  let practiceStats = { avgScore: "N/A" };

  try {
    if (config.VocabularyPath && fs.existsSync(config.VocabularyPath)) {
      const content = fs.readFileSync(config.VocabularyPath, "utf8");
      vocabStats = parseVocab(content);
    }
    if (config.PracticePath && fs.existsSync(config.PracticePath)) {
      const content = fs.readFileSync(config.PracticePath, "utf8");
      practiceStats = parsePractice(content);
    }
  } catch (err) {
    // Graceful fallback already initialized
  }

  process.stdout.write(`  Vocab:    ${vocabStats.total} words (+${vocabStats.addedThisWeek} this week)\n`);
  process.stdout.write(`  Practice: ${practiceStats.avgScore}${practiceStats.avgScore !== "N/A" ? "%" : ""} avg (last 5 sessions)\n\n`);
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

  const grammarDue = stats.dueCounts?.grammar;
  const vocabDue = stats.dueCounts?.vocab;
  const dueLabel = (count) => Number.isInteger(count) ? `${count} due` : "check with the review command";
  const focusType = stats.priorities?.[0]?.error_type?.split(" / ").pop();
  process.stdout.write("  " + paint(colors.yellow, "Choose a short practice session") + "\n");
  process.stdout.write(`  Grammar     ${dueLabel(grammarDue)} — /review 5\n`);
  process.stdout.write(`  Vocabulary  ${dueLabel(vocabDue)} — /word 5 (also imports newly saved words)\n`);
  process.stdout.write("  Listen      /listen after a correction, translation, or word lookup.\n");
  process.stdout.write("              Repeat aloud, then use the expression in your own sentence.\n");
  process.stdout.write("  Express     Write a short daily update or work message at the main prompt.\n");
  process.stdout.write("              Use one saved expression; /explain explores the feedback.\n");
  process.stdout.write("  Converse    /chat — try clarifying a request or giving a work update.\n");
  if (focusType) {
    process.stdout.write(`\n  Recent focus: ${focusType}\n`);
    process.stdout.write("  /quiz 3 for fresh Chinese-to-English prompts, or /practice for grammar drills.\n");
  } else {
    process.stdout.write("\n  Start with your own sentences; recorded mistakes will guide future quizzes.\n");
  }
  if (!stats.dueCounts) {
    process.stdout.write(paint(colors.gray, "  Restart IGT to load review counts from the updated server.\n"));
  }
  process.stdout.write("  " + paint(colors.gray, sep) + "\n");

  if (grammarDue > 0 || vocabDue > 0) {
    const choice = await askLine(rl, paint(colors.gray, "  Start [g] grammar / [w] vocabulary / [Enter] later: "));
    if (choice === null) return;
    const type = choice.trim().toLowerCase();
    if (type === "g") await runReview(askLine, rl, 5, "grammar", config);
    if (type === "w") {
      try { await api.seedVocab(); }
      catch (e) {
        process.stdout.write(paint(colors.yellow, `Could not import saved words: ${e.message}\n`));
      }
      await runReview(askLine, rl, 5, "vocab", config);
    }
  }
}


export async function showSessionSummary(sessionSentenceCount) {
  if (sessionSentenceCount === 0) return;
  let s;
  try { s = await api.getSessionSummary(); } catch { return; }
  if (!s || s.no_session) return;
  const errPerSent = s.total_inputs > 0 ? (s.total_errors / s.total_inputs).toFixed(1) : "0";
  const avg7 = s.avg_errors_7day.toFixed(1);
  const trend = s.total_inputs > 0 && s.avg_errors_7day > 0
    ? parseFloat(errPerSent) < parseFloat(avg7)
      ? paint(colors.green, " ↑ improving")
      : paint(colors.yellow, " → stable")
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
