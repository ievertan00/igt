import { getDb } from "../../db/connection.mjs";
import { normalizePracticeContext } from "./contexts.mjs";
import { linkPracticeAttemptToPlan } from "../learning-diagnosis/plans.mjs";

function normalizeAttemptContext(value) {
  const context = String(value || "").trim().toLowerCase();
  if (/^(drill|review):/.test(context)) return context;
  return normalizePracticeContext(context) || null;
}

function requiredText(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Missing practice attempt field: ${field}`);
  return text;
}

export function insertPracticeAttempt(db, attempt) {
  const activityType = requiredText(attempt.activityType, "activityType");
  const prompt = requiredText(attempt.prompt, "prompt");
  const learnerAnswer = requiredText(attempt.learnerAnswer, "learnerAnswer");
  const referenceAnswer = requiredText(attempt.referenceAnswer, "referenceAnswer");
  const score = Number(attempt.score);
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error("Practice attempt score must be an integer between 0 and 100");
  }
  const feedback = typeof attempt.feedback === "string"
    ? attempt.feedback
    : JSON.stringify(attempt.feedback || {});
  const contextLabel = normalizeAttemptContext(attempt.contextLabel);
  const targetErrorType = attempt.targetErrorType ? String(attempt.targetErrorType).trim() : null;
  const targetPattern = attempt.targetPattern ? String(attempt.targetPattern).trim() : null;
  const insert = db.prepare(`
    INSERT INTO practice_attempts
      (activity_type, target_error_type, target_pattern, context_label, prompt,
       learner_answer, reference_answer, score, feedback)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const attachTask = db.prepare("UPDATE practice_attempts SET learning_task_id = ? WHERE id = ?");
  const save = db.transaction(() => {
    const result = insert.run(
      activityType,
      targetErrorType,
      targetPattern,
      contextLabel,
      prompt,
      learnerAnswer,
      referenceAnswer,
      score,
      feedback,
    );
    const taskId = linkPracticeAttemptToPlan(db, { targetErrorType, score });
    if (taskId) attachTask.run(taskId, result.lastInsertRowid);
    return result.lastInsertRowid;
  });
  return save();
}

export async function savePracticeAttempt(attempt) {
  return insertPracticeAttempt(await getDb(), attempt);
}

export async function getPracticeAttempts({ days = 90, limit = 500 } = {}) {
  const db = await getDb({ readonly: true });
  const safeDays = Number.isInteger(days) && days >= 0 ? days : 90;
  const safeLimit = Math.min(5000, Math.max(1, Number.isInteger(limit) ? limit : 500));
  return db.prepare(`
    SELECT id, activity_type, target_error_type, target_pattern, context_label, learning_task_id, prompt,
      learner_answer, reference_answer, score, feedback, created_at
    FROM practice_attempts
    WHERE ? = 0 OR created_at >= datetime('now', ?)
    ORDER BY id DESC
    LIMIT ?
  `).all(safeDays, `-${safeDays} days`, safeLimit);
}
