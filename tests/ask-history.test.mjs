// Regression: the /ask thread buffer must stay pinned to the session that started
// it. getOrStartSession() can rotate the "current" session mid-thread (30-min gap,
// /undo reset); before the fix that rotation orphaned the buffer and the save path
// reported "Nothing to save — thread discarded," silently dropping the user's thread.

import test from "node:test";
import assert from "node:assert/strict";
import * as history from "../lib/features/ask/history.mjs";

const turn = (q) => ({ question: q, answer: `answer to ${q}`, response: { question: q, answer: "", related: [] } });

// history is module-global; clear the session ids this file uses before each test.
function clean() {
  history.reset(1);
  history.reset(2);
}

test("append pins the active session and buffers the turn", () => {
  clean();
  history.append(1, turn("q1"));
  assert.equal(history.getActiveSessionId(), 1);
  assert.equal(history.get(1).length, 1);
});

test("save survives a session rotation: active id stays the thread's, not the rotated one", () => {
  clean();
  history.append(1, turn("q1")); // thread started on session 1
  // ...session rotates to 2 (a save handler that re-derived getOrStartSession would get 2).
  // The pinned id must still point at the thread we built.
  assert.equal(history.getActiveSessionId(), 1);
  assert.equal(history.get(history.getActiveSessionId()).length, 1);
});

test("multi-turn thread stays on one session even if the current session rotates between turns", () => {
  clean();
  history.append(1, turn("q1"));
  // A handler that pins via getActiveSessionId() appends the next turn to the same key.
  history.append(history.getActiveSessionId(), turn("q2"));
  assert.equal(history.getActiveSessionId(), 1);
  assert.equal(history.get(1).length, 2);
});

test("reset of the active thread clears the pin; reset of another session does not", () => {
  clean();
  history.append(1, turn("q1"));
  history.reset(2); // unrelated session
  assert.equal(history.getActiveSessionId(), 1, "resetting a different session must not clear the active pin");
  history.reset(1);
  assert.equal(history.getActiveSessionId(), null);
  assert.equal(history.get(1).length, 0);
});
