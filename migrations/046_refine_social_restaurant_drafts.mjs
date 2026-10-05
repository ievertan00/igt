import { ENRICHMENT_PILOT_045 } from "../lib/features/practice/enrichment-pilot-045.mjs";

export const PRACTICE_DRAFT_REVISIONS_046 = [
  {
    id: "pilot-045-social-007",
    before: {
      prompt_zh: "到家后给我发个消息。",
      reference_answer: "Send me a message when you get home.",
      practice_fields_json: JSON.stringify({
        primary_target: ["message-after-arrival"],
        learning_goal: ["Ask someone to message after reaching home."],
        learning_rationale: ["This common social request combines a simple action with a clear time condition."],
        register: ["informal"], mood: ["imperative"], "clause_type": ["time clause"],
        grammar_point: ["Imperative requests", "When clauses for future time"],
      }),
      hint_json: JSON.stringify({
        simple: "请对方到家后联系你。",
        intermediate: "用祈使句提出请求；when 从句说明何时发消息。",
        complete: "[动词] me a message when you [到达地点].",
      }),
    },
  },
  {
    id: "pilot-045-social-010",
    before: {
      prompt_zh: "午饭后我可以过去。",
      reference_answer: "I can come over after lunch.",
      practice_fields_json: JSON.stringify({
        primary_target: ["state-availability-window"],
        learning_goal: ["State a simple time window when the speaker can visit."],
        learning_rationale: ["A concise availability statement supports everyday scheduling without overexplaining."],
        register: ["informal"], mood: ["possibility"],
        grammar_point: ["Can for availability", "After + time expression"],
      }),
      hint_json: JSON.stringify({
        simple: "说明午饭之后可以去对方那里。",
        intermediate: "can 表示有空或可行；after + 时间表达先后。",
        complete: "I can come over after [时间].",
      }),
    },
  },
  {
    id: "pilot-045-restaurants-010",
    before: { reference_answer: "The menu says the lunch special comes with a side. Could you tell me what the choices are?" },
  },
];

const CONTENT_FIELDS = [
  "prompt_zh", "reference_answer", "difficulty", "context",
  "practice_fields_json", "hint_json", "generated_by",
];

export function up(db) {
  return db.transaction(() => {
    const candidates = new Map(ENRICHMENT_PILOT_045.map(row => [row.id, row]));
    const select = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const findPrompt = db.prepare("SELECT id FROM practice_questions WHERE prompt_zh = ? AND id <> ?");
    const pending = [];

    for (const revision of PRACTICE_DRAFT_REVISIONS_046) {
      const candidate = candidates.get(revision.id);
      const current = select.get(revision.id);
      if (!candidate || !current) throw new Error(`Practice draft revision target is missing: ${revision.id}`);
      const isCurrent = CONTENT_FIELDS.every(key => current[key] === candidate[key]);
      if (isCurrent) continue;
      if (current.active !== 0 || current.served_count !== 0) {
        throw new Error(`Practice draft revision target is no longer safely staged: ${revision.id}`);
      }
      const isPrior = CONTENT_FIELDS.every(key => current[key] === (Object.hasOwn(revision.before, key)
        ? revision.before[key]
        : candidate[key]));
      if (!isPrior) throw new Error(`Practice draft revision content conflict: ${revision.id}`);
      if (revision.before.prompt_zh && findPrompt.get(candidate.prompt_zh, candidate.id)) {
        throw new Error(`Practice draft revised prompt collision: ${revision.id}`);
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
