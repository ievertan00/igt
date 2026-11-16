// Post-publication quality remediation from the 2026-11-15 practice-bank evaluation
// (categories A–E). Content and learning-metadata corrections only: no rows are
// added or removed, and served_count / active are never touched. The migration is
// idempotent and guards reviewed text before changing it. Re-export the canonical
// bank afterwards so the derived seed views and the fresh replay stay aligned.

const P = (n) => `practice-202610-${n}`;

// A — remove authoring meta-instructions that leaked into learner-facing prompts.
const PROMPT_FIXES = [
  { id: P("0734"), before: "价格我们可以再谈，但质量不能妥协。（以价格和质量为对比话题）", after: "价格我们可以再谈，但质量不能妥协。" },
  { id: P("0738"), before: "是小李修好了电脑，不是我。（强调执行者）", after: "是小李修好了电脑，不是我。" },
  { id: P("0739"), before: "让我担心的是时间安排，而不是费用。（强调担心的对象）", after: "让我担心的是时间安排，而不是费用。" },
  { id: P("0740"), before: "直到收到确认邮件，我才取消了旧预订。（强调时间界限）", after: "直到收到确认邮件，我才取消了旧预订。" },
  { id: P("0762"), before: "正在门外等候的顾客需要帮助。（简洁表达等候信息）", after: "正在门外等候的顾客需要帮助。" },
  { id: P("0763"), before: "在昨天会议上提出的建议已被采纳。（简洁表达提出信息）", after: "在昨天会议上提出的建议已被采纳。" },
  { id: P("0764"), before: "已经完成培训的员工可以使用设备。（明确表达完成条件）", after: "已经完成培训的员工可以使用设备。" },
];

// C — difficulty calibration: a simple compound sentence with basic hedging is not challenge.
const DIFFICULTY_FIXES = [
  { id: P("0779"), before: "challenge", after: "standard" },
];

// D — reference-answer naturalness ("but even more unacceptably" is awkward English).
const ANSWER_FIXES = [
  {
    id: P("0787"),
    before: "I would like to apologise on behalf of my team for our performance in the last delivery — not only because we missed the deadline, but even more unacceptably, the content we delivered actually contained basic errors that should have been caught during the internal testing phase.",
    after: "I would like to apologise on behalf of my team for our performance in the last delivery — not only because we missed the deadline, but even more so because the content we delivered actually contained basic errors that should have been caught during the internal testing phase.",
  },
];

// B and D(register) — precise learning-metadata corrections. `set` replaces a whole
// dimension array; `remove` drops a dimension that does not apply to the sentence.
const FIELD_FIXES = [
  // Subject questions are not relative clauses. 0241 is a cleft that genuinely
  // contains a relative clause, so only its spurious "conditional" label is removed.
  { id: P("0237"), remove: ["clause_type"] },
  { id: P("0239"), remove: ["clause_type"] },
  { id: P("0240"), remove: ["clause_type"] },
  { id: P("0241"), set: { clause_type: ["relative"] } },
  { id: P("0242"), remove: ["clause_type"] },
  // "Let's meet ..." is a simple imperative; it carries no past tense.
  { id: P("0967"), set: { sentence_structure: ["simple"] }, remove: ["tense_aspect"] },
  { id: P("0359"), set: { sentence_structure: ["simple"] } },
  // "had better" is not past tense; only the future reference remains.
  { id: P("0362"), set: { tense_aspect: ["future"] } },
  // Normalize nonstandard tense labels to the canonical dimension vocabulary.
  { id: P("0997"), set: { tense_aspect: ["past simple", "present simple"] } },
  { id: P("0969"), set: { tense_aspect: ["present simple"] } },
  // Challenge rows whose reference answer is not a simple sentence.
  { id: P("0367"), set: { sentence_structure: ["compound"] } },
  { id: P("0394"), set: { sentence_structure: ["complex"] } },
  { id: P("0396"), set: { sentence_structure: ["complex"] } },
  { id: P("0397"), set: { sentence_structure: ["complex"] } },
  { id: P("0419"), set: { sentence_structure: ["complex"] } },
  { id: P("0420"), set: { sentence_structure: ["complex"] } },
  { id: P("0477"), set: { sentence_structure: ["complex"] } },
  { id: P("0734"), set: { sentence_structure: ["compound"] } },
  // "Not until" inversion is a written/formal pattern, not casual speech.
  { id: P("0870"), set: { register: ["neutral"] } },
];

// E — merge true synonym labels. The "(complex)" suffix is functional (Handbook
// targeting appends it automatically) and is deliberately preserved.
const GRAMMAR_POINT_MERGES = {
  "Comparative adjective": "Comparative adjectives",
  "Defining relative clause": "Defining relative clauses",
  "Defining relatives": "Defining relative clauses",
  "Yes/no question": "Yes/no questions",
};

// E — replace boilerplate "Use X correctly in context." goals with meaningful,
// grammar-point-specific objectives. Complex variants reuse the reviewed base goal.
const GOAL_REWRITES = {
  "Acknowledging responsibility (complex)": "Accept responsibility with appropriate expressions (I should have, I admit).",
  "Agent omission (complex)": "Omit the agent in passive constructions when the doer is unknown or irrelevant.",
  "Articles (complex)": "Use a/an, the, and zero article correctly based on noun type and context.",
  "Auxiliary choice": "Choose the correct auxiliary (do, be, have, modals) for negatives and questions.",
  "Base verb after demands and recommendations": "Use the base verb (mandative subjunctive) after demand, require, suggest, recommend, insist, and propose.",
  "Clefts (complex)": "Use cleft structures (it is...that, what...is) to highlight specific information.",
  "Concession (complex)": "Express concession using although, though, and even though.",
  "Continuing duration (complex)": "Use present perfect to describe situations continuing from past to present.",
  "Conventional expressions (complex)": "Use fixed expressions appropriate to social situations.",
  "Countability (complex)": "Distinguish countable and uncountable nouns and use appropriate quantifiers.",
  "Counterfactual past (complex)": "Express counterfactual past situations with the third conditional.",
  "Deduction (complex)": "Make logical deductions about the past using must have + past participle.",
  "Diplomatic disagreement (complex)": "Express disagreement diplomatically with hedging and softening.",
  "Earlier past (complex)": "Use past perfect to describe actions completed before another past event.",
  "End focus (complex)": "Place new or important information at the end of a clause.",
  "Expansion/compression (complex)": "Expand or compress information for clarity and conciseness.",
  "Expressing uncertainty (complex)": "Express uncertainty using may, might, could, and hedging expressions.",
  "Fronting (complex)": "Place key information at the front of a sentence for emphasis.",
  "Future arrangements (complex)": "Use present continuous or be going to for planned future arrangements.",
  "General conditions (complex)": "Use zero conditional (if + present, present) for general truths.",
  "Have/get something done (complex)": "Use have/get + object + past participle for services done by others.",
  "Lack of obligation (complex)": "Express lack of obligation using don't have to, needn't, and don't need to.",
  "Make/let/have/get someone act (complex)": "Use causative patterns (make, let, have, get) for causing actions.",
  "Meaning-preserving reformulation (complex)": "Reformulate sentences while preserving meaning.",
  "Means": "Express means and instruments using by, with, on foot, and use.",
  "Mixed-time conditions (complex)": "Form mixed conditionals combining past conditions with present results.",
  "Multiword verbs": "Use common phrasal verbs with the correct particle and object placement.",
  "Negative scope (complex)": "Place negation correctly to achieve the intended scope.",
  "Non-finite adverbials (complex)": "Use non-finite clauses as adverbials for time, reason, and manner.",
  "Non-finite noun modifiers (complex)": "Use non-finite clauses to modify nouns (reduced relative clauses).",
  "Obligation (complex)": "Express obligation using must and have to in appropriate contexts.",
  "Ongoing events": "Use present and past continuous for actions in progress at a specific time.",
  "Open future conditions (complex)": "Use first conditional (if + present, will + base) for real future possibilities.",
  "Parallelism (complex)": "Maintain parallel structure in coordinated elements.",
  "Pattern changes meaning (complex)": "Distinguish meaning changes with to-infinitive vs -ing after remember, forget, try, stop.",
  "Possessives": "Use possessive 's, possessive pronouns, and of-patterns to show ownership.",
  "Possibility (complex)": "Express possibility using may, might, and could.",
  "Present relevance (complex)": "Use present perfect to connect past actions to the present.",
  "Pronoun reference (complex)": "Ensure pronoun antecedents are clear and unambiguous.",
  "Regrets (complex)": "Express regrets using wish + past perfect and should have + past participle.",
  "Remote present/future (complex)": "Use past tense forms for remote or hypothetical present/future situations.",
  "Setting boundaries (complex)": "Set personal or professional limits politely and clearly.",
  "Subject–verb": "Match the verb to its subject in number and person in basic sentence patterns.",
  "Subject–verb–complement": "Use linking verbs (be, sound, smell, remain) with adjective complements.",
  "Subject–verb–object": "Form subject–verb–object sentences with correct word order and transitive verbs.",
  "Tactful refusal (complex)": "Refuse requests politely using softening expressions.",
  "Verb + object + infinitive (complex)": "Use verb + object + to-infinitive patterns for causation and permission.",
  "Verb + preposition (complex)": "Use correct verb + preposition combinations (depend on, rely on, lead to).",
  "Willingness (complex)": "Express willingness using will, would, and be willing to.",
  "Wishes (complex)": "Express wishes about the present, past, and future using wish/if only.",
  "Word choice (complex)": "Select precise vocabulary for the intended meaning and register.",
};

const BOILERPLATE_GOAL = /^Use .+ correctly in context\.$/;

export function up(db) {
  db.transaction(() => {
    const get = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const setPrompt = db.prepare("UPDATE practice_questions SET prompt_zh = ? WHERE id = ?");
    const setAnswer = db.prepare("UPDATE practice_questions SET reference_answer = ? WHERE id = ?");
    const setDifficulty = db.prepare("UPDATE practice_questions SET difficulty = ? WHERE id = ?");
    const setFields = db.prepare("UPDATE practice_questions SET practice_fields_json = ? WHERE id = ?");

    const applyGuarded = (fixes, column, setter) => {
      for (const { id, before, after } of fixes) {
        const row = get.get(id);
        if (!row) throw new Error(`Migration 064: missing Practice row ${id}.`);
        if (row[column] === after) continue;
        if (row[column] !== before) throw new Error(`Migration 064: ${id}/${column} content conflict; expected the reviewed text.`);
        setter.run(after, id);
      }
    };
    applyGuarded(PROMPT_FIXES, "prompt_zh", setPrompt);
    applyGuarded(ANSWER_FIXES, "reference_answer", setAnswer);
    applyGuarded(DIFFICULTY_FIXES, "difficulty", setDifficulty);

    for (const { id, set = {}, remove = [] } of FIELD_FIXES) {
      const row = get.get(id);
      if (!row) throw new Error(`Migration 064: missing Practice row ${id}.`);
      const fields = JSON.parse(row.practice_fields_json);
      let changed = false;
      for (const key of remove) if (key in fields) { delete fields[key]; changed = true; }
      for (const [key, value] of Object.entries(set)) {
        if (JSON.stringify(fields[key]) !== JSON.stringify(value)) { fields[key] = value; changed = true; }
      }
      if (changed) setFields.run(JSON.stringify(fields), id);
    }

    // E applies only to learner-facing (active) questions. Inactive review drafts
    // are staged with guarded content by migrations 057–059, which are replayed
    // literally (not fast-forwarded); rewriting their labels would break a fresh
    // rebuild. They are not served, so leaving their metadata untouched is safe.
    for (const row of db.prepare("SELECT id, practice_fields_json FROM practice_questions WHERE active = 1").all()) {
      const fields = JSON.parse(row.practice_fields_json);
      let changed = false;
      if (Array.isArray(fields.grammar_point)) {
        const merged = fields.grammar_point.map((label) => GRAMMAR_POINT_MERGES[label] ?? label);
        if (JSON.stringify(merged) !== JSON.stringify(fields.grammar_point)) { fields.grammar_point = merged; changed = true; }
      }
      const point = fields.grammar_point?.[0];
      const goal = fields.learning_goal?.[0];
      if (point && GOAL_REWRITES[point] && typeof goal === "string" && BOILERPLATE_GOAL.test(goal)) {
        fields.learning_goal = [GOAL_REWRITES[point]];
        changed = true;
      }
      if (changed) setFields.run(JSON.stringify(fields), row.id);
    }
  })();
}

export function down() {
  throw new Error("Migration 064 is irreversible without restoring the pre-migration database backup.");
}