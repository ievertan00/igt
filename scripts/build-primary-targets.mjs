// Builds data for migration 053: primary_target / learning_goal / learning_rationale
// for 754 old questions, plus removal of deprecated fields (genre/tone/purpose/meaning_relationship/situation)

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "igt_data.db");
const artifactsDir = path.resolve(__dirname, "..", "artifacts");

const db = new Database(dbPath);

// Grammar point → primary_target (kebab-case)
function gpToTarget(gp) {
  return gp
    .toLowerCase()
    .replace(/[\u2013\u2014\u2015]/g, "-") // normalise en/em dashes
    .replace(/[()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Grammar point → learning_goal (actionable statement)
function gpToGoal(gp, context) {
  const goals = {
    "Present simple for facts": "Use present simple to state timeless facts and truths.",
    "Present continuous for ongoing actions": "Use present continuous to describe actions happening now.",
    "Past simple for completed actions": "Use past simple to narrate completed past events.",
    "For and since with duration": "Use 'for' and 'since' correctly to express duration.",
    "Activities continuing up to now": "Use present perfect continuous to describe activities still in progress.",
    "Focusing on the recipient of an action": "Use passive voice to shift focus onto the action recipient.",
    "Past simple passive": "Form the past simple passive with was/were + past participle.",
    "Reporting passive": "Use reporting passive constructions (is said to, is believed to) for formal attribution.",
    "Active/passive choice": "Choose between active and passive voice based on information focus.",
    "Agent omission": "Omit the agent in passive constructions when the doer is unknown or irrelevant.",
    "Not until fronting": "Use 'Not until' fronting with main-clause inversion for emphasis.",
    "Auxiliary inversion in the main clause": "Apply subject-auxiliary inversion after negative fronting.",
    "Fronting": "Place key information at the front of a sentence for emphasis.",
    "End focus": "Place new or important information at the end of a clause.",
    "Clefts": "Use cleft structures (it is...that, what...is) to highlight specific information.",
    "Statement word order in indirect questions": "Use statement word order in indirect questions.",
    "Indirect questions": "Form indirect questions with statement word order and no auxiliary do/does/did.",
    "Yes/no questions": "Form yes/no questions with subject-auxiliary inversion.",
    "Wh-questions": "Form wh-questions with question word + auxiliary + subject + main verb.",
    "Subject questions": "Form subject questions without auxiliary do/does/did.",
    "Third conditional": "Use third conditional (if + had + past participle, would + have + past participle) for unreal past situations.",
    "Unreal past conditions and results": "Express unreal past conditions using the third conditional pattern.",
    "Mixed-time conditions": "Form mixed conditionals combining past conditions with present results.",
    "Past condition with present result": "Combine a past unreal condition with a present unreal result.",
    "Open future conditions": "Use first conditional (if + present, will + base) for real future possibilities.",
    "General conditions": "Use zero conditional (if + present, present) for general truths.",
    "Counterfactual past": "Express counterfactual past situations with the third conditional.",
    "Possibility": "Express possibility using may, might, and could.",
    "Deduction": "Make logical deductions about the past using must have + past participle.",
    "Obligation": "Express obligation using must and have to in appropriate contexts.",
    "Lack of obligation": "Express lack of obligation using don't have to, needn't, and don't need to.",
    "Permission": "Ask for and grant permission using can, could, and may.",
    "Prohibition": "Express prohibition using mustn't, can't, and not allowed to.",
    "Ability": "Express ability using can, could, and be able to in appropriate time frames.",
    "Advice": "Give advice using should, ought to, and had better.",
    "Willingness": "Express willingness using will, would, and be willing to.",
    "Predictions": "Make predictions using will, going to, and may/might.",
    "Modal passive": "Form modal passive constructions with modal + be + past participle.",
    "Content clauses": "Use that-clauses, wh-clauses, and whether/if-clauses as sentence elements.",
    "Defining relative clauses": "Use defining relative clauses to identify which person or thing.",
    "Defining relatives": "Form defining relative clauses with who, which, that for essential identification.",
    "Supplementary relatives": "Add non-defining relative clauses with commas for extra information.",
    "Reason clauses": "Express reasons using because, since, and as clauses.",
    "Purpose clauses": "Express purpose using to-infinitive, so that, and in order to.",
    "Result clauses": "Express results using so...that and such...that constructions.",
    "Concession": "Express concession using although, though, and even though.",
    "Time clauses": "Use time clauses with when, after, before, until, and as soon as.",
    "Manner clauses": "Describe how things are done using as, as if, and as though.",
    "Comparison clauses": "Make comparisons using as...as, than, and the...the structures.",
    "Equal comparison": "Form equal comparisons with as + adjective/adverb + as.",
    "Shared subject in participial clauses": "Use participial clauses with shared subjects for concise expression.",
    "Having + past participle": "Use 'Having + past participle' to show a completed action before another.",
    "Non-finite adverbials": "Use non-finite clauses as adverbials for time, reason, and manner.",
    "Non-finite noun modifiers": "Use non-finite clauses to modify nouns (reduced relative clauses).",
    "Conjunction_type": "Choose between coordinating, subordinating, and correlative conjunctions.",
    "Coordination": "Join equal elements using coordinating conjunctions (and, but, or).",
    "Pattern changes meaning": "Distinguish meaning changes with to-infinitive vs -ing after remember, forget, try, stop.",
    "Verb + to-infinitive": "Use to-infinitive after verbs that express intention, decision, or expectation.",
    "Verb + -ing": "Use -ing forms after verbs that express likes, dislikes, and completed actions.",
    "Verb + object + infinitive": "Use verb + object + to-infinitive patterns for causation and permission.",
    "Make/let/have/get someone act": "Use causative patterns (make, let, have, get) for causing actions.",
    "Have/get something done": "Use have/get + object + past participle for services done by others.",
    "Two-object patterns": "Use ditransitive patterns with direct and indirect objects.",
    "Multiword verbs": "Use phrasal verbs and prepositional verbs correctly in context.",
    "Collocation": "Use natural word partnerships appropriate to the context.",
    "Word choice": "Select precise vocabulary for the intended meaning and register.",
    "Singular/plural": "Use correct singular and plural noun forms with appropriate determiners.",
    "Countability": "Distinguish countable and uncountable nouns and use appropriate quantifiers.",
    "Articles": "Use a/an, the, and zero article correctly based on noun type and context.",
    "Determiners": "Choose appropriate determiners (some, any, each, every, this, those) for the context.",
    "Quantifiers": "Use quantifiers (much, many, a few, a little) appropriately with countable and uncountable nouns.",
    "Comparative/superlative": "Form comparative and superlative adjectives and adverbs correctly.",
    "Degree": "Use degree modifiers (very, quite, rather, a bit) to adjust intensity.",
    "Modifier position": "Place adjectives and adverbs in correct positions relative to the words they modify.",
    "Adjective/adverb choice": "Choose between adjective and adverb forms based on what is being modified.",
    "Participial adjectives": "Distinguish -ed and -ing participial adjectives (bored vs boring).",
    "Word formation": "Form words correctly using prefixes and suffixes.",
    "Prepositions followed by -ing forms": "Use -ing forms after prepositions in all contexts.",
    "Verb + preposition": "Use correct verb + preposition combinations (depend on, rely on, lead to).",
    "Dependent prepositions": "Use fixed preposition patterns after verbs, adjectives, and nouns.",
    "Pronoun reference": "Ensure pronoun antecedents are clear and unambiguous.",
    "Tactful refusal": "Refuse requests politely using softening expressions.",
    "Polite requesting": "Make polite requests using would, could, and indirect forms.",
    "Diplomatic disagreement": "Express disagreement diplomatically with hedging and softening.",
    "Setting boundaries": "Set personal or professional limits politely and clearly.",
    "Acknowledging responsibility": "Accept responsibility with appropriate expressions (I should have, I admit).",
    "Conventional expressions": "Use fixed expressions appropriate to social situations.",
    "Appropriate offers": "Make offers appropriately using shall, can, and would you like.",
    "Existential there": "Use 'there is/are' to introduce new information about existence or presence.",
    "Dummy it": "Use 'it' as dummy subject for weather, time, distance, and extraposed clauses.",
    "Subject-verb-complement": "Form subject-verb-complement clauses with linking verbs and complements.",
    "Subject-verb-object": "Form subject-verb-object clauses with transitive verbs.",
    "Subject-verb": "Form subject-verb clauses with intransitive verbs.",
    "States": "Use stative verbs correctly (not in continuous form) for states.",
    "Habits": "Express habits using present simple, will, and used to.",
    "Object complements": "Add object complements to describe the resulting state of the object.",
    "Movement": "Use verbs of movement with appropriate prepositions and manner expressions.",
    "Location": "Describe location using prepositions of place and position.",
    "Time boundaries": "Use time expressions and tense to mark temporal boundaries.",
    "Duration": "Express duration using for, since, during, and while.",
    "Completed past": "Distinguish completed past actions from those with present relevance.",
    "Earlier past": "Use past perfect to describe actions completed before another past event.",
    "Present relevance": "Use present perfect to connect past actions to the present.",
    "Continuing duration": "Use present perfect to describe situations continuing from past to present.",
    "Future arrangements": "Use present continuous or be going to for planned future arrangements.",
    "Future intentions": "Express future intentions using will, going to, and planning to.",
    "Remote present/future": "Use past tense forms for remote or hypothetical present/future situations.",
    "Wishes": "Express wishes about the present, past, and future using wish/if only.",
    "Regrets": "Express regrets using wish + past perfect and should have + past participle.",
    "Expressing uncertainty": "Express uncertainty using may, might, could, and hedging expressions.",
    "Negative scope": "Place negation correctly to achieve the intended scope.",
    "Meaning-preserving reformulation": "Reformulate sentences while preserving meaning.",
    "Expansion/compression": "Expand or compress information for clarity and conciseness.",
    "Ellipsis": "Omit recoverable information for conciseness while maintaining clarity.",
    "Parallelism": "Maintain parallel structure in coordinated elements.",
  };
  
  if (goals[gp]) return goals[gp];
  
  // Fallback: generate from grammar point name
  const lower = gp.toLowerCase();
  if (lower.includes("question")) return `Form ${gp.toLowerCase()} with correct word order and auxiliary use.`;
  if (lower.includes("clause")) return `Use ${gp.toLowerCase()} appropriately in sentence construction.`;
  if (lower.includes("verb")) return `Use ${gp.toLowerCase()} patterns correctly in context.`;
  if (lower.includes("passive")) return `Form and use ${gp.toLowerCase()} constructions appropriately.`;
  if (lower.includes("modal")) return `Use ${gp.toLowerCase()} to express appropriate meaning.`;
  if (lower.includes("conditional")) return `Form ${gp.toLowerCase()} sentences with correct tense patterns.`;
  return `Use ${gp} correctly in context.`;
}

// Grammar point → learning_rationale
function gpToRationale(gp, context) {
  const rationaleMap = {
    "For and since with duration": "Clear duration expressions help listeners understand when something started or how long it has lasted.",
    "Activities continuing up to now": "Distinguishing ongoing activities from completed ones avoids misunderstandings in daily conversation.",
    "Past simple passive": "The passive voice shifts focus from the doer to what happened, which is natural when reporting events or problems.",
    "Not until fronting": "Fronting 'Not until' creates emphasis and highlights the critical moment when something changed.",
    "Statement word order in indirect questions": "Using statement order in indirect questions avoids the common error of inverting subject and auxiliary.",
    "Third conditional": "The third conditional allows precise expression of regret and hypothetical past alternatives.",
    "Mixed-time conditions": "Mixed conditionals capture real-life situations where past actions affect present circumstances.",
    "Possibility": "Accurate expression of possibility helps convey uncertainty and alternative outcomes naturally.",
    "Deduction": "Logical deduction expressions let you draw evidence-based conclusions without stating absolute certainty.",
    "Content clauses": "Embedding clauses as objects, subjects, or complements creates more sophisticated and precise sentences.",
    "Defining relative clauses": "Defining relatives provide essential identification, making communication more precise and efficient.",
    "Concession": "Concessive structures acknowledge counterarguments or unexpected outcomes, making speech more balanced.",
    "Pattern changes meaning": "Getting the to-infinitive vs -ing distinction right prevents serious meaning errors in everyday communication.",
    "Quantifiers": "Using the right quantifier with countable/uncountable nouns is a cornerstone of natural, accurate English.",
    "Dependent prepositions": "Fixed preposition patterns are a hallmark of natural English and cannot be guessed from rules alone.",
    "Parallelism": "Parallel structure makes sentences easier to process and sounds more professional in both writing and speech.",
    "Tactful refusal": "Polite refusal strategies maintain relationships while communicating boundaries clearly.",
    "Collocation": "Natural collocations make speech sound fluent rather than translated.",
    "Articles": "Correct article usage is one of the most persistent challenges for learners and signals advanced proficiency.",
    "Present relevance": "The present perfect bridges past events to present situations, a distinction that many languages lack.",
    "Have/get something done": "The causative pattern expresses services arranged by the speaker, common in daily and professional life.",
    "Make/let/have/get someone act": "Causative verbs express nuanced control over others' actions, essential for workplace and social communication.",
  };
  
  if (rationaleMap[gp]) return rationaleMap[gp];
  
  // Fallback
  return `Mastering ${gp.toLowerCase()} builds accuracy and confidence in real-world English communication.`;
}

function main() {
  const questions = db.prepare(`
    SELECT id, prompt_zh, reference_answer, context,
           practice_fields_json
    FROM practice_questions
    WHERE json_extract(practice_fields_json, '$.primary_target') IS NULL
    ORDER BY id
  `).all();

  const updates = {};
  
  for (const q of questions) {
    const pf = JSON.parse(q.practice_fields_json);
    const gp = Array.isArray(pf.grammar_point) ? pf.grammar_point[0] : pf.grammar_point || "";
    
    if (!gp) continue;
    
    updates[q.id] = {
      primary_target: [gpToTarget(gp)],
      learning_goal: [gpToGoal(gp, q.context)],
      learning_rationale: [gpToRationale(gp, q.context)],
    };
  }

  fs.writeFileSync(
    path.resolve(artifactsDir, "audit-primary-targets.json"),
    JSON.stringify(updates, null, 2)
  );
  
  console.log(`Generated primary_target data for ${Object.keys(updates).length} questions`);
  
  db.close();
}

main();