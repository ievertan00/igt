import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";

const source = fs.readFileSync(new URL("../apps/web/src/api/client.ts", import.meta.url), "utf8");
const modelSelection = fs.readFileSync(new URL("../apps/web/src/api/model-selection.ts", import.meta.url), "utf8");
const modelSelectionUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(modelSelection)).toString("base64")}`;
const coachReportUrl = new URL("../lib/contracts/coach-report.mts", import.meta.url);
const outputText = stripTypeScriptTypes(source)
  .replace('from "./model-selection"', `from "${modelSelectionUrl}"`)
  .replace('from "../../../../lib/contracts/coach-report.mts"', `from "${coachReportUrl.href}"`);
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

test("a malformed successful response reports invalid JSON", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>"));
  await assert.rejects(requestJson("/practice/generate"), { code: "INVALID_RESPONSE" });
});

test("a non-JSON HTTP failure retains the HTTP error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>", { status: 502 }));
  await assert.rejects(requestJson("/practice/generate"), { code: "HTTP_ERROR", message: "HTTP 502" });
});

test("Coach Report accepts older metadata and identifies a missing required field", async (t) => {
  const report = {
    days: 90, language: "en", totalChecks: 1, sampled: false, truncated: false,
    markdown: "Sample report", evidenceIds: ["record-1"], generatedAt: "2026-11-23T00:00:00Z",
    evidence: [{ entryId: "record-1", timestamp: "2026-11-22", original: "I read book.", correction: "I read a book." }],
  };
  const savedId = "0".repeat(24);
  t.mock.method(globalThis, "fetch", async () => Response.json(report));
  assert.deepEqual(await webApi.readCoachReport(savedId), report);
  delete report.evidence[0].entryId;
  await assert.rejects(webApi.readCoachReport(savedId), {
    code: "INVALID_RESPONSE",
    message: "Invalid Coach Report response at report.evidence[0].entryId.",
  });
});
