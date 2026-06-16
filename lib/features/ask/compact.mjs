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
  // Strip reasoning/thinking tags
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, "")
    .trim();

  // Providers may wrap JSON in code fences when JSON mode isn't honored.
  cleaned = cleaned
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return {
      question: "",
      title: "Consolidated (Malformed)",
      answer: cleaned,
      related: [],
    };
  }
}

export async function compactSession({ sessionId, llm, config }) {
  const turns = history.get(sessionId);
  if (turns.length === 0) return null;

  if (turns.length === 1) {
    return turns[0].response;
  }

  const template = config.Prompts?.AskCompactPrompt;
  if (!template) throw new Error("Prompts.AskCompactPrompt missing from config");

  const options = { taskType: "ask", jsonSchema: ASK_RESPONSE_SCHEMA };

  const userPayload = serializeThread(turns);
  const raw = await llm.generateWithFallback(userPayload, template, options);
  return parseAskResponse(raw);
}
