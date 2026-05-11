import { getDb } from "./connection.mjs";
import { getMastery } from "../mastery.mjs";

export async function getStats() {
  const db = await getDb({ readonly: true });

  const byLength = db.prepare(`
    SELECT bucket_id,
      CASE bucket_id WHEN 1 THEN '0-10' WHEN 2 THEN '11-20' WHEN 3 THEN '21-30' ELSE '31+' END AS bucket,
      AVG(error_count) AS avg_errors
    FROM (
      SELECT i.id,
        CASE
          WHEN (length(trim(i.original_text)) - length(replace(trim(i.original_text),' ','')) + 1) <= 10 THEN 1
          WHEN (length(trim(i.original_text)) - length(replace(trim(i.original_text),' ','')) + 1) <= 20 THEN 2
          WHEN (length(trim(i.original_text)) - length(replace(trim(i.original_text),' ','')) + 1) <= 30 THEN 3
          ELSE 4
        END AS bucket_id,
        COUNT(d.id) AS error_count
      FROM inputs i LEFT JOIN diagnoses d ON d.input_id = i.id
      GROUP BY i.id
    )
    GROUP BY bucket_id ORDER BY bucket_id
  `).all();

  const cefrTrajectory = db.prepare(`
    SELECT date(timestamp) AS day, level FROM assessments ORDER BY timestamp
  `).all();

  const mastery = getMastery(db);

  const { total_inputs } = db.prepare("SELECT COUNT(*) as total_inputs FROM inputs").get();
  const { total_diagnoses } = db.prepare("SELECT COUNT(*) as total_diagnoses FROM diagnoses").get();

  return {
    byLength,
    cefrTrajectory,
    mastery,
    totalInputs: total_inputs,
    totalDiagnoses: total_diagnoses,
  };
}
