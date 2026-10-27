import { isMainlyChinese } from "../cli/validate-input.mjs";

export { isMainlyChinese };

export const VOCABULARY_TRANSLATION_PROMPT = "You translate vocabulary lookup terms for an English learner. Return only the single most relevant natural English dictionary headword or phrase for the user's Chinese word or phrase. Do not explain, add alternatives, punctuation, or markdown. Use the canonical/base form when appropriate.";

export async function resolveVocabularyQuery(query, llm) {
  const requested = String(query || "").trim();
  if (!requested) throw new Error("Enter a word or phrase to look up.");
  if (!isMainlyChinese(requested)) return { requested, lookup: requested, translated: false };
  const raw = await llm.generateWithFallback(requested, VOCABULARY_TRANSLATION_PROMPT, { taskType: "translation" });
  try {
    return { requested, lookup: cleanEnglishCounterpart(raw), translated: true };
  } catch (cause) {
    throw Object.assign(new Error(cause.message, { cause }), { code: "INVALID_ENGLISH_COUNTERPART", status: 502, retryable: true });
  }
}

export function cleanEnglishCounterpart(raw) {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^(?:English(?: counterpart)?|Translation)\s*:\s*/i, "")
    .replace(/^['"“”]+|['"“”]+$/g, "")
    .trim();

  if (!cleaned || !/[a-zA-Z]/.test(cleaned) || /[\u4e00-\u9fff]/.test(cleaned)) {
    throw new Error("Could not find a reliable English counterpart for that Chinese input.");
  }

  return cleaned;
}
