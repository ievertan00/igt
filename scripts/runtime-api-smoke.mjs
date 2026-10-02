import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";

function rawGet(port, requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: "127.0.0.1", port, path: requestPath, method: "GET" }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
    request.end();
  });
}

const child = spawn(process.execPath, ["apps/local/server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, IGT_SERVER_HOST: "127.0.0.1", IGT_SERVER_PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
let settled = false;
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Local Runtime did not start.\n${output}`)), 15000);
  const onChunk = (chunk) => {
    output += chunk.toString();
    const match = output.match(/Ready on http:\/\/127\.0\.0\.1:(\d+)/);
    if (match && !settled) {
      settled = true;
      clearTimeout(timer);
      resolve(Number(match[1]));
    }
  };
  child.stderr.on("data", onChunk);
  child.stdout.on("data", onChunk);
  child.once("error", (error) => {
    if (!settled) {
      settled = true;
      clearTimeout(timer);
      reject(error);
    }
  });
  child.once("exit", (code) => {
    if (!settled) {
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Local Runtime exited with code ${code}.\n${output}`));
    }
  });
});

try {
  const port = await ready;
  const getJson = async (route) => {
    const response = await fetch(`http://127.0.0.1:${port}${route}`);
    assert.equal(response.status, 200, `${route} returned ${response.status}`);
    return response.json();
  };
  const health = await getJson("/health");
  assert.equal(health.status, "ok");
  const runtime = await getJson("/runtime");
  assert.equal(runtime.runtime, "local");
  assert.equal(runtime.userId, "local-user");
  const practiceResponse = await fetch(`http://127.0.0.1:${port}/practice/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: 3, difficulty: "standard", style: "formal", context: "work" }),
  });
  assert.equal(practiceResponse.status, 200);
  const practice = (await practiceResponse.json()).data;
  assert.equal(practice.questions.length, 3);
  for (const question of practice.questions) {
    assert.equal(question.kind, "sentence");
    assert.equal(question.context, "work");
    assert.equal(question.style, "formal");
    assert.equal(question.difficulty, "standard");
    assert.equal(question.reference_answer, undefined);
    assert.equal(question.alternative_note, undefined);
    assert.ok(question.id.startsWith("language-"));
    assert.ok(question.focus_id);
    assert.deepEqual(Object.keys(question.hints), ["simple", "intermediate", "complete"]);
    assert.ok(question.metadata.purpose);
  }
  const dashboard = await getJson("/dashboard");
  assert.equal(typeof dashboard, "object");
  assert.equal(typeof dashboard.assets, "object");
  const web = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(web.status, 200);
  assert.match(await web.text(), /id="root"/);
  const spa = await fetch(`http://127.0.0.1:${port}/workspace/coach`);
  assert.equal(spa.status, 200);
  assert.match(await spa.text(), /id="root"/);
  assert.equal(await rawGet(port, "/%2e%2e/package.json"), 404);
  console.log("runtime API smoke ok");
} finally {
  child.kill();
}
