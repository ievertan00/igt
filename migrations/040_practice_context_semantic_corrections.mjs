import crypto from "node:crypto";
import batch from "../lib/features/practice/context-corrections-040.json" with { type: "json" };
import { CANONICAL_PRACTICE_QUESTIONS } from "../lib/features/practice/canonical-bank.mjs";
import { practiceQuestionId } from "../lib/features/practice/question-ids.mjs";
import { normalizePracticeContext } from "../lib/features/practice/contexts.mjs";

export const CONTEXT_CORRECTIONS = batch.corrections;
const canonicalById = new Map(CANONICAL_PRACTICE_QUESTIONS.map((row) => [row.id, row]));

// Apply the reviewed ID-specific delta, never reclassify the bank with keywords.
export function applyContextCorrections(db, { allowMissing = false } = {}) {
  return db.transaction(() => {
    const find = db.prepare("SELECT id, prompt_zh, reference_answer, context FROM practice_questions WHERE id = ?");
    const pending = [];
    for (const correction of CONTEXT_CORRECTIONS) {
      const row = find.get(practiceQuestionId(correction.id)) ?? find.get(correction.id);
      if (!row) {
        if (allowMissing) continue; // 038 supplies missing canonical IDs afterwards.
        throw new Error(`Practice context correction missing ID: ${correction.id}`);
      }
      const digest = crypto.createHash("sha256").update(JSON.stringify([row.id, row.prompt_zh, row.reference_answer])).digest("hex");
      const targetContext = normalizePracticeContext(correction.context);
      const canonical = canonicalById.get(practiceQuestionId(row.id));
      const matchesReviewedExport = canonical
        && canonical.prompt_zh === row.prompt_zh
        && canonical.reference_answer === row.reference_answer
        && canonical.context === targetContext;
      if (digest !== correction.content_sha256 && !matchesReviewedExport) {
        throw new Error(`Practice context correction content conflict: ${row.id}`);
      }
      if (row.context === targetContext) continue;
      if (row.context !== correction.expected_context && !matchesReviewedExport) {
        throw new Error(`Practice context correction label conflict: ${row.id}`);
      }
      pending.push({ correction, targetContext, currentContext: row.context });
    }
    const update = db.prepare("UPDATE practice_questions SET context = ? WHERE id = ? AND context = ?");
    for (const { correction, targetContext, currentContext } of pending) {
      update.run(targetContext, practiceQuestionId(correction.id), currentContext);
      update.run(targetContext, correction.id, currentContext);
    }
    return pending.length;
  })();
}

export function up(db) {
  return applyContextCorrections(db);
}
