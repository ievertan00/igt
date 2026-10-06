import { restoreCanonicalQuestions, rekeyPracticeQuestionIds } from "../lib/features/practice/canonical-bank.mjs";
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
    restoreCanonicalQuestions(db, undefined, { fillUnknownProvenance: true });
  })();
}
