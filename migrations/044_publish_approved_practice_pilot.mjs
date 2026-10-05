import { ENRICHMENT_PILOT_041 } from "../lib/features/practice/enrichment-pilot-041.mjs";

const CONTENT_FIELDS = [
  "prompt_zh", "reference_answer", "difficulty", "context",
  "practice_fields_json", "hint_json", "generated_by",
];

export function up(db) {
  return db.transaction(() => {
    const select = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const pending = [];

    for (const candidate of ENRICHMENT_PILOT_041) {
      if (candidate.active !== 1 || candidate.sidecar?.human_review_status !== "approved"
        || !candidate.sidecar.actual_reviewers?.some(reviewer => reviewer.role === "human")
        || !/^verified\b/i.test(candidate.sidecar.rights_status ?? "")) {
        throw new Error(`Practice pilot is missing recorded review approval: ${candidate.id}`);
      }
      const current = select.get(candidate.id);
      if (!current) throw new Error(`Approved Practice pilot row is missing: ${candidate.id}`);
      if (!CONTENT_FIELDS.every(key => current[key] === candidate[key]) || current.served_count !== 0) {
        throw new Error(`Approved Practice pilot content or usage conflict: ${candidate.id}`);
      }
      if (current.active === 1) continue;
      if (current.active !== 0) throw new Error(`Unexpected Practice pilot activation state: ${candidate.id}`);
      pending.push(candidate.id);
    }

    const activate = db.prepare("UPDATE practice_questions SET active = 1 WHERE id = ? AND active = 0 AND served_count = 0");
    for (const id of pending) {
      if (activate.run(id).changes !== 1) throw new Error(`Could not safely publish Practice pilot row: ${id}`);
    }
    return pending.length;
  })();
}
