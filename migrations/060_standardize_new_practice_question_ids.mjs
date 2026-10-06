import { COVERAGE_QUESTION_ID_ALIASES } from "../lib/features/practice/question-ids.mjs";

export function up(db) {
  return db.transaction(() => {
    const select = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const rename = db.prepare("UPDATE practice_questions SET id = ? WHERE id = ? AND served_count = 0");
    let renamed = 0;
    for (const [legacyId, standardId] of COVERAGE_QUESTION_ID_ALIASES) {
      const legacy = select.get(legacyId);
      const standard = select.get(standardId);
      if (!legacy && standard) continue; // A fresh rebuild used the standardized ID directly.
      if (!legacy) throw new Error(`Question ID migration source missing: ${legacyId}`);
      if (standard) throw new Error(`Question ID migration destination already exists: ${standardId}`);
      if (legacy.served_count !== 0) throw new Error(`Cannot rename a served question ID: ${legacyId}`);
      if (rename.run(standardId, legacyId).changes !== 1) throw new Error(`Could not standardize question ID: ${legacyId}`);
      renamed++;
    }
    return { renamed };
  })();
}

export function down() {
  throw new Error("Question IDs are stable identifiers; restore the verified pre-migration database backup to reverse this rename.");
}

export default { up, down };
