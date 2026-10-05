import { ENRICHMENT_PILOT_041 } from "../lib/features/practice/enrichment-pilot-041.mjs";

// These approved rows are deliberately staged inactive until the publication migration.
export function up(db) {
  return db.transaction(() => {
    const existingId = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const existingPrompt = db.prepare("SELECT id FROM practice_questions WHERE prompt_zh = ?");
    const insert = db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json,
       hint_json, generated_by, served_count, active)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @context,
       @practice_fields_json, @hint_json, @generated_by, 0, 0)`);

    const ids = new Set();
    const prompts = new Set();
    const pending = [];
    for (const candidate of ENRICHMENT_PILOT_041) {
      if (candidate.active !== 1 || candidate.sidecar?.human_review_status !== "approved") {
        throw new Error(`Pilot row must have recorded human approval before publication: ${candidate.id}`);
      }
      if (ids.has(candidate.id)) throw new Error(`Duplicate Practice pilot ID: ${candidate.id}`);
      if (prompts.has(candidate.prompt_zh)) throw new Error(`Duplicate Practice pilot prompt: ${candidate.id}`);
      ids.add(candidate.id);
      prompts.add(candidate.prompt_zh);

      const fields = JSON.parse(candidate.practice_fields_json);
      for (const key of ["primary_target", "learning_goal", "learning_rationale", "register"]) {
        if (!Array.isArray(fields[key]) || fields[key].length !== 1 || !fields[key][0]?.trim()) {
          throw new Error(`Practice pilot requires a singleton ${key}: ${candidate.id}`);
        }
      }
      const hints = JSON.parse(candidate.hint_json);
      for (const key of ["simple", "intermediate", "complete"]) {
        if (typeof hints[key] !== "string" || !hints[key].trim()) throw new Error(`Missing ${key} hint: ${candidate.id}`);
      }

      const existing = existingId.get(candidate.id);
      if (existing) {
        const expected = {
          id: candidate.id, prompt_zh: candidate.prompt_zh, reference_answer: candidate.reference_answer,
          difficulty: candidate.difficulty, context: candidate.context,
          practice_fields_json: candidate.practice_fields_json, hint_json: candidate.hint_json,
          generated_by: candidate.generated_by,
        };
        for (const [key, value] of Object.entries(expected)) {
          if (existing[key] !== value) throw new Error(`Practice pilot content conflict for ${candidate.id}/${key}`);
        }
        if (![0, 1].includes(existing.active) || (existing.active === 1 && candidate.active !== 1)) {
          throw new Error(`Practice pilot activation conflicts with approved content: ${candidate.id}`);
        }
        if (existing.served_count !== 0) throw new Error(`Practice pilot has usage before release: ${candidate.id}`);
        continue; // 038 can restore the current export before 041 runs on a fresh rebuild.
      }
      if (existingPrompt.get(candidate.prompt_zh)) throw new Error(`Practice pilot prompt collision: ${candidate.id}`);
      pending.push(candidate);
    }

    for (const candidate of pending) insert.run({
      id: candidate.id, prompt_zh: candidate.prompt_zh, reference_answer: candidate.reference_answer,
      difficulty: candidate.difficulty, context: candidate.context,
      practice_fields_json: candidate.practice_fields_json, hint_json: candidate.hint_json,
      generated_by: candidate.generated_by,
    });
    return pending.length;
  })();
}
