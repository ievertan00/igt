// Per-turn handler for /ask. Pure I/O-free orchestration:
//   build prompt → call LLM (Pro tier) → parse result → append to history → return.
// The HTTP route (lib/server/routes/ask.mjs) is the only caller.
//
import { performance } from "node:perf_hooks";
import {
  ASK_RESPONSE_SCHEMA,
  assemblePrompt,
  formatHistory,
} from "./prompt.mjs";
import * as history from "./history.mjs";

// Decode the JSON string escapes we care about in a single pass (no double-processing).
function unescapeJsonString(s) {
  return s.replace(/\\(["\\/bfnrt])/g, (_, c) => {
    switch (c) {
      case "n": return "\n";
      case "t": return "\t";
      case "r": return "\r";
      case "b": return "\b";
      case "f": return "\f";
      default:  return c; // " \ /
    }
  });
}

// When JSON.parse fails (common when a local model packs multi-line markdown with
// unescaped quotes into the "answer" string), recover just the answer text by
// anchoring on the schema's field boundaries instead of dumping the raw JSON blob.
function recoverAnswerField(raw) {
  const start = raw.match(/"answer"\s*:\s*"/);
  if (!start) return null;
  const from = start.index + start[0].length;
  // The schema always emits "related" after "answer"; anchor on that boundary so a
  // stray quote inside the markdown answer doesn't truncate the recovery.
  let end = raw.indexOf('","related"', from);
  if (end === -1) end = raw.search(/"\s*\}\s*$/); // trailing  "}
  if (end === -1 || end <= from) return null;
  return unescapeJsonString(raw.slice(from, end));
}

export function parseAskResponse(text) {
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
    // Malformed JSON: recover the answer text rather than leaking the raw blob to the
    // terminal. Falls back to the cleaned string only if no answer field is recoverable.
    const recovered = recoverAnswerField(cleaned);
    const titleMatch = cleaned.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    return {
      question: "",
      title: titleMatch ? unescapeJsonString(titleMatch[1]) : "",
      answer: recovered !== null ? recovered : cleaned,
      related: [],
    };
  }
}

export async function handleAskTurn({ sessionId, question, llm, config }) {
  const startTime = performance.now();

  const template = config.Prompts?.AskPrompt;
  if (!template) throw new Error("Prompts.AskPrompt missing from config");

  const recent = history.getRecentForPrompt(sessionId);
  let systemPrompt = assemblePrompt(template, { history: formatHistory(recent) });
  systemPrompt +=
    "\n\nFormatting rule: Do not use markdown tables. For comparisons, use short " +
    "bulleted lists or compact feature-by-feature sections instead.";

  const options = { taskType: "ask", jsonSchema: ASK_RESPONSE_SCHEMA };
  const raw = await llm.generateWithFallback(question, systemPrompt, options);
  const response = parseAskResponse(raw);
  if (!response.question) response.question = question;
  if (!response.title) response.title = "";
  if (!response.answer) response.answer = "";
  if (!Array.isArray(response.related)) response.related = [];
  response.sources = [];

  const elapsed = performance.now() - startTime;

  history.append(sessionId, {
    question,
    answer: response.answer,
    response,
  });

  return { response, elapsed, llmPerf: null };
}
