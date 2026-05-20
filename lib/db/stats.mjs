import { getDb } from "./connection.mjs";
import { getMastery } from "../domain/mastery.mjs";
import fs from "node:fs";
import path from "node:path";
import configLoader from "../shared/config-loader.mjs";
import { parseAssessmentReport, parseVocab } from "../domain/vault-parser.mjs";

export async function getStats() {
  const db = await getDb({ readonly: true });
  const config = configLoader.load();

  // Helper to get last N days as YYYY-MM-DD (local time)
  const getLastDays = (n) => {
    const days = [];
    for (let i = 0; i < n; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${day}`);
    }
    return days;
  };

  const dailyRows = db.prepare(`
    SELECT date(timestamp, 'localtime') as day, COUNT(*) as count 
    FROM inputs 
    WHERE timestamp > datetime('now', '-14 days')
    GROUP BY day
  `).all();

  const dayMap = Object.fromEntries(dailyRows.map(r => [r.day, r.count]));
  const dailyEffort = getLastDays(7).map(day => ({ day, count: dayMap[day] || 0 }));

  // Momentum calculation
  const last7Days = getLastDays(7);
  const prev7Days = getLastDays(14).slice(7);
  const currentWeekCount = last7Days.reduce((sum, day) => sum + (dayMap[day] || 0), 0);
  const prevWeekCount = prev7Days.reduce((sum, day) => sum + (dayMap[day] || 0), 0);
  const momentum = prevWeekCount === 0 ? (currentWeekCount > 0 ? 100 : 0) : Math.round(((currentWeekCount - prevWeekCount) / prevWeekCount) * 100);

  // Monthly Momentum
  const currentMonthCount = db.prepare("SELECT COUNT(*) as c FROM inputs WHERE timestamp > datetime('now', '-30 days')").get().c;
  const prevMonthCount = db.prepare("SELECT COUNT(*) as c FROM inputs WHERE timestamp BETWEEN datetime('now', '-60 days') AND datetime('now', '-30 days')").get().c;
  const monthlyMomentum = prevMonthCount === 0 ? (currentMonthCount > 0 ? 100 : 0) : Math.round(((currentMonthCount - prevMonthCount) / prevMonthCount) * 100);

  // Weekly Trend (Last 4 weeks)
  const weeklyRows = db.prepare(`
    SELECT strftime('%Y-%W', timestamp, 'localtime') as week, COUNT(*) as count 
    FROM inputs 
    WHERE timestamp > datetime('now', '-60 days')
    GROUP BY week
  `).all();
  
  const weeklyEffortFinal = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (i * 7));
    // Use SQLite to get the week key for this date to ensure perfect match
    const { key } = db.prepare("SELECT strftime('%Y-%W', ?, 'localtime') as key").get(d.toISOString());
    const row = weeklyRows.find(r => r.week === key);
    weeklyEffortFinal.push({ week: key, count: row ? row.count : 0 });
  }

  // Monthly Trend (Last 6 months)
  const monthlyRows = db.prepare(`
    SELECT strftime('%Y-%m', timestamp, 'localtime') as month, COUNT(*) as count 
    FROM inputs 
    WHERE timestamp > datetime('now', '-365 days')
    GROUP BY month
  `).all();
  
  const monthlyEffortFinal = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    // Use SQLite to get the month key for this date
    const { key } = db.prepare("SELECT strftime('%Y-%m', ?, 'localtime') as key").get(d.toISOString());
    const row = monthlyRows.find(r => r.month === key);
    monthlyEffortFinal.push({ month: key, count: row ? row.count : 0 });
  }

  // Combine DB and File assessments
  const dbAssessments = db.prepare(`
    SELECT date(timestamp, 'localtime') AS day, level FROM assessments
  `).all();

  const fileAssessments = [];
  try {
    const reportDir = config.ReportPath;
    if (reportDir && fs.existsSync(reportDir)) {
      const files = fs.readdirSync(reportDir).filter(f => f.startsWith("assessment_") && f.endsWith(".md"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(reportDir, file), "utf8");
        const parsed = parseAssessmentReport(content, file);
        if (parsed.level && parsed.date) {
          fileAssessments.push({ day: parsed.date, level: parsed.level });
        }
      }
    }
  } catch (e) {
    // Gracefully handle file errors
  }

  const allAssessments = [...dbAssessments, ...fileAssessments].sort((a, b) => a.day.localeCompare(b.day));
  
  // Group by month, take latest level
  const monthMap = {};
  for (const a of allAssessments) {
    const month = a.day.slice(0, 7); // YYYY-MM
    monthMap[month] = a.level;
  }

  const cefrTrajectory = Object.entries(monthMap)
    .map(([month, level]) => ({ month, level }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12);

  const priorities = db.prepare(`
    SELECT error_type, COUNT(*) as hits
    FROM diagnoses d
    JOIN inputs i ON i.id = d.input_id
    WHERE i.timestamp > datetime('now', '-30 days')
    GROUP BY error_type
    ORDER BY hits DESC
    LIMIT 3
  `).all();

  const { total_inputs } = db.prepare("SELECT COUNT(*) as total_inputs FROM inputs").get();
  const { total_diagnoses } = db.prepare("SELECT COUNT(*) as total_diagnoses FROM diagnoses").get();

  return {
    cefrTrajectory,
    dailyEffort,
    weeklyEffort: weeklyEffortFinal,
    monthlyEffort: monthlyEffortFinal,
    currentWeekCount,
    currentMonthCount,
    momentum,
    monthlyMomentum,
    priorities,
    totalInputs: total_inputs,
    totalDiagnoses: total_diagnoses,
  };
}

export async function getTodayEffort() {
  const db = await getDb({ readonly: true });

  const { inputs_today } = db.prepare(`
    SELECT COUNT(*) AS inputs_today FROM inputs
    WHERE date(timestamp, 'localtime') = date('now', 'localtime')
  `).get();

  const { errors_today } = db.prepare(`
    SELECT COUNT(*) AS errors_today FROM diagnoses d
    JOIN inputs i ON i.id = d.input_id
    WHERE date(i.timestamp, 'localtime') = date('now', 'localtime')
  `).get();

  const topErrors = db.prepare(`
    SELECT error_type, COUNT(*) AS hits FROM diagnoses d
    JOIN inputs i ON i.id = d.input_id
    WHERE date(i.timestamp, 'localtime') = date('now', 'localtime')
    GROUP BY error_type ORDER BY hits DESC LIMIT 3
  `).all();

  const { grammar_reviewed } = db.prepare(`
    SELECT COUNT(*) AS grammar_reviewed FROM srs_cards
    WHERE source_type = 'input'
    AND date(last_reviewed, 'localtime') = date('now', 'localtime')
  `).get();

  const { vocab_reviewed } = db.prepare(`
    SELECT COUNT(*) AS vocab_reviewed FROM srs_cards
    WHERE source_type = 'vocab'
    AND date(last_reviewed, 'localtime') = date('now', 'localtime')
  `).get();

  let vocab_added_today = 0;
  try {
    const config = configLoader.load();
    if (config.VocabularyPath && fs.existsSync(config.VocabularyPath)) {
      const content = fs.readFileSync(config.VocabularyPath, "utf8");
      vocab_added_today = parseVocab(content).addedToday;
    }
  } catch {}

  return { inputs_today, errors_today, topErrors, grammar_reviewed, vocab_reviewed, vocab_added_today };
}
