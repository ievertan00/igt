// Migration 054: Fill empty filter cells and add pilot depth
// Inserts 100 new questions (40 for empty cells + 60 for pilot depth)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.resolve(__dirname, "..", "artifacts");

const FILL_QUESTIONS = JSON.parse(fs.readFileSync(path.resolve(artifactsDir, "fill-questions-1.json"), "utf-8"));
const DEPTH_QUESTIONS = JSON.parse(fs.readFileSync(path.resolve(artifactsDir, "depth-questions.json"), "utf-8"));

export function up(db) {
  return db.transaction(() => {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO practice_questions
        (id, prompt_zh, reference_answer, difficulty, context,
         practice_fields_json, hint_json, generated_by, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'codex', 1)
    `);

    let inserted = 0;
    const allQuestions = { ...FILL_QUESTIONS, ...DEPTH_QUESTIONS };

    for (const [id, q] of Object.entries(allQuestions)) {
      const practiceFields = {
        primary_target: [q.primary_target],
        learning_goal: [q.learning_goal],
        learning_rationale: [q.learning_rationale],
        register: [q.register],
        grammar_point: q.grammar_point,
        situation: [
          q.context === "work-study" ? "work-study"
          : q.context === "home-routines" ? "daily-life"
          : q.context === "travel-accommodation" ? "travel-public-life"
          : q.context === "friends-social" || q.context === "cinema-entertainment" ? "social-relationships"
          : q.context === "commuting-transit" ? "travel-public-life"
          : "services-transactions"
        ],
      };
      insert.run(
        id, q.prompt_zh, q.reference_answer, q.difficulty, q.context,
        JSON.stringify(practiceFields),
        JSON.stringify(q.hint_json)
      );
      inserted++;
    }

    return { inserted };
  })();
}

export function down(_db) {
  throw new Error("Migration 054 is not reversible. Restore from backup if needed.");
}

export default { up, down };