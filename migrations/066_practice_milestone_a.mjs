// Milestone A from docs/practice-bank-revision-plan.md (2026-11-15).
// (P1b) Recalibrate nine clear difficulty mislabels. None of these rows belong to
//       the "native" seed group, so the native-seed 50/50 test is unaffected.
//       0350/0352/0454/0457 keep "challenge": modal-perfect / reporting-passive
//       grammar is advanced even though the sentences are short.
// (P2b) Register fixes: 0143 formal->informal (casual invitation); 0874/0875
//       informal->neutral (Not-until inversion is a written pattern).
// (P2a) grammar_point corrections so the labelled target matches the sentence:
//       0438 reference rewritten to the passive the hints already scaffold;
//       0218/0477/0490/0680/0681 relabelled (+ goal/rationale); 0594 relabelled to
//       Result clauses with hints rewritten (its old hints described a different
//       sentence). 0909 is left unchanged (preposition+-ing is genuinely present).
// Content/metadata only; no rows added/removed; served_count untouched; only
// active=1 rows are modified. Idempotent and guarded. Re-export afterwards.

const P = (n) => `practice-202610-${n}`;

const DIFFICULTY_FIXES = [
  { id: P("0217"), before: "easy", after: "challenge" },
  { id: P("0356"), before: "easy", after: "challenge" },
  { id: P("0363"), before: "easy", after: "challenge" },
  { id: P("0513"), before: "easy", after: "challenge" },
  { id: P("0564"), before: "easy", after: "challenge" },
  { id: P("0731"), before: "challenge", after: "standard" },
  { id: P("0778"), before: "challenge", after: "standard" },
  { id: P("0780"), before: "challenge", after: "standard" },
  { id: P("0951"), before: "challenge", after: "standard" },
];

const ANSWER_FIXES = [
  {
    id: P("0438"),
    before: "People long believed this disease was incurable, but the latest research has overturned that conclusion.",
    after: "It has long been believed that this disease was incurable, but the latest research has caused that conclusion to be overturned.",
  },
];

const FIELD_FIXES = [
  // P2b register
  { id: P("0143"), set: { register: ["informal"] } },
  { id: P("0874"), set: { register: ["neutral"] } },
  { id: P("0875"), set: { register: ["neutral"] } },
  // P2a grammar_point relabels (+ aligned goal/rationale/primary_target)
  { id: P("0218"), set: {
    grammar_point: ["Time boundaries"], primary_target: ["time-boundaries"],
    learning_goal: ["Use by, until, and before to express time limits and deadlines."],
    learning_rationale: ["Mastering time boundaries builds accuracy and confidence in real-world English communication."],
  } },
  { id: P("0438"), set: { tense_aspect: ["present perfect", "past simple"] } },
  { id: P("0477"), set: {
    grammar_point: ["Concession"], primary_target: ["concession"],
    learning_goal: ["Express concession using although, though, even though, and however."],
    learning_rationale: ["Mastering concession builds accuracy and confidence in real-world English communication."],
  } },
  { id: P("0490"), set: {
    grammar_point: ["Supplementary relatives"], primary_target: ["supplementary-relatives"],
    learning_goal: ["Use non-defining relative clauses to add extra information about a noun."],
    learning_rationale: ["Mastering supplementary relatives builds accuracy and confidence in real-world English communication."],
  } },
  { id: P("0594"), set: {
    grammar_point: ["Result clauses"], primary_target: ["result-clauses"],
    learning_goal: ["Express results with so + adjective + that and such + noun + that."],
    learning_rationale: ["Mastering result clauses builds accuracy and confidence in real-world English communication."],
  } },
  { id: P("0680"), set: {
    grammar_point: ["Past simple passive"], primary_target: ["past-simple-passive"], voice: ["passive"],
    learning_goal: ["Use the past simple passive to focus on the recipient of an action."],
    learning_rationale: ["Mastering the past simple passive builds accuracy and confidence in real-world English communication."],
  } },
  { id: P("0681"), set: {
    grammar_point: ["Verb + object + infinitive"], primary_target: ["verb-object-infinitive"],
    learning_goal: ["Use verb + object + to-infinitive patterns for causation and permission."],
    learning_rationale: ["Mastering verb + object + infinitive patterns builds accuracy and confidence in real-world English communication."],
  } },
];

const HINT_FIXES = [
  { id: P("0218"), hint: {
    simple: "引出的对象要等到条件成立之后才出现。",
    intermediate: "not appear ... until 表示直到条件成立才出现；until 之后用现在完成时表已完成。",
    complete: "Under + [依据], [单数名词] + will not appear + [地点] + until + [主语] + have been + V-ed",
  } },
  { id: P("0594"), hint: {
    simple: "信号弱到了某种程度，结果没能联系上司机。",
    intermediate: "so + 形容词 + that 引出结果从句；fail to + 动词表示未能做成某事。",
    complete: "The + [名词] + was so + [形容词] + that + [主语] + failed to + [动词短语]",
  } },
];

export function up(db) {
  db.transaction(() => {
    const get = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const setDifficulty = db.prepare("UPDATE practice_questions SET difficulty = ? WHERE id = ?");
    const setAnswer = db.prepare("UPDATE practice_questions SET reference_answer = ? WHERE id = ?");
    const setFields = db.prepare("UPDATE practice_questions SET practice_fields_json = ? WHERE id = ?");
    const setHints = db.prepare("UPDATE practice_questions SET hint_json = ? WHERE id = ?");

    const applyGuarded = (fixes, column, setter) => {
      for (const { id, before, after } of fixes) {
        const row = get.get(id);
        if (!row) throw new Error(`Migration 066: missing Practice row ${id}.`);
        if (row[column] === after) continue;
        if (row[column] !== before) throw new Error(`Migration 066: ${id}/${column} content conflict; expected the reviewed value.`);
        setter.run(after, id);
      }
    };
    applyGuarded(DIFFICULTY_FIXES, "difficulty", setDifficulty);
    applyGuarded(ANSWER_FIXES, "reference_answer", setAnswer);

    for (const { id, set } of FIELD_FIXES) {
      const row = get.get(id);
      if (!row) throw new Error(`Migration 066: missing Practice row ${id}.`);
      const fields = JSON.parse(row.practice_fields_json);
      let changed = false;
      for (const [key, value] of Object.entries(set)) {
        if (JSON.stringify(fields[key]) !== JSON.stringify(value)) { fields[key] = value; changed = true; }
      }
      if (changed) setFields.run(JSON.stringify(fields), id);
    }

    for (const { id, hint } of HINT_FIXES) {
      const row = get.get(id);
      if (!row) throw new Error(`Migration 066: missing Practice row ${id}.`);
      const next = JSON.stringify(hint);
      if (row.hint_json !== next) setHints.run(next, id);
    }
  })();
}

export function down() {
  throw new Error("Migration 066 is irreversible without restoring the pre-migration database backup.");
}