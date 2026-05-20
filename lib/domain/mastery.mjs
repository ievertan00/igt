/**
 * Mastery view: bucket each error_type into "frequent / occasional / rare / mastered"
 * based on its 30-day count. Computed on demand — no persistent storage. (A10)
 *
 * Buckets:
 *   last_30d == 0  → mastered
 *   last_30d <= 2  → rare
 *   last_30d <= 9  → occasional
 *   else           → frequent
 */

export const MASTERY_QUERY = `
  WITH error_counts AS (
    SELECT d.error_type,
      COUNT(*) FILTER (WHERE i.timestamp > datetime('now', '-30 days')) AS last_30d,
      COUNT(*) AS total_count
    FROM diagnoses d
    JOIN inputs i ON i.id = d.input_id
    GROUP BY d.error_type
  )
  SELECT error_type, last_30d, total_count,
    CASE
      WHEN last_30d = 0  THEN 'mastered'
      WHEN last_30d <= 2 THEN 'rare'
      WHEN last_30d <= 9 THEN 'occasional'
      ELSE 'frequent'
    END AS mastery
  FROM error_counts
  ORDER BY last_30d DESC, total_count DESC
`;

/**
 * Run the mastery query against an open better-sqlite3 DB.
 * @returns {Array<{error_type:string, last_30d:number, total_count:number, mastery:string}>}
 */
export function getMastery(db) {
  return db.prepare(MASTERY_QUERY).all();
}

export function bucketLabel(count) {
  if (count === 0) return "mastered";
  if (count <= 2) return "rare";
  if (count <= 9) return "occasional";
  return "frequent";
}
