// LLM-as-judge: blind pairwise comparison with position swap. Each pair is
// judged twice (A-first and B-first); only position-consistent verdicts count
// as wins, everything else is a tie. The judge never sees variant names.
export const RUBRICS = {
  grammar: [
    ["correction_accuracy", "Every objective error is fixed with the smallest necessary edits; no new errors, no meaning or fact changes, no over-correction of acceptable usage."],
    ["completeness", "The correction covers the WHOLE passage (every sentence/list item), not just a fragment; unchanged text is preserved."],
    ["refine_quality", "The natural alternative is fluent, idiomatic, meaning-preserving, and genuinely different from a mere correction."],
    ["why_quality", "Each edit is justified with a concrete, non-circular reason tied to this text; optional style changes are labeled optional; confusing alternatives are distinguished."],
    ["tip_usefulness", "The remember tip is a short, transferable self-check the learner can apply to other sentences."],
  ],
  ask: [
    ["answer_quality", "Correct, sufficiently deep, well-organized explanation with accurate examples; no factual or grammatical misinformation."],
    ["learner_fit", "Appropriate for the learner's level; clear progression from rule to examples; actionable rather than encyclopedic."],
    ["language_compliance", "Explanations follow the requested response language while English examples/terms stay in English; the Chinese note title rule is respected."],
    ["metadata_quality", "Title is specific and memorable; tags are broad reusable topics; category fits; related questions are genuinely useful next steps."],
    ["format_readability", "Readable structure without markdown tables; focused length, no padding or repetition."],
  ],
  coach: [
    ["evidence_fidelity", "Claims and quotations trace to the supplied records with correct citations; no invented evidence, no corrected text quoted as an error, retries not treated as recurrence."],
    ["diagnostic_accuracy", "Error classification, rule mapping and grammar explanations are linguistically correct; severity and mastery labels are justified."],
    ["depth_integration", "Recurring patterns, root causes, knowledge map and dependencies are integrated and insightful rather than a flat error inventory."],
    ["boundary_compliance", "No overclaimed mastery from AI corrections, no invented scores/CEFR, missing evidence disclosed, no study plan or drills in recommendations."],
    ["readability", "Well-structured, professional, encouraging tone; tables and prose are readable in the requested language."],
  ],
};

export const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    dimensions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          winner: { type: "string", enum: ["1", "2", "tie"] },
          reason: { type: "string" },
        },
        required: ["name", "winner", "reason"],
      },
    },
    overall: { type: "string", enum: ["1", "2", "tie"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["dimensions", "overall", "confidence"],
};

export function buildJudgePrompt({ target, instruction, input, output1, output2 }) {
  const rubric = RUBRICS[target].map(([name, description]) => `- ${name}: ${description}`).join("\n");
  return `You are a strict, impartial evaluator of an English-learning tool's output quality. Compare two responses to the SAME task and decide which is better for the learner.

Task: ${instruction}

Learner input / evidence context:
<<<INPUT
${input}
INPUT

Response 1:
<<<RESPONSE_1
${output1}
RESPONSE_1

Response 2:
<<<RESPONSE_2
${output2}
RESPONSE_2

Rubric dimensions:
${rubric}

Rules:
- Judge ONLY quality against the rubric. Ignore length unless padding hurts quality. Ignore formatting flourishes that do not aid learning.
- A response that fails the task contract (wrong language, missing required parts, invented evidence, truncated output) loses badly on the affected dimensions.
- If both are equally good or equally bad on a dimension, use "tie". Do not force a winner.
- For each dimension give winner "1", "2" or "tie" plus one short sentence of concrete evidence.
- overall must reflect the rubric-weighted judgment, not a single dimension.
Return JSON only: {"dimensions":[{"name":"...","winner":"1|2|tie","reason":"..."}],"overall":"1|2|tie","confidence":"low|medium|high"}`;
}

export function parseJudgeResponse(raw) {
  const cleaned = String(raw)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const value = JSON.parse(cleaned);
  if (!["1", "2", "tie"].includes(value.overall)) throw new Error("judge overall invalid");
  if (!Array.isArray(value.dimensions)) throw new Error("judge dimensions missing");
  for (const item of value.dimensions) {
    if (!["1", "2", "tie"].includes(item.winner)) throw new Error(`judge winner invalid for ${item.name}`);
  }
  return value;
}

async function judgeOnce({ manager, target, instruction, input, output1, output2 }) {
  const prompt = buildJudgePrompt({ target, instruction, input, output1, output2 });
  const raw = await manager.generateWithFallback("Evaluate the two responses now.", prompt, {
    taskType: "handbook",
    jsonSchema: JUDGE_SCHEMA,
    timeout: 300000,
  });
  return parseJudgeResponse(raw);
}

// Returns { winner: "a"|"b"|"tie", consistent, judgments: [first, second] }.
// Swap the presentation order on the second call; map slot winners back to
// variants. Disagreement between the two orders is recorded as a tie.
export async function judgePair({ manager, target, instruction, input, a, b }) {
  const first = await judgeOnce({ manager, target, instruction, input, output1: a, output2: b });
  const second = await judgeOnce({ manager, target, instruction, input, output1: b, output2: a });
  const mapFirst = slot => (slot === "1" ? "a" : slot === "2" ? "b" : "tie");
  const mapSecond = slot => (slot === "1" ? "b" : slot === "2" ? "a" : "tie");
  const winnerFirst = mapFirst(first.overall);
  const winnerSecond = mapSecond(second.overall);
  const consistent = winnerFirst === winnerSecond;
  return {
    winner: consistent ? winnerFirst : "tie",
    consistent,
    judgments: [
      { order: "ab", ...first, mappedWinner: winnerFirst },
      { order: "ba", ...second, mappedWinner: winnerSecond },
    ],
  };
}