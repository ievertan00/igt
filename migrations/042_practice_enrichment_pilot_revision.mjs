import { ENRICHMENT_PILOT_041 } from "../lib/features/practice/enrichment-pilot-041.mjs";

const PRIOR = {
  id: "pilot-041-health-009",
  prompt_zh: "如果这个剂量让你不舒服，先别再服，打电话给诊所问清楚。",
  reference_answer: "If this dose makes you feel unwell, don't take any more until you've checked with the clinic.",
  difficulty: "challenge",
  context: "health-pharmacy",
  practice_fields_json: JSON.stringify({
    primary_target: ["conditional-prohibition-until"],
    learning_goal: ["Give a conditional instruction with a temporary prohibition and a clear endpoint."],
    learning_rationale: ["The learner must preserve the condition, prohibition, and the point at which it ends."],
    register: ["neutral"], mood: ["conditional", "imperative"],
    grammar_point: ["If clause", "Negative imperative", "Until clause"],
  }),
  hint_json: JSON.stringify({
    simple: "不舒服时暂停继续服用，并先向诊所确认。",
    intermediate: "if 从句说明条件，祈使句表达指示；until 从句标出暂停的终点。",
    complete: "If [条件], don't [动作] until [完成确认].",
  }),
};

export function up(db) {
  return db.transaction(() => {
    const revised = ENRICHMENT_PILOT_041.find(row => row.id === PRIOR.id);
    if (!revised) throw new Error(`Revised pilot row is missing: ${PRIOR.id}`);
    const select = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const current = select.get(PRIOR.id);
    if (!current) throw new Error(`Practice pilot revision target is missing: ${PRIOR.id}`);
    const fields = ["prompt_zh", "reference_answer", "difficulty", "context", "practice_fields_json", "hint_json"];
    const isPrior = fields.every(key => current[key] === PRIOR[key]);
    const isCurrent = fields.every(key => current[key] === revised[key]);
    if (isCurrent) return 0; // The current export may have restored the revised row before this migration.
    if (current.active !== 0 || current.served_count !== 0) {
      throw new Error(`Practice pilot revision target is no longer safely staged: ${PRIOR.id}`);
    }
    if (!isPrior) throw new Error(`Practice pilot revision content conflict: ${PRIOR.id}`);
    if (db.prepare("SELECT id FROM practice_questions WHERE prompt_zh = ? AND id <> ?").get(revised.prompt_zh, revised.id)) {
      throw new Error(`Practice pilot revised prompt collision: ${PRIOR.id}`);
    }

    db.prepare(`UPDATE practice_questions SET prompt_zh = ?, reference_answer = ?, difficulty = ?,
      practice_fields_json = ?, hint_json = ? WHERE id = ? AND active = 0 AND served_count = 0`)
      .run(revised.prompt_zh, revised.reference_answer, revised.difficulty,
        revised.practice_fields_json, revised.hint_json, revised.id);
    return 1;
  })();
}
