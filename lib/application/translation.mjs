import { performance } from "node:perf_hooks";
import { translationResponse } from "../contracts/translation.mjs";

export const TRANSLATION_PROMPTS = {
  zh2en:
    "You are a professional translator. Translate the Chinese text into natural, fluent English. " +
    "Return ONLY a JSON object with two keys: 'translation' (the translated string) and " +
    "'notes' (a brief observation about idioms, register, or nuance if relevant — empty string otherwise).",
  en2zh:
    "You are a professional translator. Translate the English text into natural, fluent Simplified Chinese. " +
    "Return ONLY a JSON object with two keys: 'translation' (the translated string) and " +
    "'notes' (a brief observation about idioms, register, or nuance if relevant — empty string otherwise).",
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
