import { SCHEMA_NATIVE_PRACTICE_QUESTIONS } from "../lib/features/practice/schema-native-seeds.mjs";

import { inferPracticeSituation } from "../lib/features/practice/infer-situation.mjs";

export function up(db) {
  db.transaction(() => {
    const insert = db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json, hint_json, generated_by, served_count, active)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @context, @practice_fields_json, @hint_json, @generated_by, @served_count, @active)
      ON CONFLICT(id) DO NOTHING`);
    for (const question of SCHEMA_NATIVE_PRACTICE_QUESTIONS) {
      insert.run({ ...question, context: inferPracticeSituation({ ...question, practice_fields: JSON.parse(question.practice_fields_json) }) });
    }
  })();
}
