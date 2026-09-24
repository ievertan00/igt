import { getDb } from "../../db/connection.mjs";
import { beijingISO } from "../../shared/timezone.mjs";

const PHASE_DAYS = { 1: 1, 2: 4, 3: 7, 4: 11 };

function timestampMs(value) {
  const text = String(value || "");
  const parsed = Date.parse(text.replace(" ", "T") + (text.includes("Z") ? "" : "Z"));
  return Number.isFinite(parsed) ? parsed : null;
}

function currentDay(createdAt, now) {
  const created = timestampMs(createdAt);
  if (created === null) return 1;
  return Math.min(14, Math.max(1, Math.floor((now - created) / 86400000) + 1));
}

export function createLearningPlan(db, diagnosis, { createdAt = beijingISO() } = {}) {
  const insertPlan = db.prepare(`
    INSERT INTO learning_plans (goal, window_days, status, created_at, updated_at)
    VALUES (?, ?, 'active', ?, ?)
  `);
  const insertTask = db.prepare(`
    INSERT INTO learning_tasks
      (plan_id, priority_index, error_type, phase, phase_name, task, check_text, scheduled_day)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const create = db.transaction(() => {
    db.prepare("UPDATE learning_plans SET status = 'archived', updated_at = ? WHERE status = 'active'").run(createdAt);
    const result = insertPlan.run(diagnosis.goal, diagnosis.windowDays, createdAt, createdAt);
    for (const [priorityIndex, item] of (diagnosis.priorities || []).entries()) {
      for (const phase of item.prescription || []) {
        const phaseNumber = Number(phase.phase);
        if (!PHASE_DAYS[phaseNumber]) continue;
        insertTask.run(
          result.lastInsertRowid,
          priorityIndex,
          item.errorType,
          phaseNumber,
          phase.name,
          phase.task,
          phase.check,
          PHASE_DAYS[phaseNumber],
        );
      }
    }
    return Number(result.lastInsertRowid);
  });
  return { id: create() };
}

export async function createLearningPlanFromDiagnosis(diagnosis, options = {}) {
  return createLearningPlan(await getDb(), diagnosis, options);
}

export function getActiveLearningPlan(db) {
  return db.prepare(`
    SELECT id, goal, window_days, status, paused_at, created_at, updated_at
    FROM learning_plans
    WHERE status = 'active' AND paused_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `).get() || null;
}

export function getPausedLearningPlan(db) {
  return db.prepare(`
    SELECT id, goal, window_days, status, paused_at, created_at, updated_at
    FROM learning_plans
    WHERE status = 'active' AND paused_at IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
  `).get() || null;
}

export function getDueLearningTasks(db, { planId, now = Date.now(), limit = 3 } = {}) {
  const plan = planId
    ? db.prepare("SELECT id, created_at FROM learning_plans WHERE id = ? AND status = 'active' AND paused_at IS NULL").get(planId)
    : getActiveLearningPlan(db);
  if (!plan) return [];
  const safeLimit = Math.min(20, Math.max(1, Number.isInteger(limit) ? limit : 3));
  const day = currentDay(plan.created_at, now);
  return db.prepare(`
    SELECT id, plan_id, priority_index, error_type, phase, phase_name, task, check_text,
      scheduled_day, status, completed_at
    FROM learning_tasks
    WHERE plan_id = ? AND status = 'pending' AND scheduled_day <= ?
    ORDER BY priority_index, scheduled_day, id
    LIMIT ?
  `).all(plan.id, day, safeLimit);
}

export function completeLearningTask(db, taskId, { completedAt = beijingISO() } = {}) {
  const result = db.prepare(`
    UPDATE learning_tasks
    SET status = 'completed', completed_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(completedAt, taskId);
  return result.changes === 1;
}

export function skipLearningTask(db, taskId) {
  const result = db.prepare(`
    UPDATE learning_tasks
    SET status = 'skipped', completed_at = NULL
    WHERE id = ? AND status = 'pending'
  `).run(taskId);
  return result.changes === 1;
}

export function resumeLearningTask(db, taskId) {
  const result = db.prepare(`
    UPDATE learning_tasks
    SET status = 'pending', completed_at = NULL
    WHERE id = ? AND status = 'skipped'
  `).run(taskId);
  return result.changes === 1;
}

export function pauseActiveLearningPlan(db, { pausedAt = beijingISO() } = {}) {
  const result = db.prepare(`
    UPDATE learning_plans
    SET paused_at = ?, updated_at = ?
    WHERE id = (SELECT id FROM learning_plans WHERE status = 'active' AND paused_at IS NULL ORDER BY id DESC LIMIT 1)
  `).run(pausedAt, pausedAt);
  return result.changes === 1;
}

export function resumeLearningPlan(db, { resumedAt = beijingISO() } = {}) {
  const result = db.prepare(`
    UPDATE learning_plans
    SET paused_at = NULL, updated_at = ?
    WHERE id = (SELECT id FROM learning_plans WHERE status = 'active' AND paused_at IS NOT NULL ORDER BY id DESC LIMIT 1)
  `).run(resumedAt);
  return result.changes === 1;
}

export function linkPracticeAttemptToPlan(db, { targetErrorType, score }) {
  if (!targetErrorType) return null;
  const task = db.prepare(`
    SELECT t.id, t.plan_id, t.phase, t.priority_index, t.error_type,
      p.created_at
    FROM learning_tasks t
    JOIN learning_plans p ON p.id = t.plan_id
    WHERE p.status = 'active'
      AND p.paused_at IS NULL
      AND t.status = 'pending'
      AND t.error_type = ?
      AND t.scheduled_day <= MIN(14, CAST(julianday('now') - julianday(p.created_at) AS INTEGER) + 1)
    ORDER BY CASE WHEN t.phase = 2 THEN 0 ELSE 1 END, t.scheduled_day, t.id
    LIMIT 1
  `).get(targetErrorType);
  if (!task) return null;

  const numericScore = Number(score);
  if (task.phase === 4 && numericScore < 85) {
    const day = currentDay(task.created_at, Date.now());
    const existing = db.prepare(`
      SELECT id FROM learning_tasks
      WHERE plan_id = ? AND error_type = ? AND phase = 2
        AND status = 'pending' AND scheduled_day <= ?
      ORDER BY id LIMIT 1
    `).get(task.plan_id, targetErrorType, day);
    if (existing) return existing.id;
    const result = db.prepare(`
      INSERT INTO learning_tasks
        (plan_id, priority_index, error_type, phase, phase_name, task, check_text, scheduled_day)
      VALUES (?, ?, ?, 2, ?, ?, ?, ?)
    `).run(
      task.plan_id,
      task.priority_index,
      targetErrorType,
      "补强对比",
      `围绕 ${targetErrorType} 完成对比练习后再复测。`,
      "连续答对 4/5 题",
      day,
    );
    return Number(result.lastInsertRowid);
  }

  const completed = db.prepare(`
    UPDATE learning_tasks
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'pending'
  `).run(task.id);
  if (completed.changes !== 1) return null;
  if (task.phase === 4) {
    const remaining = db.prepare(
      "SELECT 1 FROM learning_tasks WHERE plan_id = ? AND status = 'pending' LIMIT 1",
    ).get(task.plan_id);
    if (!remaining) {
      db.prepare("UPDATE learning_plans SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(task.plan_id);
    }
  }
  return task.id;
}

export async function completeLearningTaskById(taskId, options = {}) {
  return completeLearningTask(await getDb(), taskId, options);
}

export async function skipLearningTaskById(taskId) {
  return skipLearningTask(await getDb(), taskId);
}

export async function resumeLearningTaskById(taskId) {
  return resumeLearningTask(await getDb(), taskId);
}

export async function pauseActiveLearningPlanById(options = {}) {
  return pauseActiveLearningPlan(await getDb(), options);
}

export async function resumeLearningPlanNow(options = {}) {
  return resumeLearningPlan(await getDb(), options);
}
