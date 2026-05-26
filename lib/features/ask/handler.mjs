// Per-turn handler for /ask. Pure I/O-free orchestration:
//   build prompt → call LLM (Pro tier) → parse result → append to history → return.
// The HTTP route (lib/server/routes/ask.mjs) is the only caller.
//
// When grammar_ref.db is available, uses a native function-calling tool loop
// (search_grammar_books) and returns a plain-markdown answer with source attribution.
// When the DB is absent, falls back to the legacy JSON-structured path.

import { performance } from "node:perf_hooks";
import {
  ASK_RESPONSE_SCHEMA,
  assemblePrompt,
  formatHistory,
} from "./prompt.mjs";
import * as history from "./history.mjs";
import {
  grammarRefAvailable,
  SEARCH_GRAMMAR_TOOL_DEF,
  executeGrammarSearch,
} from "../../db/grammar-ref.mjs";

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
  let systemPrompt = assemblePrompt(template, { history: formatHistory(recent) });

  let response;
  let sources = [];

  if (grammarRefAvailable()) {
    // ── Tool-augmented path ───────────────────────────────────────────────────
    // The LLM is in function-calling mode; its final output is markdown prose,
    // not JSON. Override the JSON instruction embedded in AskPrompt.
    systemPrompt +=
      "\n\nIMPORTANT: You MUST call the search_grammar_books tool at least once " +
      "before answering — look up the topic in the reference books first. " +
      "After getting the search results, give your final answer as markdown prose " +
      "(NOT a JSON object).";

    const result = await llm.generateWithTools(
      question,
      systemPrompt,
      [SEARCH_GRAMMAR_TOOL_DEF],
      executeGrammarSearch,
      { taskType: "handbook" }
    );
    sources = result.sources;
    // LLM may still return JSON despite the prose override — attempt to unwrap.
    let answer = result.content;
    let title = "";
    let related = [];
    try {
      const parsed = parseAskResponse(result.content);
      if (parsed && typeof parsed.answer === "string") {
        answer = parsed.answer;
        title = parsed.title || "";
        if (Array.isArray(parsed.related)) related = parsed.related;
      }
    } catch { /* content is already prose — use as-is */ }
    response = { question, title, answer, related, sources };
  } else {
    // ── Legacy path (no books DB) ─────────────────────────────────────────────
    const provider = llm.getCurrentProviderName();
    const options = { taskType: "handbook" };
    if (provider === "gemini") options.responseSchema = ASK_RESPONSE_SCHEMA;
    else options.responseFormat = { type: "json_object" };

    const raw = await llm.generateWithFallback(question, systemPrompt, options);
    response = parseAskResponse(raw);
    if (!response.question) response.question = question;
    if (!response.title) response.title = "";
    if (!response.answer) response.answer = "";
    if (!Array.isArray(response.related)) response.related = [];
    response.sources = [];
  }

  const elapsed = performance.now() - startTime;

  history.append(sessionId, {
    question,
    answer: response.answer,
    response,
  });

  return { response, elapsed };
}
