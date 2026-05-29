// Thread compaction for /ask. Single-turn = shortcut (no LLM). Multi-turn = one
// LLM call with AskCompactPrompt that fuses the thread into one markdown answer.

import { ASK_RESPONSE_SCHEMA } from "./prompt.mjs";
import * as history from "./history.mjs";

function serializeThread(turns) {
  return turns
    .map((t, i) => {
      const r = t.response || {};
      const block = {
        turn: i + 1,
        question: t.question,
        answer: r.answer || "",
        related: r.related || [],
      };
      return JSON.stringify(block, null, 2);
    })
    .join("\n\n");
}

function parseAskResponse(text) {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

export async function compactSession({ sessionId, llm, config }) {
  const turns = history.get(sessionId);
  if (turns.length === 0) return null;

  if (turns.length === 1) {
    return turns[0].response;
  }

  const template = config.Prompts?.AskCompactPrompt;
  if (!template) throw new Error("Prompts.AskCompactPrompt missing from config");

  const provider = llm.getCurrentProviderName();
  const options = { taskType: "ask" };
  if (provider === "gemini") options.responseSchema = ASK_RESPONSE_SCHEMA;
  else options.responseFormat = { type: "json_object" };

  const userPayload = serializeThread(turns);
  const raw = await llm.generateWithFallback(userPayload, template, options);
  return parseAskResponse(raw);
}
