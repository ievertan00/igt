import { performance } from "node:perf_hooks";
import { askResponse } from "../contracts/ask.mjs";
import { handleAskTurn } from "../features/ask/handler.mjs";
import { saveSession, saveAskTurns } from "../features/ask/save-handler.mjs";
import { ASK_RESPONSE_SCHEMA, assemblePrompt, formatHistory } from "../features/ask/prompt.mjs";
import { parseAskResponse } from "../features/ask/handler.mjs";
import { ASK_METADATA_PROMPT } from "../features/ask/metadata.mjs";

export async function askTurn({ sessionId, messages, question, llm, config }) {
  if (Array.isArray(messages)) return askStateless({ messages, question, llm, config });
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

export async function askStateless({ messages = [], question, llm, config }) {
  const startTime = performance.now();
  const template = config.Prompts?.AskPrompt;
  if (!template) throw new Error("Prompts.AskPrompt missing from config");
  const history = messages.map((item) => ({ question: item.question || item.user || "", answer: item.answer || item.assistant || "" }));
  const systemPrompt = assemblePrompt(template, { history: formatHistory(history.slice(-12)) }) + ASK_METADATA_PROMPT +
    "\n\nFormatting rule: Do not use markdown tables. For comparisons, use short bulleted lists or compact feature-by-feature sections instead.";
  const raw = await llm.generateWithFallback(question, systemPrompt, { taskType: "ask", jsonSchema: ASK_RESPONSE_SCHEMA });
  const response = parseAskResponse(raw);
  if (!response.question) response.question = question;
  if (!response.title) response.title = "";
  if (!response.answer) response.answer = "";
  if (!Array.isArray(response.related)) response.related = [];
  response.sources = [];
  return { response: askResponse({ data: response, perf: { llm_ms: performance.now() - startTime, total_ms: performance.now() - startTime, model: llm.getCurrentProvider().getModelName(config, "handbook") } }) };
}

export function saveAsk({ sessionId, messages, llm, getLLMManager, config }) {
  if (Array.isArray(messages)) return saveAskMessages({ messages, llm, getLLMManager, config });
  return saveSession({ sessionId, llm, getLLMManager, config });
}

export function saveAskMessages({ messages = [], llm, getLLMManager, config }) {
  return saveAskTurns({ turns: messages, llm, getLLMManager, config });
}
