import configLoader from "../../shared/config-loader.mjs";
import { readReviewLog } from "../../db/review-log.mjs";

function timestampMs(value) {
  const raw = String(value || "");
  const parsed = Date.parse(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getQuizRecords(days = 30, limit = 24) {
  const safeDays = Number.isInteger(days) && days >= 0 ? days : 30;
  const safeLimit = Math.min(50, Math.max(1, Number.isInteger(limit) ? limit : 24));
  const entries = readReviewLog(configLoader.load().ReviewPath || "00_Review_logs.md");
  const cutoff = safeDays > 0 ? Date.now() - safeDays * 86400000 : null;
  const records = entries
    .filter((entry) => {
      const time = timestampMs(entry.timestamp);
      return cutoff === null || (time !== null && time >= cutoff);
    })
    .flatMap((entry) => entry.diagnoses.map((diagnosis) => ({
      original_text: entry.original_text,
      correction: entry.correction,
      error_type: diagnosis.error_type,
      severity: diagnosis.severity,
      explanation: diagnosis.explanation,
      rule: entry.remember,
      tip: diagnosis.suggestion,
      timestamp: entry.timestamp,
    })))
    .filter((record) => record.correction && record.correction.trim())
    .sort((a, b) => (timestampMs(b.timestamp) || 0) - (timestampMs(a.timestamp) || 0));

  const recurrence = new Map();
  for (const record of records) recurrence.set(record.error_type, (recurrence.get(record.error_type) || 0) + 1);
  return records
    .map((record) => ({ ...record, recurrence: recurrence.get(record.error_type) || 1 }))
    .sort((a, b) => b.recurrence - a.recurrence || (timestampMs(b.timestamp) || 0) - (timestampMs(a.timestamp) || 0))
    .slice(0, safeLimit);
}
