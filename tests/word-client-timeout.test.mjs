import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";

const source = fs.readFileSync(new URL("../apps/web/src/api/client.ts", import.meta.url), "utf8");
const { webApi } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);

test("vocabulary lookup accepts a provider response after the generic 30-second deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", async (url, { signal }) => {
    assert.equal(url, "/word/lookup?q=carry%20on");
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      setTimeout(() => resolve(new Response(JSON.stringify({ data: { word: "carry on", zh: "继续" }, persistence: { saved: false } }))), 75_000);
    });
  });
  const pending = webApi.lookupWord("carry on");
  t.mock.timers.tick(75_000);
  const result = await pending;
  assert.equal(result.data.word, "carry on");
  assert.equal(result.persistence.saved, false);
});

test("vocabulary lookup still reports a retryable timeout for a stalled request", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  const pending = webApi.lookupWord("resilient");
  const rejection = assert.rejects(pending, error => error.code === "REQUEST_TIMEOUT" && error.retryable === true);
  t.mock.timers.tick(180_000);
  await rejection;
});

test("vocabulary lookup preserves provider errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: {
    code: "INTERNAL_ERROR", message: "Provider request timed out (60s)", retryable: true,
  } }), { status: 502 }));
  await assert.rejects(webApi.lookupWord("resilient"), error => error.message === "Provider request timed out (60s)" && error.retryable === true);
});
