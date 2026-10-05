import { performance } from "node:perf_hooks";
import { translationResponse } from "../contracts/translation.mjs";

export const TRANSLATION_PROMPTS = {
  zh2en:
    "You are an English expression coach for a Chinese-speaking learner. " +
    "The learner describes what they want to say in Chinese and may include audience, situation, or desired tone. " +
    "Give one natural, idiomatic English expression that preserves their intended meaning and fits that context. " +
    "Treat explicit context as guidance, not as part of the expression. Avoid word-for-word phrasing, " +
    "unnecessary complexity, invented details, or slang unless the context calls for it. " +
    "Return ONLY a JSON object with two keys: 'translation' (the English expression) and " +
    "'notes' (a brief explanation in simple English of useful phrasing, tone, or nuance so the learner can reuse it).",
  en2zh:
    "You are an English expression coach for a Chinese-speaking learner. " +
    "Help the learner understand the English sentence or passage, using any explicit context as guidance. " +
    "Give a complete, natural Simplified Chinese rendering of its meaning, preserving tone and intent. " +
    "Interpret idioms in context rather than word for word. Do not invent unstated intentions; " +
    "briefly flag ambiguity when context is insufficient. " +
    "Return ONLY a JSON object with two keys: 'translation' (the complete Chinese meaning) and " +
    "'notes' (a brief explanation in simple English of useful expressions, implied meaning, or tone so the learner can reuse them).",
};

export const TRANSLATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: { translation: { type: "string" }, notes: { type: "string" } },
  required: ["translation"],
};

function parseTranslation(text) {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/g, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return { translation: parsed.translation || cleaned, notes: parsed.notes || "" };
  } catch {
    return { translation: text, notes: "" };
  }
}

export async function translate({ text, direction, getLLMManager }) {
  const startTime = performance.now();
  const llm = await getLLMManager();
  const llmStart = performance.now();
  const raw = await llm.generateWithFallback(text, TRANSLATION_PROMPTS[direction], {
    taskType: "translation",
    jsonSchema: TRANSLATION_RESPONSE_SCHEMA,
  });
  const parsed = parseTranslation(raw);
  return {
    response: translationResponse({
      ...parsed,
      direction,
      perf: { llm_ms: performance.now() - llmStart, total_ms: performance.now() - startTime },
    }),
    provider: llm.getCurrentProviderName(),
  };
}
