// Per-turn handler for /ask. Pure I/O-free orchestration:
//   build prompt → call LLM (Pro tier) → parse JSON → append to history → return.
// The HTTP route (lib/server/routes/ask.mjs) is the only caller.

import { performance } from "node:perf_hooks";
import {
  ASK_RESPONSE_SCHEMA,
  assemblePrompt,
  formatHistory,
} from "./prompt.mjs";
import * as history from "./history.mjs";

function parseAskResponse(text) {
  // Providers may wrap JSON in code fences when responseFormat isn't honored.
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

export async function handleAskTurn({ sessionId, question, llm, config }) {
  const startTime = performance.now();

  const template = config.Prompts?.AskPrompt;
  if (!template) throw new Error("Prompts.AskPrompt missing from config");

  const recent = history.getRecentForPrompt(sessionId);
  const systemPrompt = assemblePrompt(template, {
    history: formatHistory(recent),
  });

  const provider = llm.getCurrentProviderName();
  const options = { taskType: "handbook" };
  if (provider === "gemini") options.responseSchema = ASK_RESPONSE_SCHEMA;
  else options.responseFormat = { type: "json_object" };

  const raw = await llm.generateWithFallback(question, systemPrompt, options);
  const elapsed = performance.now() - startTime;

  const response = parseAskResponse(raw);
  if (!response.question) response.question = question;
  if (!response.answer) response.answer = "";
  if (!Array.isArray(response.related)) response.related = [];

  history.append(sessionId, {
    question,
    answer: response.answer,
    response,
  });

  return { response, elapsed };
}
