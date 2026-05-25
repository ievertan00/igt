// In-memory conversation buffer for /ask sessions.
// Turn shape: { question, answer, response }
//   - question: the user's verbatim line
//   - answer: the markdown body returned by the LLM (used for prompt context)
//   - response: the full parsed JSON ({ question, answer, related }) — kept
//     for synthesis at save time.
// Single-user CLI server; Node event loop serializes writes — no locking needed.

const PROMPT_CONTEXT_LIMIT = 5;

const buffers = new Map();

export function append(sessionId, turn) {
  if (!buffers.has(sessionId)) buffers.set(sessionId, []);
  buffers.get(sessionId).push(turn);
}

export function get(sessionId) {
  return buffers.get(sessionId) ?? [];
}

export function getRecentForPrompt(sessionId, n = PROMPT_CONTEXT_LIMIT) {
  return get(sessionId).slice(-n);
}

export function reset(sessionId) {
  buffers.delete(sessionId);
}

export function size(sessionId) {
  return get(sessionId).length;
}
