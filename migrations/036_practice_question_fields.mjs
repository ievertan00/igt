import { practiceRowFromLegacy } from "../lib/features/practice/question-fields.mjs";
import { inferPracticeSituation } from "../lib/features/practice/infer-situation.mjs";

export function up(db) {
  db.transaction(() => {
    const columns = db.prepare("PRAGMA table_info(practice_questions)").all();
    if (columns.some(column => column.name === "practice_fields_json")) return;
    db.exec(`CREATE TABLE practice_questions_new (
      id TEXT PRIMARY KEY,
      prompt_zh TEXT NOT NULL UNIQUE,
      reference_answer TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'standard', 'challenge')),
      context TEXT NOT NULL CHECK (context IN ('home', 'dining', 'shopping', 'entertainment', 'social', 'health', 'work', 'transit', 'travel', 'services', 'home-routines', 'restaurants-cafes', 'supermarkets-shopping', 'cinema-entertainment', 'friends-social', 'health-pharmacy', 'work-study', 'commuting-transit', 'travel-accommodation', 'appointments-services')),
      practice_fields_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(practice_fields_json) AND json_type(practice_fields_json) = 'object'),
      hint_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(hint_json) AND json_type(hint_json) = 'object'),
      generated_by TEXT NOT NULL DEFAULT 'unknown',
      served_count INTEGER NOT NULL DEFAULT 0 CHECK (served_count >= 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    )`);
    const insert = db.prepare(`INSERT INTO practice_questions_new
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json, hint_json, generated_by, served_count, active)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @context, @practice_fields_json, @hint_json, @generated_by, @served_count, @active)`);
    for (const row of db.prepare("SELECT * FROM practice_questions").all()) {
      const migrated = practiceRowFromLegacy(row);
      migrated.context = inferPracticeSituation(row);
      insert.run(migrated);
    }
    db.exec(`DROP TABLE practice_questions;
      ALTER TABLE practice_questions_new RENAME TO practice_questions;
      CREATE INDEX practice_questions_selection ON practice_questions(active, difficulty, context, served_count);`);
  })();
}
