import { getDb } from "../../db/connection.mjs";

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

export async function getLearningHistory(days) {
  const db = await getDb({ readonly: true });
  const dateFilter = days > 0 ? `AND i.timestamp >= datetime('now', '-${days} days')` : "";
  return db.prepare(`
    SELECT i.timestamp, i.original_text, i.correction,
      d.error_type, d.severity,
      COALESCE((SELECT SUM(c.total_reviews) FROM srs_cards c
        WHERE c.source_type = 'input' AND c.source_id = i.id), 0) AS total_reviews,
      COALESCE((SELECT SUM(c.correct_streak) FROM srs_cards c
        WHERE c.source_type = 'input' AND c.source_id = i.id), 0) AS correct_streak
    FROM diagnoses d
    JOIN inputs i ON i.id = d.input_id
    WHERE 1=1 ${dateFilter}
    ORDER BY i.timestamp DESC
  `).all();
}

export async function getLearningProfileData(days) {
  const db = await getDb({ readonly: true });
  const dateFilter = days > 0 ? `AND timestamp >= datetime('now', '-${days} days')` : "";
  const totalInputs = db.prepare(`
    SELECT COUNT(*) AS count FROM inputs WHERE 1=1 ${dateFilter.replaceAll("timestamp", "inputs.timestamp")}
  `).get().count;
  const diagnoses = db.prepare(`
    SELECT i.id AS input_id, i.session_id, i.timestamp, i.original_text, i.correction,
      i.context_label, i.context_confidence, i.context_source,
      d.error_type, d.severity, d.explanation
    FROM diagnoses d
    JOIN inputs i ON d.input_id = i.id
    WHERE 1=1 ${days > 0 ? `AND i.timestamp >= datetime('now', '-${days} days')` : ""}
    ORDER BY i.timestamp DESC
  `).all();
  const attempts = db.prepare(`
    SELECT activity_type, target_error_type, target_pattern, context_label, score, created_at,
      prompt, learner_answer, reference_answer
    FROM practice_attempts
    WHERE 1=1 ${days > 0 ? `AND created_at >= datetime('now', '-${days} days')` : ""}
    ORDER BY created_at DESC
  `).all();
  const resourceChecks = db.prepare(`
    SELECT url, ok, status, final_url, reason, checked_at
    FROM learning_resource_checks
    ORDER BY checked_at DESC
  `).all();
  return { totalInputs, diagnoses, attempts, resourceChecks };
}

export async function getCoachEvidenceData(days) {
  const data = await getLearningProfileData(days);
  const db = await getDb({ readonly: true });
  const undiagnosedInputs = db.prepare(`
    SELECT i.original_text, i.timestamp FROM inputs i
    WHERE NOT EXISTS (SELECT 1 FROM diagnoses d WHERE d.input_id = i.id)
      AND (? = 0 OR i.timestamp >= datetime('now', ?))
    ORDER BY i.timestamp DESC LIMIT 30
  `).all(days, `-${days} days`);
  return { ...data, undiagnosedInputs };
}
