import { ENRICHMENT_PILOT_041 } from "../lib/features/practice/enrichment-pilot-041.mjs";

export const PILOT_REVISIONS_043 = [
  {
    id: "pilot-041-health-002",
    before: {
      reference_answer: "The label says to take it after a meal, but I can't remember whether I took it earlier.",
      hint_json: JSON.stringify({
        simple: "转述药盒指示，再说明自己不确定之前是否服过。",
        intermediate: "remember 后可接 whether 引导的从句；从句使用陈述语序。",
        complete: "The label says to [指示], but I can't remember whether I [过去动作].",
      }),
    },
  },
  { id: "pilot-041-health-005", before: { difficulty: "challenge" } },
  {
    id: "pilot-041-health-009",
    before: {
      prompt_zh: "诊所发短信让我周五前确认复诊，否则他们会把时段让给别人。",
      reference_answer: "The clinic texted to say I need to confirm my follow-up by Friday; otherwise, they'll give the slot to someone else.",
      hint_json: JSON.stringify({
        simple: "复诊需要在周五前确认；不确认的话，时段会给别人。",
        intermediate: "by + 时间表达截止点；otherwise 引出未做到时的后果。",
        complete: "[机构] texted to say I need to [动作] by [期限]; otherwise, [后果].",
      }),
    },
  },
  {
    id: "pilot-041-health-010",
    before: {
      reference_answer: "I was given a new medicine at my last follow-up, and I still have some of the old one left. I'd like to check what I should do with it.",
    },
  },
  {
    id: "pilot-041-services-003",
    before: {
      reference_answer: "I've sent the video of the fault, and customer service said they'd pass it on to the repairs team.",
    },
  },
  {
    id: "pilot-041-services-005",
    before: {
      reference_answer: "The door that was repaired last week has jammed again, and it makes a noise when I open it this time.",
      hint_json: JSON.stringify({
        simple: "门上周修过；今天故障复发，并多了开门异响。",
        intermediate: "用 that/which 从句说明是哪扇门；again 标出复发。",
        complete: "The [物品] that was [过去分词] [时间] has [故障] again, and [补充症状].",
      }),
    },
  },
  {
    id: "pilot-041-services-007",
    before: {
      reference_answer: "Does the quote include parts and labour, or is it just for the call-out?",
    },
  },
  { id: "pilot-041-services-009", before: { difficulty: "standard" } },
  { id: "pilot-041-services-010", before: { difficulty: "standard" } },
];

const CONTENT_FIELDS = [
  "prompt_zh", "reference_answer", "difficulty", "context",
  "practice_fields_json", "hint_json", "generated_by",
];

export function up(db) {
  return db.transaction(() => {
    const candidates = new Map(ENRICHMENT_PILOT_041.map(row => [row.id, row]));
    const select = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const findPrompt = db.prepare("SELECT id FROM practice_questions WHERE prompt_zh = ? AND id <> ?");
    const pending = [];

    for (const revision of PILOT_REVISIONS_043) {
      const candidate = candidates.get(revision.id);
      const current = select.get(revision.id);
      if (!candidate || !current) throw new Error(`Practice pilot revision target is missing: ${revision.id}`);
      const isCurrent = CONTENT_FIELDS.every(key => current[key] === candidate[key]);
      if (isCurrent) continue; // Fresh reconstruction may already contain revised export data.
      if (current.active !== 0 || current.served_count !== 0) {
        throw new Error(`Practice pilot revision target is no longer safely staged: ${revision.id}`);
      }
      const isPrior = CONTENT_FIELDS.every(key => current[key] === (Object.hasOwn(revision.before, key)
        ? revision.before[key]
        : candidate[key]));
      if (!isPrior) throw new Error(`Practice pilot revision content conflict: ${revision.id}`);
      if (revision.before.prompt_zh && findPrompt.get(candidate.prompt_zh, candidate.id)) {
        throw new Error(`Practice pilot revised prompt collision: ${revision.id}`);
      }
      pending.push({ candidate, revision });
    }

    for (const { candidate, revision } of pending) {
      const fields = Object.keys(revision.before);
      const setSql = fields.map(field => `${field} = @${field}`).join(", ");
      db.prepare(`UPDATE practice_questions SET ${setSql} WHERE id = @id AND active = 0 AND served_count = 0`)
        .run({ ...Object.fromEntries(fields.map(field => [field, candidate[field]])), id: candidate.id });
    }
    return pending.length;
  })();
}
