import { ENRICHMENT_PILOT_048 } from "../lib/features/practice/enrichment-pilot-048.mjs";

const REVIEWED_REVISIONS = new Map([
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
const normalize = value => value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");

export function applyReviewedRevisions(db) {
  return db.transaction(() => {
    const candidates = new Map(ENRICHMENT_PILOT_048.map(row => [row.id, row]));
    const select = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const promptOwner = db.prepare("SELECT id, prompt_zh FROM practice_questions WHERE id <> ?");
    const updates = [];

    for (const [id, previousValues] of REVIEWED_REVISIONS) {
      const candidate = candidates.get(id);
      const current = select.get(id);
      if (!candidate || !current) throw new Error(`Reviewed prompt target is missing: ${id}`);
      const fields = Object.keys(previousValues);
      if (fields.every(field => current[field] === candidate[field])) continue;
      const delegatedPublishedRevision = id === "pilot-048-transit-007" && current.active === 1;
      if (!fields.every(field => current[field] === previousValues[field])
        || (current.active !== 0 && !delegatedPublishedRevision) || current.served_count !== 0) {
        throw new Error(`Reviewed prompt target is no longer safely staged: ${id}`);
      }
      if (previousValues.prompt_zh) {
        const collision = promptOwner.all(id).find(row => normalize(row.prompt_zh) === normalize(candidate.prompt_zh));
        if (collision) throw new Error(`Reviewed prompt collides with ${collision.id}: ${id}`);
      }
      updates.push({ id, active: current.active, values: Object.fromEntries(fields.map(field => [field, candidate[field]])) });
    }

    for (const { id, active, values } of updates) {
      const setSql = Object.keys(values).map(field => `${field} = @${field}`).join(", ");
      if (db.prepare(`UPDATE practice_questions SET ${setSql} WHERE id = @id AND active = @active AND served_count = 0`)
        .run({ ...values, id, active }).changes !== 1) throw new Error(`Could not safely refine reviewed prompt: ${id}`);
    }
    return updates.length;
  })();
}

export function up(db) {
  return applyReviewedRevisions(db);
}
