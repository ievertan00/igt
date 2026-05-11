import { colors, paint, renderBarChart, renderSparkline } from "../ui.mjs";
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
    const dailyItems = [...data.dailyEffort].reverse().map(d => ({ 
      label: d.day.split("-").slice(1).join("/"), 
      value: d.count 
    }));
    renderBarChart(dailyItems, { color: colors.cyan, maxWidth: W });

    const sparkDaily = renderSparkline([...data.dailyEffort].reverse().map(d => d.count));
    const sparkWeekly = renderSparkline([...data.weeklyEffort].reverse().map(w => w.count));
    const sparkMonthly = renderSparkline([...data.monthlyEffort].reverse().map(m => m.count));

    process.stdout.write(`  Daily (7d):   ${sparkDaily}\n`);
    process.stdout.write(`  Weekly (4w):  ${sparkWeekly}\n`);
    process.stdout.write(`  Monthly (6m): ${sparkMonthly}\n\n`);

    const momColor = data.momentum >= 0 ? colors.green : colors.red;
    const momSign = data.momentum >= 0 ? "+" : "";
    const totalCurrentWeek = data.dailyEffort.reduce((sum, d) => sum + d.count, 0);
    process.stdout.write(`  Weekly Momentum: ${paint(momColor, momSign + data.momentum + "%")}  ${paint(colors.gray, `(${totalCurrentWeek} inputs)`)}\n\n`);
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

  if (data.byLength && data.byLength.length) {
    renderBarChart(
      data.byLength.map((r) => ({ label: `${r.bucket} words`, value: parseFloat(r.avg_errors.toFixed(2)) })),
      { title: "Errors / input  by sentence length", color: colors.magenta, maxWidth: W },
    );
  }
  if (data.cefrTrajectory && data.cefrTrajectory.length) {
    const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    process.stdout.write(`${paint(colors.yellow, "CEFR trajectory")}\n`);
    for (const row of data.cefrTrajectory) {
      const idx = levels.indexOf(row.level);
      const bar = paint(colors.green, "█".repeat(Math.max(1, idx * 3 + 1)));
      process.stdout.write(`${paint(colors.gray, row.day)}  ${bar} ${paint(colors.white, row.level)}\n`);
    }
    process.stdout.write("\n");
  }
  if (data.mastery && data.mastery.length) {
    const byCat = { frequent: [], occasional: [], rare: [], mastered: [] };
    for (const r of data.mastery) (byCat[r.mastery] || []).push(r.error_type.split(" / ").pop());
    const catColor = { frequent: colors.red, occasional: colors.yellow, rare: colors.cyan, mastered: colors.green };
    process.stdout.write(`${paint(colors.yellow, "Mastery  (30-day window)")}\n`);
    for (const [cat, items] of Object.entries(byCat)) {
      const label = paint(catColor[cat], cat.padEnd(11));
      const countStr = paint(colors.gray, `${String(items.length).padStart(2)} type${items.length !== 1 ? "s" : " "}`);
      if (items.length === 0) continue;
      if (cat === "frequent" || cat === "occasional") {
        process.stdout.write(`${label}  ${countStr}\n`);
        const shown = items.slice(0, 5);
        for (const item of shown) {
          process.stdout.write(`             ${paint(colors.gray, "· ")}${paint(colors.white, item)}\n`);
        }
        if (items.length > 5) {
          process.stdout.write(`             ${paint(colors.gray, `· … +${items.length - 5} more`)}\n`);
        }
      } else {
        const preview = items.slice(0, 4).join("  ·  ");
        const more = items.length > 4 ? paint(colors.gray, `  +${items.length - 4} more`) : "";
        process.stdout.write(`${label}  ${countStr}   ${paint(colors.gray, preview)}${more}\n`);
      }
    }
    process.stdout.write("\n");
  }
}

export async function runToday(askLine, rl) {
  let stats, due;
  try {
    [stats, due] = await Promise.all([api.getStats(), api.getDue({ limit: 100 })]);
  } catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
    return;
  }
  const dueCount = due.cards?.length || 0;
  const clozeDrillCount = Math.min(3, dueCount);
  const focusType = stats.mastery?.find((r) => r.mastery === "frequent")?.error_type?.split(" / ").pop() || null;
  const sep = "─".repeat(44);
  process.stdout.write(`\n  ${paint(colors.yellow, "TODAY'S PLAN")}  ${paint(colors.gray, "(estimated 10 min)")}\n`);
  process.stdout.write(`${paint(colors.gray, sep)}\n`);
  const reviewMin = Math.max(2, Math.round(dueCount * 0.6));
  process.stdout.write(`${paint(colors.gray, "1.")} ${paint(colors.white, "SRS reviews   ")}${paint(colors.cyan, `${dueCount} card(s) due`)}  ${paint(colors.gray, `(~${reviewMin} min)`)}  /review\n`);
  process.stdout.write(`${paint(colors.gray, "2.")} ${paint(colors.white, "Cloze drill   ")}${paint(colors.cyan, `${clozeDrillCount} card(s)`)}  ${paint(colors.gray, "(~3 min)")}  /review --count=${clozeDrillCount}\n`);
  process.stdout.write(`${paint(colors.gray, "3.")} ${paint(colors.white, "Free practice ")}${paint(colors.cyan, "1 paragraph")}  ${paint(colors.gray, "(~4 min)")}  /practice --count=1\n`);
  if (focusType) {
    process.stdout.write(`${paint(colors.gray, sep)}\n`);
    process.stdout.write(`${paint(colors.gray, "Focus: ")}${paint(colors.magenta, focusType)}  ${paint(colors.gray, "(most frequent error — target it today)")}\n`);
  }
  process.stdout.write(`${paint(colors.gray, sep)}\n\n`);
  if (dueCount > 0) {
    const go = await askLine(rl, paint(colors.gray, "  Start SRS review now? (Y/n): "));
    if (go === null || /^n/i.test(go.trim())) return;
    await runReview(askLine, rl, 10);
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
