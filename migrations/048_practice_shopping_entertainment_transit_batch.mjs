import { ENRICHMENT_PILOT_048, ENRICHMENT_PILOT_048_APPROVED } from "../lib/features/practice/enrichment-pilot-048.mjs";

const normalize = value => value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
const preReviewValues = new Map([
  ["pilot-048-shopping-001", {
    prompt_zh: "请问纸巾在哪个货架？",
    hint_json: JSON.stringify({ simple: "询问纸巾放在哪个货架。", intermediate: "用 Which aisle 开头询问所在的通道。", complete: "Which aisle are the [商品] in?" }),
  }],
  ["pilot-048-shopping-009", { prompt_zh: "我上周在这里买的水壶打不开了，可以退货吗？" }],
  ["pilot-048-transit-007", {
    prompt_zh: "我把公交卡落在家里了。",
    reference_answer: "I left my transit card at home.",
    practice_fields_json: JSON.stringify({
      primary_target: ["report-missing-transit-card"],
      learning_goal: ["Report that a transit card was left at home."],
      learning_rationale: ["A direct problem report can prompt a practical discussion about paying or traveling."],
      register: ["neutral"],
      tense_aspect: ["past simple"],
      grammar_point: ["Leave something somewhere"],
    }),
    hint_json: JSON.stringify({
      simple: "说明公交卡忘在家里。",
      intermediate: "用 leave + 物品 + 地点说明东西落在哪里。",
      complete: "I left my [物品] at [地点].",
    }),
  }],
]);

export function up(db) {
  return db.transaction(() => {
    const approvedById = new Map(ENRICHMENT_PILOT_048_APPROVED.map(row => [row.id, row]));
    const byId = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const rows = db.prepare("SELECT id, prompt_zh FROM practice_questions").all();
    const promptOwners = new Map(rows.map(row => [normalize(row.prompt_zh), row.id]));
    const pending = [];
    const seenIds = new Set();
    const seenPrompts = new Set();

    for (const candidate of ENRICHMENT_PILOT_048) {
      if (candidate.active !== 0) throw new Error(`Third-batch candidate must remain inactive: ${candidate.id}`);
      if (seenIds.has(candidate.id)) throw new Error(`Duplicate third-batch ID: ${candidate.id}`);
      seenIds.add(candidate.id);
      const prompt = normalize(candidate.prompt_zh);
      if (!prompt || seenPrompts.has(prompt)) throw new Error(`Duplicate normalized prompt in third batch: ${candidate.id}`);
      seenPrompts.add(prompt);

      const fields = JSON.parse(candidate.practice_fields_json);
      for (const key of ["primary_target", "learning_goal", "learning_rationale", "register"]) {
        if (!Array.isArray(fields[key]) || fields[key].length !== 1 || !fields[key][0]?.trim()) {
          throw new Error(`Third-batch candidate requires one ${key}: ${candidate.id}`);
        }
      }
      const hints = JSON.parse(candidate.hint_json);
      if (!["simple", "intermediate", "complete"].every(key => typeof hints[key] === "string" && hints[key].trim())) {
        throw new Error(`Third-batch candidate has incomplete progressive hints: ${candidate.id}`);
      }

      const existing = byId.get(candidate.id);
      if (existing) {
        const published = existing.active === 1 && approvedById.has(candidate.id);
        const expected = {
          id: candidate.id, reference_answer: candidate.reference_answer,
          difficulty: candidate.difficulty, context: candidate.context,
          practice_fields_json: candidate.practice_fields_json, hint_json: candidate.hint_json,
          generated_by: candidate.generated_by,
        };
        for (const [key, value] of Object.entries(expected)) {
          if (existing[key] !== value && existing[key] !== preReviewValues.get(candidate.id)?.[key]) {
            throw new Error(`Third-batch content conflict: ${candidate.id}/${key}`);
          }
        }
        for (const [key, previousValue] of Object.entries(preReviewValues.get(candidate.id) ?? {})) {
          if (existing[key] !== candidate[key] && existing[key] !== previousValue) {
            throw new Error(`Third-batch reviewed content conflict: ${candidate.id}/${key}`);
          }
          if (existing[key] !== candidate[key] && existing.active !== 0
            && candidate.id !== "pilot-048-transit-007") {
            throw new Error(`Third-batch content revision is not safely staged: ${candidate.id}`);
          }
        }
        const approvedZeroUsageRevision = candidate.id === "pilot-048-transit-007"
          && existing.active === 1 && existing.served_count === 0;
        if (existing.active !== 0 && !published && !approvedZeroUsageRevision) throw new Error(`Third-batch activation conflict: ${candidate.id}`);
        if (existing.served_count !== 0) throw new Error(`Third-batch draft already has usage: ${candidate.id}`);
        continue;
      }

      const owner = promptOwners.get(prompt);
      if (owner) throw new Error(`Third-batch normalized prompt collision: ${candidate.id}/${owner}`);
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
