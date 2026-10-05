// Retire the compatibility payload; preserve every other field and usage record.
export function up(db) {
  return db.transaction(() => db.prepare(`UPDATE practice_questions
    SET practice_fields_json = json_remove(practice_fields_json, '$._legacy')
    WHERE json_type(practice_fields_json, '$._legacy') IS NOT NULL`).run().changes)();
}
