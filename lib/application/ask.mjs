import { performance } from "node:perf_hooks";
import { askResponse } from "../contracts/ask.mjs";
import { handleAskTurn } from "../features/ask/handler.mjs";
import { saveSession } from "../features/ask/save-handler.mjs";

export async function askTurn({ sessionId, question, llm, config }) {
  const startTime = performance.now();
  const result = await handleAskTurn({ sessionId, question, llm, config });
  const model = llm.getCurrentProvider().getModelName(config, "handbook");
  return {
    response: askResponse({
      data: result.response,
      perf: {
        llm_ms: result.elapsed,
        total_ms: performance.now() - startTime,
        model,
        ...(result.llmPerf ? { tool_ms: result.llmPerf.toolMs, answer_ms: result.llmPerf.answerMs, call_count: result.llmPerf.callCount } : {}),
      },
    }),
  };
}

export function saveAsk({ sessionId, llm, config }) {
  return saveSession({ sessionId, llm, config });
}
