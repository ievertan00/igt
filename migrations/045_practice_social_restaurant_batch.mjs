import { ENRICHMENT_PILOT_045, ENRICHMENT_PILOT_045_APPROVED } from "../lib/features/practice/enrichment-pilot-045.mjs";
import { PRACTICE_DRAFT_REVISIONS_046 } from "./046_refine_social_restaurant_drafts.mjs";

const normalize = value => value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");

export function up(db) {
  return db.transaction(() => {
    const byId = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const rows = db.prepare("SELECT id, prompt_zh FROM practice_questions").all();
    const promptOwners = new Map(rows.map(row => [normalize(row.prompt_zh), row.id]));
    const revisions = new Map(PRACTICE_DRAFT_REVISIONS_046.map(revision => [revision.id, revision]));
    const approvedIds = new Set(ENRICHMENT_PILOT_045_APPROVED.map(candidate => candidate.id));
    const pending = [];
    const seenIds = new Set();
    const seenPrompts = new Set();

    for (const candidate of ENRICHMENT_PILOT_045) {
      if (candidate.active !== 0) throw new Error(`Second-batch candidate must remain inactive: ${candidate.id}`);
      if (seenIds.has(candidate.id)) throw new Error(`Duplicate second-batch ID: ${candidate.id}`);
      seenIds.add(candidate.id);
      const prompt = normalize(candidate.prompt_zh);
      if (!prompt || seenPrompts.has(prompt)) throw new Error(`Duplicate normalized prompt in second batch: ${candidate.id}`);
      seenPrompts.add(prompt);

      const fields = JSON.parse(candidate.practice_fields_json);
      for (const key of ["primary_target", "learning_goal", "learning_rationale", "register"]) {
        if (!Array.isArray(fields[key]) || fields[key].length !== 1 || !fields[key][0]?.trim()) {
          throw new Error(`Second-batch candidate requires one ${key}: ${candidate.id}`);
        }
      }
      const hints = JSON.parse(candidate.hint_json);
      if (!["simple", "intermediate", "complete"].every(key => typeof hints[key] === "string" && hints[key].trim())) {
        throw new Error(`Second-batch candidate has incomplete progressive hints: ${candidate.id}`);
      }

      const existing = byId.get(candidate.id);
      if (existing) {
        const expectedCurrent = {
          id: candidate.id, prompt_zh: candidate.prompt_zh, reference_answer: candidate.reference_answer,
          difficulty: candidate.difficulty, context: candidate.context,
          practice_fields_json: candidate.practice_fields_json, hint_json: candidate.hint_json,
          generated_by: candidate.generated_by,
        };
        const revision = revisions.get(candidate.id);
        const matchesCurrent = Object.entries(expectedCurrent).every(([key, value]) => existing[key] === value);
        const matchesPrior = revision && Object.entries(expectedCurrent).every(([key, value]) =>
          existing[key] === (Object.hasOwn(revision.before, key) ? revision.before[key] : value));
        if (!matchesCurrent && !matchesPrior) throw new Error(`Second-batch content conflict: ${candidate.id}`);
        if (![0, 1].includes(existing.active) || (existing.active === 1 && !approvedIds.has(candidate.id))) {
          throw new Error(`Second-batch activation conflict: ${candidate.id}`);
        }
        if (existing.served_count !== 0) throw new Error(`Second-batch draft already has usage: ${candidate.id}`);
        continue;
      }

      const owner = promptOwners.get(prompt);
      if (owner) throw new Error(`Second-batch normalized prompt collision: ${candidate.id}/${owner}`);
      pending.push(candidate);
    }

    const insert = db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json,
       hint_json, generated_by, served_count, active)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @context,
       @practice_fields_json, @hint_json, @generated_by, 0, 0)`);
    for (const candidate of pending) insert.run(candidate);
    return pending.length;
  })();
}
