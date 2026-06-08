// In-memory conversation buffer for /ask sessions.
// Turn shape: { question, answer, response }
//   - question: the user's verbatim line
//   - answer: the markdown body returned by the LLM (used for prompt context)
//   - response: the full parsed JSON ({ question, answer, related }) — kept
//     for synthesis at save time.
// Single-user CLI server; Node event loop serializes writes — no locking needed.

const PROMPT_CONTEXT_LIMIT = 5;

const buffers = new Map();

// The session id the active /ask thread is pinned to. getOrStartSession() can rotate
// the "current" session mid-thread (30-min gap, /undo reset), which would orphan this
// buffer and silently lose a thread the user asked to save. Pinning on first append
// keeps every turn — and the save/reset that follow — on one stable key.
let activeSessionId = null;

export function append(sessionId, turn) {
  if (!buffers.has(sessionId)) buffers.set(sessionId, []);
  buffers.get(sessionId).push(turn);
  activeSessionId = sessionId;
}

export function getActiveSessionId() {
  return activeSessionId;
}

export function get(sessionId) {
  return buffers.get(sessionId) ?? [];
}

export function getRecentForPrompt(sessionId, n = PROMPT_CONTEXT_LIMIT) {
  return get(sessionId).slice(-n);
}

export function reset(sessionId) {
  buffers.delete(sessionId);
  if (sessionId === activeSessionId) activeSessionId = null;
}

export function size(sessionId) {
  return get(sessionId).length;
}
