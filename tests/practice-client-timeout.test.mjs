import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";

const source = fs.readFileSync(new URL("../apps/web/src/api/client.ts", import.meta.url), "utf8");
const outputText = stripTypeScriptTypes(source);
const { requestJson, webApi } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("practice selection sends all categories", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { mode: "sentence", count: 3, difficulty: "easy", style: "formal", context: "work" });
    return new Response(JSON.stringify({ data: { questions: [{ kind: "sentence" }] } }));
  });
  assert.equal((await webApi.generatePractice("sentence", 3, "easy", "formal", "work")).data.questions[0].kind, "sentence");
});

test("an abort caused by timeout is reported as a retryable timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const pending = requestJson("/practice/generate", { timeoutMs: 10 });
  const rejection = assert.rejects(pending, error => error.code === "REQUEST_TIMEOUT" && error.retryable === true);
  t.mock.timers.tick(11);
  await rejection;
});
