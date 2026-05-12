import { colors, paint, renderBarChart, renderSparkline, renderLineChart } from "../ui.mjs";
import { api } from "../api-client.mjs";
import { runReview } from "./review.mjs";
import fs from "node:fs";
import configLoader from "../config-loader.mjs";
import { parseVocab, parsePractice } from "../vault-parser.mjs";

export async function runStats() {
  let data;
  try { data = await api.getStats(); }
  catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
    return;
  }
  const config = configLoader.getConfig();
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

  if (data.cefrTrajectory && data.cefrTrajectory.length) {
    const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    process.stdout.write(`  ${paint(colors.yellow, "[ CEFR Trajectory: Monthly ]")}\n`);
    for (const row of [...data.cefrTrajectory].reverse()) {
      const idx = levels.indexOf(row.level);
      const bar = paint(colors.green, "█".repeat(Math.max(1, (idx + 1) * 3)));
      process.stdout.write(`  ${paint(colors.gray, row.month)}  ${bar} ${paint(colors.white, row.level)}\n`);
    }
    process.stdout.write("\n");
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

export async function runToday(askLine, rl) {
  let stats, due, effort;
  try {
    [stats, due, effort] = await Promise.all([
      api.getStats(),
      api.getDue({ limit: 100, type: "grammar" }),
      api.getTodayEffort(),
    ]);
  } catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
    return;
  }

  const sep = "─".repeat(44);
  const LABEL = 16;

  // ── Today's Effort ──────────────────────────────────────────
  process.stdout.write(`\n  ${paint(colors.cyan, "[ Today's Effort ]")}\n`);
  process.stdout.write(`  ${paint(colors.gray, sep)}\n`);
  if (effort.inputs_today === 0) {
    process.stdout.write(`  ${paint(colors.gray, "No sentences checked yet today.")}\n`);
  } else {
    const errPerSent = (effort.errors_today / effort.inputs_today).toFixed(1);
    process.stdout.write(`  ${paint(colors.gray, "Sentences".padEnd(LABEL))}${paint(colors.white, String(effort.inputs_today))}\n`);
    process.stdout.write(`  ${paint(colors.gray, "Vocabulary".padEnd(LABEL))}${paint(colors.white, String(effort.vocab_added_today))}  ${paint(colors.gray, "added today")}\n`);
    process.stdout.write(`  ${paint(colors.gray, "Errors".padEnd(LABEL))}${paint(colors.white, String(effort.errors_today))}  ${paint(colors.gray, `(${errPerSent}/sent)`)}\n`);
    if (effort.topErrors.length > 0) {
      const errorStr = effort.topErrors.map(e => e.error_type.split(" / ").pop()).join(" · ");
      process.stdout.write(`  ${paint(colors.gray, "Focus".padEnd(LABEL))}${paint(colors.cyan, errorStr)}\n`);
    }
    const reviewed = [
      effort.grammar_reviewed > 0 ? `${effort.grammar_reviewed} grammar` : null,
      effort.vocab_reviewed > 0 ? `${effort.vocab_reviewed} vocab` : null,
    ].filter(Boolean).join(" · ");
    if (reviewed) {
      process.stdout.write(`  ${paint(colors.gray, "SRS reviewed".padEnd(LABEL))}${paint(colors.white, reviewed)}\n`);
    }
  }
  process.stdout.write(`  ${paint(colors.gray, sep)}\n\n`);

  // ── Today's Plan ─────────────────────────────────────────────
  const dueCount = due.cards?.length || 0;
  const focusType = stats.priorities?.[0]?.error_type?.split(" / ").pop() || null;
  process.stdout.write(`  ${paint(colors.yellow, "TODAY'S PLAN")}  ${paint(colors.gray, "(estimated 10 min)")}\n`);
  process.stdout.write(`  ${paint(colors.gray, sep)}\n`);
  const reviewMin = Math.max(2, Math.round(dueCount * 0.6));
  process.stdout.write(`  ${paint(colors.gray, "1.")} ${paint(colors.white, "SRS reviews   ")}${paint(colors.cyan, `${dueCount} card(s) due`)}  ${paint(colors.gray, `(~${reviewMin} min)`)}  /review\n`);
  process.stdout.write(`  ${paint(colors.gray, "2.")} ${paint(colors.white, "Free practice ")}${paint(colors.cyan, "1 paragraph")}  ${paint(colors.gray, "(~4 min)")}  /practice --count=1\n`);
  if (focusType) {
    process.stdout.write(`  ${paint(colors.gray, sep)}\n`);
    process.stdout.write(`  ${paint(colors.gray, "Focus: ")}${paint(colors.magenta, focusType)}  ${paint(colors.gray, "(30-day top error)")}\n`);
  }
  process.stdout.write(`  ${paint(colors.gray, sep)}\n\n`);

  if (dueCount > 0) {
    const go = await askLine(rl, paint(colors.gray, "  Start SRS review now? (Y/n): "));
    if (go === null || /^n/i.test(go.trim())) return;
    process.stdout.write(paint(colors.gray, "\nSRS Review: Drill your grammar mistakes to build muscle memory.\n"));
    process.stdout.write(paint(colors.gray, "Guidance: Read the context, guess the correction, then press [Enter] to verify.\n\n"));
    await runReview(askLine, rl, 10, "grammar");
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
