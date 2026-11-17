// Retire pre-squash storage: grammar sessions, Coach plans/tasks, quiz questions,
// resource checks and usage tips. No-op on a fresh database; on an older database
// it preserves practice evidence, question content and vocabulary scheduling.
export function up(db) {
  db.transaction(() => {
    const columns = db.pragma("table_info(practice_attempts)");
    if (columns.some(column => column.name === "learning_task_id")) {
      db.exec("DROP INDEX IF EXISTS idx_practice_attempts_task");
      db.exec("ALTER TABLE practice_attempts DROP COLUMN learning_task_id");
    }
    db.exec(`DROP TABLE IF EXISTS learning_tasks;
      DROP TABLE IF EXISTS learning_plans;
      DROP TABLE IF EXISTS quiz_questions;
      DROP TABLE IF EXISTS learning_resource_checks;
      DROP TABLE IF EXISTS consultations;
      DROP TABLE IF EXISTS advice;
      DROP TABLE IF EXISTS diagnoses;
      DROP TABLE IF EXISTS inputs;
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS assessments;
      DROP INDEX IF EXISTS idx_practice_attempts_context;
      DROP INDEX IF EXISTS idx_status_messages_last_shown_at;
      DROP INDEX IF EXISTS idx_status_messages_content;
      DELETE FROM srs_cards WHERE source_type = 'input';
      DELETE FROM status_messages WHERE type = 'tip';`);
  })();
}