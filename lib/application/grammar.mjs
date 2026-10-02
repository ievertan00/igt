import { performance } from "node:perf_hooks";
import { appendReviewLog } from "../db/review-log.mjs";
import { GRAMMAR_RESPONSE_SCHEMA } from "../domain/parse-diagnosis.mjs";
import { grammarAnalysisResponse, grammarPersistenceResponse } from "../contracts/grammar.mjs";

export async function analyzeGrammar({ text, getLLMManager, systemPrompt, parseDiagnosis }) {
  const startTime = performance.now();
  const llm = await getLLMManager();
  const raw = await llm.generateWithFallback(text, systemPrompt, {
    taskType: "grammar",
    jsonSchema: GRAMMAR_RESPONSE_SCHEMA,
  });
  const data = parseDiagnosis(raw);
  return {
    response: grammarAnalysisResponse({
      data,
      originalText: text,
      perf: { llm_ms: performance.now() - startTime, total_ms: performance.now() - startTime },
    }),
    provider: llm.getCurrentProviderName(),
  };
}

export function saveGrammarReview({ text, data, reviewPath }) {
  const saved = appendReviewLog(reviewPath, { originalText: text, data });
  return grammarPersistenceResponse({ saved: true, path: saved.path, entryId: saved.entryId });
}
