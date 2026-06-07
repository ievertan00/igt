// Per-turn handler for /chat — an ephemeral English conversation partner.
// Unlike /ask, there is no grammar-book grounding and no persistence: the
// conversation lives only in this module's in-memory buffer for the session.
//
// Each turn the LLM returns JSON { reply, corrections[] } — a natural
// conversational reply plus gentle corrections of the user's latest message.
// The HTTP route (lib/server/routes/chat.mjs) is the only caller.

import { performance } from "node:perf_hooks";
import { assemblePrompt } from "../ask/prompt.mjs";

// Gemini structured-output schema. Other providers use response_format json_object.
export const CHAT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    corrections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          correction: { type: "string" },
          note: { type: "string" },
        },
        required: ["original", "correction", "note"],
      },
    },
  },
  required: ["reply", "corrections"],
};

// ── In-memory conversation buffer ───────────────────────────────────────────
// Turn shape: { user, assistant }. Single-user CLI; the Node event loop
// serializes writes, so no locking is needed. Discarded on reset / process exit.
const HISTORY_LIMIT = 8;
const buffers = new Map();

function append(sessionId, turn) {
  if (!buffers.has(sessionId)) buffers.set(sessionId, []);
  buffers.get(sessionId).push(turn);
}

function recent(sessionId) {
  return (buffers.get(sessionId) ?? []).slice(-HISTORY_LIMIT);
}

export function resetChat(sessionId) {
  buffers.delete(sessionId);
}

function formatHistory(turns) {
  if (!turns || turns.length === 0) return "(start of conversation)";
  return turns
    .map((t) => `User: ${t.user}\nPartner: ${t.assistant}`)
    .join("\n\n");
}

function parseChatResponse(text) {
  let cleaned = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const reply = typeof parsed.reply === "string" ? parsed.reply : cleaned;
    const corrections = Array.isArray(parsed.corrections)
      ? parsed.corrections
          .filter((c) => c && typeof c.correction === "string")
          .map((c) => ({
            original: String(c.original ?? ""),
            correction: String(c.correction ?? ""),
            note: String(c.note ?? ""),
          }))
      : [];
    return { reply, corrections };
  } catch {
    // Malformed JSON (common with local models): treat the whole text as the
    // reply rather than leaking a raw blob, and skip corrections this turn.
    return { reply: cleaned, corrections: [] };
  }
}

export async function handleChatTurn({ sessionId, message, llm, config }) {
  const startTime = performance.now();

  const template = config.Prompts?.ChatPrompt;
  if (!template) throw new Error("Prompts.ChatPrompt missing from config");

  const systemPrompt = assemblePrompt(template, {
    history: formatHistory(recent(sessionId)),
  });

  // Flash (interactive) tier — chat is conversational like /ask, so reuse the
  // "ask" task routing rather than adding a new model-resolver entry.
  const options = { taskType: "ask" };
  if (llm.getCurrentProviderName() === "gemini") options.responseSchema = CHAT_RESPONSE_SCHEMA;
  else options.responseFormat = { type: "json_object" };

  const raw = await llm.generateWithFallback(message, systemPrompt, options);
  const response = parseChatResponse(raw);

  append(sessionId, { user: message, assistant: response.reply });

  return { response, elapsed: performance.now() - startTime };
}
