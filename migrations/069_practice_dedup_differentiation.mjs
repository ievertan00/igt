// Milestone D (P2c) from docs/practice-bank-revision-plan.md: differentiate six
// near-duplicate items by rewriting one of each pair into a distinct scenario while
// preserving the grammar focus, register and difficulty. Prompts, references and
// progressive hints are updated together; coupled metadata (structure/tense/context)
// is aligned with the new sentence. 0454/0455 are deliberately NOT changed: they form
// a minimal pair contrasting present vs perfect infinitive after the reporting
// passive. Idempotent and guarded; re-export afterwards.

const P = (n) => `practice-202610-${n}`;

const ROWS = [
  {
    id: P("0268"),
    promptBefore: "看那些乌云，马上就要下大雨了。",
    promptAfter: "看看时间，我们开会要迟到了。",
    answerBefore: "Look at those dark clouds — it is going to rain heavily soon.",
    answerAfter: "Look at the time — we're going to be late for the meeting.",
    contextAfter: "work",
    fields: { sentence_structure: ["compound"], tense_aspect: ["future"], non_finite: ["infinitive"], situation: ["work-study"] },
    hint: {
      simple: "有眼前的迹象支持这个预测。",
      intermediate: "有迹象的预测常用 be going to。",
      complete: "Look at [迹象] — [主语] + is/are going to + V + [结果]",
    },
  },
  {
    id: P("0330"),
    promptBefore: "所有访客必须在入口处登记。",
    promptAfter: "所有员工必须在周五前提交安全培训记录。",
    answerBefore: "All visitors must register at the entrance.",
    answerAfter: "All employees must submit their safety training records by Friday.",
    fields: {},
    hint: {
      simple: "说的是规定要求。",
      intermediate: "must + V 表示强制性义务。",
      complete: "[主语] + must + V + [对象] + by [期限]",
    },
  },
  {
    id: P("0462"),
    promptBefore: "我上周去修了电脑。",
    promptAfter: "我上周请人把车洗了。",
    answerBefore: "I had my computer repaired last week.",
    answerAfter: "I got my car washed last week.",
    fields: {},
    hint: {
      simple: "别人洗，不是你亲自动手。",
      intermediate: "get + 对象 + V3 表示安排别人做（与 have 同义）。",
      complete: "[主语] + got + [对象] + V3 + [时间]",
    },
  },
  {
    id: P("0776"),
    promptBefore: "谢谢邀请，但我那天已经有其他安排了。",
    promptAfter: "谢谢您的邀请，但我那天要出差，恐怕无法出席。",
    answerBefore: "Thank you for the invitation, but I'm afraid I already have other plans that day.",
    answerAfter: "Thank you for the invitation, but I'm afraid I'll be away on business that day.",
    fields: { sentence_structure: ["compound-complex"], clause_type: ["content clause"], tense_aspect: ["future"] },
    hint: {
      simple: "先感谢再拒绝，保持礼貌。",
      intermediate: "Thank you for... but I'm afraid... 是委婉拒绝的结构。",
      complete: "Thank you for + [邀请内容], but I'm afraid + [委婉理由]",
    },
  },
  {
    id: P("0835"),
    promptBefore: "我觉得学英语口语很难。",
    promptAfter: "我发现要在这么短的时间内完成几乎不可能。",
    answerBefore: "I find it difficult to learn spoken English.",
    answerAfter: "I find it almost impossible to finish in such a short time.",
    fields: {},
    hint: {
      simple: "表达个人感受，不逐字翻译\"觉得难\"。",
      intermediate: "find it + 形容词 + to V 是自然表达。",
      complete: "[主语] + find it + [形容词] + to V + [具体内容]",
    },
  },
  {
    id: P("0957"),
    promptBefore: "我对花生过敏，这道汤里含有花生吗？",
    promptAfter: "我对海鲜过敏，这道菜里有虾吗？",
    answerBefore: "I'm allergic to peanuts. Does this soup contain any?",
    answerAfter: "I'm allergic to seafood. Does this dish contain any shrimp?",
    fields: { sentence_structure: ["compound"] },
    hint: {
      simple: "说明海鲜过敏，并询问菜里有没有虾。",
      intermediate: "用 be allergic to 表达过敏；用 Does ... contain...? 提问。",
      complete: "I'm allergic to [食材]. Does this [菜品] contain any [具体食材]?",
    },
  },
];

export function up(db) {
  db.transaction(() => {
    const get = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const setPrompt = db.prepare("UPDATE practice_questions SET prompt_zh = ? WHERE id = ?");
    const setAnswer = db.prepare("UPDATE practice_questions SET reference_answer = ? WHERE id = ?");
    const setContext = db.prepare("UPDATE practice_questions SET context = ? WHERE id = ?");
    const setFields = db.prepare("UPDATE practice_questions SET practice_fields_json = ? WHERE id = ?");
    const setHints = db.prepare("UPDATE practice_questions SET hint_json = ? WHERE id = ?");

    for (const row of ROWS) {
      const existing = get.get(row.id);
      if (!existing) throw new Error(`Migration 069: missing Practice row ${row.id}.`);

      if (existing.prompt_zh !== row.promptAfter) {
        if (existing.prompt_zh !== row.promptBefore) throw new Error(`Migration 069: ${row.id} prompt conflict.`);
        setPrompt.run(row.promptAfter, row.id);
      }
      if (existing.reference_answer !== row.answerAfter) {
        if (existing.reference_answer !== row.answerBefore) throw new Error(`Migration 069: ${row.id} answer conflict.`);
        setAnswer.run(row.answerAfter, row.id);
      }
      if (row.contextAfter && existing.context !== row.contextAfter) setContext.run(row.contextAfter, row.id);

      const fields = JSON.parse(existing.practice_fields_json);
      let changed = false;
      for (const [key, value] of Object.entries(row.fields)) {
        if (JSON.stringify(fields[key]) !== JSON.stringify(value)) { fields[key] = value; changed = true; }
      }
      if (changed) setFields.run(JSON.stringify(fields), row.id);

      const nextHint = JSON.stringify(row.hint);
      if (existing.hint_json !== nextHint) setHints.run(nextHint, row.id);
    }
  })();
}

export function down() {
  throw new Error("Migration 069 is irreversible without restoring the pre-migration database backup.");
}