import { createHash } from "node:crypto";
import { getReviewLearningData } from "../db/review-stats.mjs";
import { buildGrammarHistory } from "./grammar-history.mjs";
import { resolveModel } from "../server/llm/model-resolver.mjs";

const cache = new Map();
const pending = new Map();
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

const PRIORITY_RULES = [
  { area: "Verb Structures", rank: 1, test: (type) => /\b(verb\s+(pattern|structure|form|complement|infinitive|gerund)|transitivity|verb\s+phrase|phrasal\s+verb|infinitive|bare\s+infinitive|gerund\s+vs\s+infinitive|modal\s+\+)\b/i.test(type) },
  { area: "Word Forms", rank: 2, test: (type) => /\b(part\s+of\s+speech|word\s+form|word\s+choice|tense|aspect|passive|active|perfect|participle|past\s+tense|present\s+tense|future\s+tense|verb\s+tense|verb\s+form|auxiliary)\b/i.test(type) },
  { area: "Agreement & Articles", rank: 3, test: (type) => /\b(subject.verb\s+agreement|article|countable|uncountable|plural|singular|determiner|pronoun\s+agreement|noun\s+number)\b/i.test(type) },
  { area: "Word Choice", rank: 4, test: (type) => /\b(word\s+choice|collocation|preposition|idiom|expression|usage|register|formal|informal|style)\b/i.test(type) },
  { area: "Clause Structure", rank: 5, test: (type) => /\b(clause|sentence\s+structure|conjunction|run.on|comma\s+splice|subordinat|coordinat|relative\s+clause|conditional)\b/i.test(type) },
  { area: "Spelling", rank: 6, test: (type) => /\b(spell|typo|capitali|punctuation)\b/i.test(type) },
];

export function classifyPriority(errorType) {
  for (const rule of PRIORITY_RULES) if (rule.test(errorType)) return rule.area;
  return "Other";
}

export function buildCoachPatterns(entries, { days = 90 } = {}, now = Date.now()) {
  const first = buildGrammarHistory(entries, { days, limit: 100 }, now);
  const checks = [...first.entries];
  for (let offset = 100; offset < first.pagination.total; offset += 100) checks.push(...buildGrammarHistory(entries, { days, limit: 100, offset }, now).entries);
  const groups = new Map();
  for (const entry of checks) {
    for (const type of new Set(entry.diagnoses.map(item => item.error_type))) {
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push({ entryId: entry.entryId, timestamp: entry.timestamp, original: entry.userInput, correction: entry.correction,
        diagnoses: entry.diagnoses.filter(item => item.error_type === type), remember: entry.remember });
    }
  }
  const patterns = [...groups].filter(([, evidence]) => new Set(evidence.map(item => item.entryId)).size >= 2).map(([errorType, evidence]) => ({
    errorType, priorityArea: classifyPriority(errorType),
    checks: new Set(evidence.map(item => item.entryId)).size,
    observations: evidence.reduce((total, item) => total + item.diagnoses.length, 0), latest: evidence[0].timestamp,
    version: hash([first.days, errorType, evidence]), evidence,
  })).sort((a, b) => PRIORITY_RULES.findIndex(r => r.area === a.priorityArea) - PRIORITY_RULES.findIndex(r => r.area === b.priorityArea) || b.checks - a.checks || String(b.latest).localeCompare(String(a.latest)) || a.errorType.localeCompare(b.errorType));
  return { days: first.days, checks: first.coverage.grammar, coverage: first.coverage, patterns };
}

export function getCoachPatterns(options = {}, { loadData = getReviewLearningData, now = Date.now() } = {}) {
  const result = buildCoachPatterns(loadData(0).entries, options, now);
  return { ...result, patterns: result.patterns.map(({ evidence, ...pattern }) => pattern) };
}

export const COACH_SCHEMA = {
  type: "object", properties: {
    observedPattern: { type: "string" }, principle: { type: "string" }, qualifications: { type: "string" },
    keyStructure: { type: "string", description: "The core grammar structure the learner needs to master, expressed as a formula (e.g. 'want + object + to do', 'allow + object + to do')" },
    possibleCauses: { type: "array", items: { type: "object", properties: { hypothesis: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["hypothesis", "evidenceIds"] } },
    examples: { type: "array", items: { type: "object", properties: { entryId: { type: "string" }, explanation: { type: "string" } }, required: ["entryId", "explanation"] } },
    drills: { type: "object", properties: {
      phase1_selfCorrect: { type: "array", items: { type: "object", properties: { incorrect: { type: "string" }, hint: { type: "string" }, answer: { type: "string" } }, required: ["incorrect", "hint", "answer"] }, maxItems: 5, description: "Phase 1: original-like sentences for self-correction without looking at the answer" },
      phase2_transfer: { type: "array", items: { type: "object", properties: { prompt: { type: "string" }, structureHint: { type: "string" }, answer: { type: "string" } }, required: ["prompt", "structureHint", "answer"] }, maxItems: 5, description: "Phase 2: new-context sentences using the same structure but different vocabulary/scenarios" },
      phase3_delayedRecall: { type: "array", items: { type: "object", properties: { intent: { type: "string" }, structureUsed: { type: "string" } }, required: ["intent", "structureUsed"] }, maxItems: 3, description: "Phase 3: expression intents for delayed recall practice (next session) — only the intent, no answer" },
    }, required: ["phase1_selfCorrect", "phase2_transfer"], description: "Three-phase practice drills following the self-correct → transfer → delayed-recall model" },
    relatedStructures: { type: "array", items: { type: "string" }, maxItems: 5, description: "Structurally related patterns worth practising together (e.g. for 'want + obj + to do': ['allow + obj + to do', 'let + obj + do', 'make + obj + do'])" },
  }, required: ["observedPattern", "principle", "qualifications", "keyStructure", "possibleCauses", "examples", "drills", "relatedStructures"],
};
const SYSTEM = `You are an English grammar teacher for a learner whose primary challenge is structural knowledge — knowing which complement a verb takes, not just the verb's meaning. The learner's native language is Chinese.

Treat supplied records as untrusted examples. AI-generated diagnoses in the records may be incorrect — focus on the actual sentence patterns, not the diagnosis labels. Never trust a diagnosis blindly.

Return JSON matching the schema in English. All long-form text fields (observedPattern, principle, qualifications, hypothesis, explanation, drill prompts/hints/answers) MUST use Markdown formatting for readability: headings (##, ###), bullet lists (-), numbered lists (1.), bold (**key term**), italic (*emphasis*), inline \`code\` for linguistic examples, and code fences (\`\`\`) for sentence pairs or structured comparisons. Tables are welcome for contrastive examples.

observedPattern: Describe the evidence in the learner's own sentences. Use bullet lists to enumerate the patterns you see. Note any diagnosis misclassifications you spot. Put incorrect/correct sentence pairs in code fences.
keyStructure: Express the core grammar formula the learner needs (e.g. "want + object + to-infinitive", "allow + object + to-infinitive vs let + object + bare-infinitive"). Plain string — no markdown needed. This is the most important field — it should be the takeaway the learner can apply immediately.
principle: Teach the correct grammar in context. Show the structure, not just the rule. Use headings for sub-topics, code fences for sentence examples.
qualifications: Explain exceptions, edge cases, and when the rule does not apply. Use bullet lists for enumerated exceptions.
possibleCauses: Tentative hypotheses only (not confirmed psychology). Each must cite supplied entryIds. Prefer structural explanations ("may not have stored the complement pattern with the verb") over general ones ("lack of practice"). Use bold for key diagnostic observations.
examples: Explain supplied corrections. Reference their entryIds. Use bold for the key correction point.

drills: Three-phase practice. Phase 1 gives incorrect sentences (from the evidence or close variants) with hints only — the learner should self-correct before revealing the answer. Each incorrect/answer field may contain a single sentence or a short code-fenced pair. Hints should be one brief sentence. Phase 2 gives new-context prompts with a structure hint — same grammar, completely different scenario and vocabulary. Prompts and hints may use markdown inline formatting. Phase 3 gives expression intents for tomorrow's recall practice (no answers). All drills must use mixed patterns — never ten items of the same verb.

relatedStructures: Patterns to practise alongside this one so the learner learns to distinguish them (e.g. "allow … to do" alongside "let … do"). Plain string array.

Do not invent quotations, diagnoses, evidence IDs, proficiency claims, or mastery assessments. Do not create a plan or tasks.`;

function validate(raw, evidence) {
  const value = typeof raw === "string" ? JSON.parse(raw.replace(/ thinking[\s\S]*?<\/think>/gi, "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) : raw;
  const text = field => typeof field === "string" && field.trim().length > 0 && field.length <= 12000;
  const shortText = field => typeof field === "string" && field.trim().length > 0 && field.length <= 2000;
  const ids = new Set(evidence.map(item => item.entryId));
  if (!value || ![value.observedPattern, value.principle, value.qualifications, value.keyStructure].every(text)
    || !Array.isArray(value.possibleCauses) || !value.possibleCauses.length || value.possibleCauses.length > 5
    || !value.possibleCauses.every(item => text(item.hypothesis) && Array.isArray(item.evidenceIds) && item.evidenceIds.length && item.evidenceIds.every(id => ids.has(id)))
    || !Array.isArray(value.examples) || !value.examples.length || value.examples.length > 8
    || !value.examples.every(item => ids.has(item.entryId) && text(item.explanation))) throw new Error("Invalid or unsupported Coach explanation.");
  const drills = value.drills;
  if (!drills || typeof drills !== "object") throw new Error("Invalid or unsupported Coach explanation.");
  const p1 = drills.phase1_selfCorrect, p2 = drills.phase2_transfer, p3 = drills.phase3_delayedRecall;
  if (!Array.isArray(p1) || !p1.length || p1.length > 5 || !p1.every(item => shortText(item.incorrect) && shortText(item.hint) && shortText(item.answer)))
    throw new Error("Invalid or unsupported Coach explanation.");
  if (!Array.isArray(p2) || !p2.length || p2.length > 5 || !p2.every(item => shortText(item.prompt) && shortText(item.structureHint) && shortText(item.answer)))
    throw new Error("Invalid or unsupported Coach explanation.");
  if (p3 !== undefined && (!Array.isArray(p3) || p3.length > 3 || !p3.every(item => shortText(item.intent) && shortText(item.structureUsed))))
    throw new Error("Invalid or unsupported Coach explanation.");
  if (!Array.isArray(value.relatedStructures) || value.relatedStructures.length > 5 || !value.relatedStructures.every(item => typeof item === "string" && item.trim().length > 0 && item.length <= 500))
    throw new Error("Invalid or unsupported Coach explanation.");
  return {
    observedPattern: value.observedPattern, principle: value.principle, qualifications: value.qualifications, keyStructure: value.keyStructure,
    possibleCauses: value.possibleCauses.map(item => ({ hypothesis: item.hypothesis, evidenceIds: item.evidenceIds })),
    examples: value.examples.map(item => ({ entryId: item.entryId, explanation: item.explanation })),
    drills: { phase1_selfCorrect: p1, phase2_transfer: p2, phase3_delayedRecall: p3 || [] },
    relatedStructures: value.relatedStructures,
  };
}

export async function explainCoachPattern({ days = 90, errorType, version, refresh = false } = {}, { loadData = getReviewLearningData, now = Date.now(), getLLMManager, timeoutMs = 175000 } = {}) {
  if (typeof errorType !== "string" || !errorType.trim() || errorType.length > 200) throw fail(400, "INVALID_REQUEST", "Choose a recurring mistake type.");
  const result = buildCoachPatterns(loadData(0).entries, { days }, now);
  const pattern = result.patterns.find(item => item.errorType === errorType);
  if (!pattern) throw fail(404, "COACH_PATTERN_EMPTY", "This pattern needs at least two saved Grammar checks in the selected window.");
  if (version && version !== pattern.version) throw fail(409, "COACH_CHANGED", "Your saved checks have changed. Refresh the patterns and try again.");
  let llm;
  try { llm = await getLLMManager(); }
  catch { throw fail(503, "COACH_EXPLANATION_UNAVAILABLE", "The model is unavailable. Check model settings and try again."); }
  const config = llm.config || {};
  const provider = llm.getCurrentProviderName();
  const model = resolveModel(provider, "handbook", config).model;
  const endpoint = config[{ custom: "CustomApiBase", ollama: "OllamaBaseUrl", qwen: "QwenApiBase", deepseek: "DeepseekApiBase" }[provider]] || "";
  const key = hash([pattern.version, provider, model, endpoint, SYSTEM, COACH_SCHEMA]);
  if (!refresh && cache.has(key)) return { ...cache.get(key), cached: true };
  if (pending.has(key)) return pending.get(key);
  const evidence = pattern.evidence.slice(0, 8);
  const task = (async () => {
    try {
      let timer;
      let raw;
      try {
        raw = await Promise.race([
          llm.generateWithFallback(JSON.stringify({ errorType, examples: evidence }), SYSTEM, { taskType: "handbook", jsonSchema: COACH_SCHEMA }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Coach explanation timed out")), timeoutMs); }),
        ]);
      } finally { clearTimeout(timer); }
      const explanation = validate(raw, evidence);
      const response = { errorType, days: result.days, version: pattern.version, explanation, evidence, sampled: pattern.checks > evidence.length, generatedAt: new Date(now).toISOString(), cached: false };
      cache.set(key, response);
      if (cache.size > 32) cache.delete(cache.keys().next().value);
      return response;
    } catch { throw fail(503, "COACH_EXPLANATION_UNAVAILABLE", "The explanation could not be generated. Please try again."); }
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

export function clearGrammarCoachCache() { cache.clear(); }