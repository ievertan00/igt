import crypto from "node:crypto";
import batch from "../lib/features/practice/context-corrections-040.json" with { type: "json" };

export const CONTEXT_CORRECTIONS = batch.corrections;

// Apply the reviewed ID-specific delta, never reclassify the bank with keywords.
export function applyContextCorrections(db, { allowMissing = false } = {}) {
  return db.transaction(() => {
    const find = db.prepare("SELECT id, prompt_zh, reference_answer, context FROM practice_questions WHERE id = ?");
    const pending = [];
    for (const correction of CONTEXT_CORRECTIONS) {
      const row = find.get(correction.id);
      if (!row) {
        if (allowMissing) continue; // 038 supplies missing canonical IDs afterwards.
        throw new Error(`Practice context correction missing ID: ${correction.id}`);
      }
      const digest = crypto.createHash("sha256").update(JSON.stringify([row.id, row.prompt_zh, row.reference_answer])).digest("hex");
      if (digest !== correction.content_sha256) throw new Error(`Practice context correction content conflict: ${row.id}`);
      if (row.context === correction.context) continue;
      if (row.context !== correction.expected_context) throw new Error(`Practice context correction label conflict: ${row.id}`);
      pending.push(correction);
    }
    const update = db.prepare("UPDATE practice_questions SET context = ? WHERE id = ? AND context = ?");
    for (const correction of pending) update.run(correction.context, correction.id, correction.expected_context);
    return pending.length;
  })();
}

export function up(db) {
  return applyContextCorrections(db);
}
