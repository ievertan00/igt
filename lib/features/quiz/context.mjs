import { getDb } from "../../db/connection.mjs";

export async function getQuizRecords(days = 30, limit = 24) {
  const db = await getDb({ readonly: true });
  const safeDays = Number.isInteger(days) && days >= 0 ? days : 30;
  const safeLimit = Math.min(50, Math.max(1, Number.isInteger(limit) ? limit : 24));
  const modifier = `-${safeDays} days`;

  return db.prepare(`
    WITH filtered AS (
      SELECT
        i.timestamp,
        i.original_text,
        i.correction,
        d.error_type,
        d.severity,
        d.explanation,
        a.rule,
        a.tip
      FROM diagnoses d
      JOIN inputs i ON i.id = d.input_id
      LEFT JOIN advice a ON a.input_id = i.id
      WHERE ? = 0 OR i.timestamp >= datetime('now', ?)
    )
    SELECT
      original_text,
      correction,
      error_type,
      severity,
      explanation,
      rule,
      tip,
      COUNT(*) OVER (PARTITION BY error_type) AS recurrence
    FROM filtered
    WHERE correction IS NOT NULL AND trim(correction) <> ''
    ORDER BY recurrence DESC,
      CASE severity WHEN 'Major' THEN 3 WHEN 'Moderate' THEN 2 ELSE 1 END DESC,
      timestamp DESC
    LIMIT ?
  `).all(safeDays, modifier, safeLimit);
}
