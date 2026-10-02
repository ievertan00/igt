import { DEFAULT_PRACTICE_QUESTIONS } from "../lib/features/practice/default-questions.mjs";
import { LANGUAGE_PRACTICE_QUESTIONS } from "../lib/features/practice/language-seeds.mjs";

export function up(db) {
  db.transaction(() => {
    const columns = new Set(db.prepare("PRAGMA table_info(practice_questions)").all().map(column => column.name));
    for (const [name, type] of Object.entries({
      focus_id: "TEXT NOT NULL DEFAULT ''", variant: "TEXT NOT NULL DEFAULT ''",
      hints_json: "TEXT NOT NULL DEFAULT '{}'", metadata_json: "TEXT NOT NULL DEFAULT '{}'",
      alternative_note: "TEXT NOT NULL DEFAULT ''", active: "INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))",
    })) if (!columns.has(name)) db.exec(`ALTER TABLE practice_questions ADD COLUMN ${name} ${type}`);

    const insert = db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, style, context, focus, error_type,
       focus_id, variant, hints_json, metadata_json, alternative_note)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @style, @context, @focus, @error_type,
       @focus_id, @variant, @hints_json, @metadata_json, @alternative_note)
      ON CONFLICT(id) DO NOTHING`);
    for (const question of LANGUAGE_PRACTICE_QUESTIONS) {
      const { hints, metadata, ...fields } = question;
      insert.run({ ...fields, hints_json: JSON.stringify(hints), metadata_json: JSON.stringify(metadata) });
    }
    // Keep original IDs and usage for existing sessions and records; new sessions use the reviewed set.
    const retire = db.prepare("UPDATE practice_questions SET active = 0 WHERE id = ?");
    for (const question of DEFAULT_PRACTICE_QUESTIONS) retire.run(question.id);
    db.exec("CREATE INDEX IF NOT EXISTS practice_questions_active_focus ON practice_questions(active, focus_id)");
  })();
}
