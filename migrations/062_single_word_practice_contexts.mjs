import { PRACTICE_CONTEXTS, normalizePracticeContext } from "../lib/features/practice/contexts.mjs";

const contextSql = PRACTICE_CONTEXTS.map((value) => `'${value}'`).join(", ");

export function up(db) {
  db.transaction(() => {
    const rows = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
    db.exec(`CREATE TABLE practice_questions_single_word (
      id TEXT PRIMARY KEY,
      prompt_zh TEXT NOT NULL UNIQUE,
      reference_answer TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'standard', 'challenge')),
      context TEXT NOT NULL CHECK (context IN (${contextSql})),
      practice_fields_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(practice_fields_json) AND json_type(practice_fields_json) = 'object'),
      hint_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(hint_json) AND json_type(hint_json) = 'object'),
      generated_by TEXT NOT NULL DEFAULT 'unknown',
      served_count INTEGER NOT NULL DEFAULT 0 CHECK (served_count >= 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    )`);
    const insert = db.prepare(`INSERT INTO practice_questions_single_word
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json, hint_json, generated_by, served_count, active)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @context, @practice_fields_json, @hint_json, @generated_by, @served_count, @active)`);
    for (const row of rows) {
      const context = normalizePracticeContext(row.context);
      if (!context) throw new Error(`Unknown Practice context for ${row.id}: ${row.context}`);
      insert.run({ ...row, context });
    }
    db.exec(`DROP TABLE practice_questions;
      ALTER TABLE practice_questions_single_word RENAME TO practice_questions;
      CREATE INDEX practice_questions_selection ON practice_questions(active, difficulty, context, served_count);`);
  })();
}

export function down() {
  throw new Error("Migration 062 is irreversible without restoring the pre-migration database backup.");
}
