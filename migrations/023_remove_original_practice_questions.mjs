import { DEFAULT_PRACTICE_QUESTIONS } from "../lib/features/practice/default-questions.mjs";

export function up(db) {
  // Delete only the original authored IDs, leaving custom questions and attempt records intact.
  db.transaction(() => {
    const remove = db.prepare("DELETE FROM practice_questions WHERE id = ?");
    for (const question of DEFAULT_PRACTICE_QUESTIONS) remove.run(question.id);
  })();
}
