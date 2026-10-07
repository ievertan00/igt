import { restoreCanonicalQuestions, rekeyPracticeQuestionIds } from "../lib/features/practice/canonical-bank.mjs";
import { CANONICAL_PRACTICE_QUESTIONS } from "../lib/features/practice/canonical-bank.mjs";
import { up as removeLegacy } from "./039_remove_practice_legacy.mjs";
import { applyContextCorrections } from "./040_practice_context_semantic_corrections.mjs";

// Reconstruct the exported live bank without replaying removed expansion drafts.
export function up(db) {
  db.transaction(() => {
    // Databases stopping at 036/037 must match the now-clean export before restore.
    removeLegacy(db);
    // Historical seeds precede the semantic audit; align its reviewed delta first.
    applyContextCorrections(db, { allowMissing: true });
    // Preserve historical content and counters while assigning canonical opaque IDs.
    rekeyPracticeQuestionIds(db);
    // Apply reviewed context labels to any IDs that were just normalized above.
    applyContextCorrections(db, { allowMissing: true });
    // Reconcile context inferred from early seed wording only when prompt and
    // reference text still identify the exact row in the authoritative export.
    const find = db.prepare("SELECT prompt_zh, reference_answer FROM practice_questions WHERE id = ?");
    const updateContext = db.prepare("UPDATE practice_questions SET context = ? WHERE id = ?");
    for (const canonical of CANONICAL_PRACTICE_QUESTIONS) {
      const existing = find.get(canonical.id);
      if (existing && existing.prompt_zh === canonical.prompt_zh
        && existing.reference_answer === canonical.reference_answer) {
        updateContext.run(canonical.context, canonical.id);
      }
    }
    restoreCanonicalQuestions(db, undefined, { fillUnknownProvenance: true });
  })();
}
