import { getDb } from "../db/connection.mjs";

export async function getErrorFrequency(days) {
  const db = await getDb({ readonly: true });
  const dateFilter = days > 0 ? `AND i.timestamp >= datetime('now', '-${days} days')` : "";
  return db.prepare(`
    SELECT
      d.error_type,
      COUNT(*) as count,
      d.severity,
      COUNT(CASE WHEN d.severity = 'Major' THEN 1 END) as major_count,
      COUNT(CASE WHEN d.severity = 'Moderate' THEN 1 END) as moderate_count,
      COUNT(CASE WHEN d.severity = 'Minor' THEN 1 END) as minor_count
    FROM diagnoses d
    JOIN inputs i ON d.input_id = i.id
    WHERE 1=1 ${dateFilter}
    GROUP BY d.error_type
    ORDER BY count DESC
  `).all();
}

export async function getTrendData(days) {
  const db = await getDb({ readonly: true });
  const dateFilter = days > 0 ? `AND i.timestamp >= datetime('now', '-${days} days')` : "";
  return db.prepare(`
    SELECT strftime('%Y-%W', i.timestamp) as week, COUNT(*) as error_count
    FROM diagnoses d JOIN inputs i ON d.input_id = i.id
    WHERE 1=1 ${dateFilter}
    GROUP BY week ORDER BY week
  `).all();
}

export async function getTotalStats(days) {
  const db = await getDb({ readonly: true });
  const dateFilter = days > 0 ? `AND i.timestamp >= datetime('now', '-${days} days')` : "";
  return db.prepare(`
    SELECT
      COUNT(DISTINCT i.id) as total_inputs,
      COUNT(d.id) as total_diagnoses
    FROM inputs i LEFT JOIN diagnoses d ON d.input_id = i.id
    WHERE 1=1 ${dateFilter}
  `).get();
}

export async function getExamples(errorType, limit = 3) {
  const db = await getDb({ readonly: true });
  return db.prepare(`
    SELECT i.original_text, i.correction, i.refine, d.explanation, a.rule, a.tip
    FROM inputs i
    JOIN diagnoses d ON i.id = d.input_id
    LEFT JOIN advice a ON i.id = a.input_id
    WHERE d.error_type = ?
    ORDER BY i.timestamp DESC LIMIT ?
  `).all(errorType, limit);
}
