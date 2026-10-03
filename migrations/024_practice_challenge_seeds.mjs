import { CHALLENGE_PRACTICE_QUESTIONS } from "../lib/features/practice/challenge-seeds.mjs";

export function up(db) {
  db.transaction(() => {
    const insert = db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, style, context, focus, error_type,
       focus_id, variant, hints_json, metadata_json, alternative_note, active)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @style, @context, @focus, @error_type,
       @focus_id, @variant, @hints_json, @metadata_json, @alternative_note, 1)
      ON CONFLICT(id) DO NOTHING`);
    for (const question of CHALLENGE_PRACTICE_QUESTIONS) {
      const { hints, metadata, ...fields } = question;
      insert.run({ ...fields, hints_json: JSON.stringify(hints), metadata_json: JSON.stringify(metadata) });
    }
  })();
}
