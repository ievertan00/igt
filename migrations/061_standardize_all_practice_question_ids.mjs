import { rekeyPracticeQuestionIds } from "../lib/features/practice/question-ids.mjs";

export function up(db) {
  return db.transaction(() => ({ renamed: rekeyPracticeQuestionIds(db, { requireAll: true }) }))();
}

export function down() {
  throw new Error("Practice question IDs are stable identifiers. Restore the verified pre-migration database backup to reverse this migration.");
}

export default { up, down };
