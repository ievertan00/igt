// P0 remediation from the 2026-11-15 per-question semantic review.
// (1) Strip the eight remaining authoring meta-instructions that leaked into
//     learner-facing prompts (the "补充/重点是/以…为话题" wordings missed by 064).
// (2) Correct practice-202610-0378, whose reference said "still unopened" while the
//     prompt says 刚拆封 ("only just opened") — the opposite state. The coupled
//     tense_aspect/voice tags are aligned with the corrected reference.
// Content-only; no rows added/removed; served_count/active untouched. Idempotent
// and guarded. Re-export the canonical bank afterwards so the derived seed views
// and the fresh replay stay aligned.

const P = (n) => `practice-202610-${n}`;

const PROMPT_FIXES = [
  { id: P("0502"), before: "我姐姐住在上海，她是一名医生。（补充居住地点）", after: "我姐姐住在上海，她是一名医生。" },
  { id: P("0503"), before: "这座博物馆建于1920年，目前正在修缮。（补充建造年份）", after: "这座博物馆建于1920年，目前正在修缮。" },
  { id: P("0504"), before: "李女士负责预算，她今天无法参加会议。（补充职责）", after: "李女士负责预算，她今天无法参加会议。" },
  { id: P("0728"), before: "我们已经确定了日期，尚未确定的是地点。（重点是地点）", after: "我们已经确定了日期，尚未确定的是地点。" },
  { id: P("0729"), before: "问题不在预算，而在时间安排。（重点是时间安排）", after: "问题不在预算，而在时间安排。" },
  { id: P("0730"), before: "报告已经写完了，我们现在需要的是你的反馈。（重点是反馈）", after: "报告已经写完了，我们现在需要的是你的反馈。" },
  { id: P("0733"), before: "这本书我读过，那本还没读。（把两本书作为对比话题）", after: "这本书我读过，那本还没读。" },
  { id: P("0735"), before: "至于昨天那份提案，我会在看完数据后回复。（以提案为话题）", after: "至于昨天那份提案，我会在看完数据后回复。" },
];

const ANSWER_FIXES = [
  {
    id: P("0378"),
    before: "The takeaway containers are still unopened on the table, so they must not have had time for lunch.",
    after: "The takeaway containers on the table have only just been opened, so they must not have had time for lunch.",
  },
];

const FIELD_FIXES = [
  { id: P("0378"), set: { tense_aspect: ["present perfect", "modal perfect"], voice: ["active", "passive"] } },
];

export function up(db) {
  db.transaction(() => {
    const get = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const setPrompt = db.prepare("UPDATE practice_questions SET prompt_zh = ? WHERE id = ?");
    const setAnswer = db.prepare("UPDATE practice_questions SET reference_answer = ? WHERE id = ?");
    const updateFields = db.prepare("UPDATE practice_questions SET practice_fields_json = ? WHERE id = ?");

    const applyGuarded = (fixes, column, setter) => {
      for (const { id, before, after } of fixes) {
        const row = get.get(id);
        if (!row) throw new Error(`Migration 065: missing Practice row ${id}.`);
        if (row[column] === after) continue;
        if (row[column] !== before) throw new Error(`Migration 065: ${id}/${column} content conflict; expected the reviewed text.`);
        setter.run(after, id);
      }
    };
    applyGuarded(PROMPT_FIXES, "prompt_zh", setPrompt);
    applyGuarded(ANSWER_FIXES, "reference_answer", setAnswer);

    for (const { id, set } of FIELD_FIXES) {
      const row = get.get(id);
      if (!row) throw new Error(`Migration 065: missing Practice row ${id}.`);
      const fields = JSON.parse(row.practice_fields_json);
      let changed = false;
      for (const [key, value] of Object.entries(set)) {
        if (JSON.stringify(fields[key]) !== JSON.stringify(value)) { fields[key] = value; changed = true; }
      }
      if (changed) updateFields.run(JSON.stringify(fields), id);
    }
  })();
}

export function down() {
  throw new Error("Migration 065 is irreversible without restoring the pre-migration database backup.");
}