// Retire the old Coach plan/task and quiz stores. Preserve attempt evidence,
// question content, usage counters, and vocabulary scheduling.
export function up(db) {
  db.transaction(() => {
    const columns = db.pragma("table_info(practice_attempts)");
    if (columns.some(column => column.name === "learning_task_id")) {
      db.exec("DROP INDEX IF EXISTS idx_practice_attempts_task");
      db.exec("ALTER TABLE practice_attempts DROP COLUMN learning_task_id");
    }
    db.exec(`DROP TABLE IF EXISTS learning_tasks;
      DROP TABLE IF EXISTS learning_plans;
      DROP TABLE IF EXISTS quiz_questions;`);
  })();
}
