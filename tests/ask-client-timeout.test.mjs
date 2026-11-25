import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

const source = fs.readFileSync(new URL("../apps/web/src/api/client.ts", import.meta.url), "utf8");
const selection = fs.readFileSync(new URL("../apps/web/src/api/model-selection.ts", import.meta.url), "utf8");
const selectionUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(selection)).toString("base64")}`;
const reportUrl = new URL("../lib/contracts/coach-report.mts", import.meta.url);
const client = stripTypeScriptTypes(source)
  .replace('from "./model-selection"', `from "${selectionUrl}"`)
  .replace('from "../../../../lib/contracts/coach-report.mts"', `from "${reportUrl.href}"`);
const { webApi } = await import(`data:text/javascript;base64,${Buffer.from(client).toString("base64")}`);

test("Ask accepts a model answer arriving after the generic 30-second deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", (url, { method, signal }) => {
    assert.equal(url, "/ask");
    assert.equal(method, "POST");
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      setTimeout(() => resolve(Response.json({ data: { answer: "Went." } })), 45_000);
    });
  });

  const response = webApi.ask("What is the past tense of go?", [], "en");
  t.mock.timers.tick(45_000);
  assert.equal((await response).data.answer, "Went.");
});

test("Ask still times out when no response arrives within three minutes", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let requestSignal;
  t.mock.method(globalThis, "fetch", (_url, { signal }) => {
    requestSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });

  const response = webApi.ask("What is the past tense of go?", [], "en");
  const rejection = assert.rejects(response, { code: "REQUEST_TIMEOUT", retryable: true });
  t.mock.timers.tick(179_999);
  assert.equal(requestSignal.aborted, false);
  t.mock.timers.tick(1);
  await rejection;
});
