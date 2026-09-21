import fs from "node:fs";
import configLoader from "../shared/config-loader.mjs";
import { readReviewLog } from "./review-log.mjs";

function timestampMs(value) {
  const raw = String(value || "");
  const parsed = Date.parse(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function entriesInWindow(days, now = Date.now()) {
  const config = configLoader.load();
  const entries = readReviewLog(config.ReviewPath || "00_Review_logs.md");
  if (!days || days <= 0) return entries;
  const cutoff = now - days * 86400000;
  return entries.filter((entry) => {
    const time = timestampMs(entry.timestamp);
    return time !== null && time >= cutoff;
  });
}

function flattenDiagnoses(entries) {
  return entries.flatMap((entry) => entry.diagnoses.map((diagnosis) => ({
    ...diagnosis,
    input_id: entry.entryId,
    timestamp: entry.timestamp,
    original_text: entry.original_text,
    correction: entry.correction,
    refine: entry.refine,
    session_id: null,
    total_reviews: 0,
    correct_streak: 0,
  })));
}

function dayKey(timestamp) {
  const time = timestampMs(timestamp);
  return time === null ? null : new Date(time).toISOString().slice(0, 10);
}

function weekKey(timestamp) {
  const day = dayKey(timestamp);
  return day ? day.slice(0, 7) : null;
}

export function getReviewLearningData(days = 0) {
  const entries = entriesInWindow(days);
  return { entries, diagnoses: flattenDiagnoses(entries), totalInputs: entries.length, attempts: [], resourceChecks: [] };
}

export function getReviewStats(days = 0, now = Date.now()) {
  const entries = entriesInWindow(days, now);
  const diagnoses = flattenDiagnoses(entries);
  const countBy = (keyFn) => {
    const map = new Map();
    for (const entry of entries) {
      const key = keyFn(entry.timestamp);
      if (key) map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  };
  const today = new Date(now).toISOString().slice(0, 10);
  const dailyMap = countBy(dayKey);
  const dailyEffort = [...Array(7)].map((_, index) => {
    const date = new Date(now - index * 86400000).toISOString().slice(0, 10);
    return { day: date, count: dailyMap.get(date) || 0 };
  });
  const currentWeekCount = dailyEffort.reduce((sum, row) => sum + row.count, 0);
  const previousWeekEntries = entriesInWindow(14, now).filter((entry) => {
    const time = timestampMs(entry.timestamp);
    return time !== null && time < now - 7 * 86400000;
  });
  const previousWeekCount = previousWeekEntries.length;
  const monthlyEntries = entriesInWindow(30, now).length;
  const previousMonthEntries = entriesInWindow(60, now).filter((entry) => {
    const time = timestampMs(entry.timestamp);
    return time !== null && time < now - 30 * 86400000;
  }).length;
  const momentum = previousWeekCount === 0 ? (currentWeekCount > 0 ? 100 : 0) : Math.round(((currentWeekCount - previousWeekCount) / previousWeekCount) * 100);
  const monthlyMomentum = previousMonthEntries === 0 ? (monthlyEntries > 0 ? 100 : 0) : Math.round(((monthlyEntries - previousMonthEntries) / previousMonthEntries) * 100);
  const priorityMap = new Map();
  for (const diagnosis of diagnoses) priorityMap.set(diagnosis.error_type, (priorityMap.get(diagnosis.error_type) || 0) + 1);
  const priorities = [...priorityMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([error_type, hits]) => ({ error_type, hits }));
  const weeklyMap = countBy(weekKey);
  const weeklyEffort = [...weeklyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-4).map(([week, count]) => ({ week, count }));
  return {
    dailyEffort,
    weeklyEffort,
    monthlyEffort: [],
    currentWeekCount,
    currentMonthCount: monthlyEntries,
    momentum,
    monthlyMomentum,
    priorities,
    totalInputs: entries.length,
    totalDiagnoses: diagnoses.length,
    inputsToday: entries.filter((entry) => dayKey(entry.timestamp) === today).length,
    errorsToday: diagnoses.filter((diagnosis) => dayKey(diagnosis.timestamp) === today).length,
    topErrorsToday: priorities,
  };
}

export function reviewLogExists() {
  const config = configLoader.load();
  return fs.existsSync(config.ReviewPath || "00_Review_logs.md");
}
