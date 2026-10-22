import { getReviewLearningData } from "../../db/review-stats.mjs";
import { beijingDate } from "../../shared/timezone.mjs";
import { getLearningPracticeAttempts } from "../practice/attempts.mjs";

function rows(days) {
  return getReviewLearningData(days).diagnoses;
}

export async function getErrorFrequency(days) {
  const grouped = new Map();
  for (const row of rows(days)) {
    const current = grouped.get(row.error_type) || {
      error_type: row.error_type,
      count: 0,
      severity: row.severity,
      major_count: 0,
      moderate_count: 0,
      minor_count: 0,
    };
    current.count += 1;
    if (row.severity === "Major") current.major_count += 1;
    if (row.severity === "Moderate") current.moderate_count += 1;
    if (row.severity === "Minor") current.minor_count += 1;
    grouped.set(row.error_type, current);
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count);
}

export function handbookWeek(timestamp) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return null;
  const day = new Date(`${beijingDate(new Date(time))}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}

export async function getTrendData(days) {
  const grouped = new Map();
  for (const row of rows(days)) {
    const week = handbookWeek(row.timestamp);
    if (week) grouped.set(week, (grouped.get(week) || 0) + 1);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([week, error_count]) => ({ week, error_count }));
}

export async function getTotalStats(days) {
  const data = getReviewLearningData(days);
  return { total_inputs: data.totalInputs, total_diagnoses: data.diagnoses.length };
}

export async function getExamples(errorType, limit = 3, days = 0) {
  const data = getReviewLearningData(days);
  return data.entries.flatMap((entry) => entry.diagnoses
    .filter((diagnosis) => diagnosis.error_type === errorType)
    .map((diagnosis) => ({
      original_text: entry.original_text,
      correction: entry.correction,
      refine: entry.refine,
      explanation: diagnosis.explanation,
      remember: Array.isArray(entry.remember) ? entry.remember.join("\n") : String(entry.remember || ""),
    }))).slice(0, limit);
}

export async function getLearningHistory(days) {
  return rows(days).map((row) => ({
    timestamp: row.timestamp,
    original_text: row.original_text,
    correction: row.correction,
    error_type: row.error_type,
    severity: row.severity,
    total_reviews: 0,
    correct_streak: 0,
  }));
}

export async function getLearningProfileData(days = 90, {
  loadReviews = getReviewLearningData,
  loadAttempts = getLearningPracticeAttempts,
} = {}) {
  const safeDays = Number.isInteger(days) && days >= 0 ? Math.min(days, 3650) : 90;
  const data = await loadReviews(safeDays);
  try {
    return { ...data, attempts: await loadAttempts({ days: safeDays }), practiceEvidenceStatus: "available" };
  } catch {
    // Saved corrections remain useful when the practice store cannot be read.
    return { ...data, attempts: [], practiceEvidenceStatus: "unavailable" };
  }
}

export async function getCoachEvidenceData(days) {
  const data = await getLearningProfileData(days);
  return {
    ...data,
    undiagnosedInputs: data.entries
      .filter((entry) => entry.diagnoses.length === 0)
      .map((entry) => ({ original_text: entry.original_text, timestamp: entry.timestamp })),
  };
}
