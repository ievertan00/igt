// Migration 053: Add primary_target, learning_goal, learning_rationale for 753 old questions
// Remove deprecated fields: genre, tone, purpose, meaning_relationship, situation

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.resolve(__dirname, "..", "artifacts");
const DATA = JSON.parse(fs.readFileSync(path.resolve(artifactsDir, "audit-primary-targets.json"), "utf-8"));

const DEPRECATED_FIELDS = ["genre", "tone", "purpose", "meaning_relationship"];

export function up(db) {
  return db.transaction(() => {
    const select = db.prepare("SELECT id, practice_fields_json FROM practice_questions WHERE id = ?");
    const update = db.prepare("UPDATE practice_questions SET practice_fields_json = ? WHERE id = ?");

    let added = 0;
    let cleaned = 0;

    for (const [id, patch] of Object.entries(DATA)) {
      const row = select.get(id);
      if (!row) throw new Error(`Target missing: ${id}`);

      const fields = JSON.parse(row.practice_fields_json);

      // Add primary_target, learning_goal, learning_rationale
      let changed = false;
      if (!fields.primary_target || fields.primary_target.length === 0) {
        fields.primary_target = patch.primary_target;
        changed = true;
      }
      if (!fields.learning_goal || fields.learning_goal.length === 0) {
        fields.learning_goal = patch.learning_goal;
        changed = true;
      }
      if (!fields.learning_rationale || fields.learning_rationale.length === 0) {
        fields.learning_rationale = patch.learning_rationale;
        changed = true;
      }

      // Remove deprecated fields
      for (const f of DEPRECATED_FIELDS) {
        if (f in fields) {
          delete fields[f];
          changed = true;
          cleaned++;
        }
      }

      if (changed) {
        update.run(JSON.stringify(fields), id);
        added++;
      }
    }

    return { primaryTargets: added, cleanedFields: cleaned };
  })();
}

export function down(_db) {
  throw new Error("Migration 053 is not reversible. Restore from backup if needed.");
}

export default { up, down };