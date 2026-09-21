export const TEXT_ANALYSIS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    correction: { type: "string" },
    refine: { type: "string" },
    diagnoses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          error_type: { type: "string" },
          scope: { type: "string", enum: ["global", "paragraph", "sentence"] },
          severity: { type: "string", enum: ["Minor", "Moderate", "Major"] },
          evidence: { type: "string" },
          explanation: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["error_type", "scope", "severity", "evidence", "explanation", "suggestion"],
        additionalProperties: false,
      },
    },
    remember: { type: "array", items: { type: "string" } },
  },
  required: ["correction", "refine", "diagnoses", "remember"],
  additionalProperties: false,
};

export const TEXT_ANALYSIS_PROMPT = `You are an English writing editor analyzing a complete passage, not a single sentence.

Return ONLY one JSON object with exactly these keys:
- correction: a minimally corrected full passage that preserves the writer's meaning, structure, and voice
- refine: a more natural and polished full passage suitable for the apparent context
- diagnoses: an array of no more than five whole-text issues. Each item must contain error_type, scope (global, paragraph, or sentence), severity (Minor, Moderate, or Major), evidence (a short exact quote or concrete passage reference), explanation, and suggestion.
- remember: one to three concise writing principles or next actions.

Analyze the passage as a whole. Consider coherence, organization, paragraph flow, transitions, consistency, tone, register, word choice, grammar patterns across sentences, redundancy, missing context, and whether the message achieves its apparent purpose.

Do not produce a sentence-by-sentence grammar checklist. Use a global diagnosis for purpose, organization, coherence, or tone; use paragraph or sentence scope only when the evidence is specific. Do not invent the writer's intent, audience, facts, or context. If the passage is already clear, keep correction/refine close to the original and return an empty diagnoses array when there is no actionable issue. Preserve proper nouns, technical terms, and factual content.`;
