import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import custom from "../lib/server/llm/custom.mjs";
import { generateCoachReport } from "../lib/application/coach-report.mjs";

const markdown = `## 1. Summary
Article use needs attention. [S1]
## 2. Scope
Saved writing only.
## 3. Assessment
Limited evidence.
## 4. Diagnosis
${Array.from({ length: 8 }, (_, i) => `### 4.${i + 1}. Finding\nLimited evidence.`).join("\n")}
## 5. Recommendations
Focus on article use.`;

// Exercise the real report -> provider -> HTTP client chain without live API calls.
function fixture(context, respond) {
  const requests = [];
  context.mock.method(http, "request", (options, onResponse) => {
    requests.push(options);
    const req = new EventEmitter();
    req.write = () => {};
    req.destroy = () => {};
    req.end = () => {
      options.signal?.addEventListener("abort", () => {
        req.emit("error", Object.assign(new Error("Aborted"), { code: "ABORT_ERR" }));
      }, { once: true });
      if (respond) setImmediate(() => {
        const res = new EventEmitter();
        res.statusCode = 200;
        onResponse(res);
        res.emit("data", Buffer.from(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: respond() } }] })));
        res.emit("end");
      });
    };
    return req;
  });
  const config = { ModelProfileId: "deadline-test", CustomApiKeys: ["fixture-one", "fixture-two"],
    CustomProModel: "reasoning-pro", CustomApiBase: "http://example.test/v1", CoachReportTimeoutMs: "350000" };
  const deps = {
    loadData: () => ({ entries: [{ entryId: "cloud-deadline", source: "grammar", timestamp: new Date().toISOString(), userInput: "I read book.", diagnoses: [] }] }),
    getLLMManager: async () => ({ config, getCurrentProviderName: () => "custom",
      generateWithFallback: (input, system, options) => custom.generateWithFallback(input, system, { ...options, config }) }),
  };
  return { requests, deps };
}

test("cloud report requests use the remaining report deadline, including validation retries", async context => {
  let clock = Date.now(), calls = 0;
  context.mock.method(Date, "now", () => clock);
  const { requests, deps } = fixture(context, () => {
    calls++;
    if (calls === 1) { clock += 150000; return "Incomplete report"; }
    return markdown;
  });
  const report = await generateCoachReport({ language: "en", refresh: true }, deps);
  assert.deepEqual(report.evidenceIds, ["cloud-deadline"]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].timeout, 350000, "must override the shorter handbook socket timeout");
  assert.equal(requests[1].timeout, 200000, "validation retry only gets the remaining budget");
  assert.ok(requests[0].signal instanceof AbortSignal);
});

test("report deadline aborts the cloud HTTP request without trying another API key", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { requests, deps } = fixture(context);
  const result = generateCoachReport({ language: "en", refresh: true }, deps).catch(error => error);
  await new Promise(setImmediate);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].signal.aborted, false);
  context.mock.timers.tick(350000);
  assert.equal((await result).code, "COACH_REPORT_TIMEOUT");
  await new Promise(setImmediate);
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests.length, 1);
});
