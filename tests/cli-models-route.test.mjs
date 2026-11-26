import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createDispatcher } from "../lib/server/router.mjs";
import { registerLlmSettingsRoutes } from "../lib/server/routes/llm-settings.mjs";

const TASKS = ["grammar", "translation", "word", "practice", "text", "ask", "chat", "coach"];

function fakeLoader() {
  return {
    env: { IGT_CLI_MODELS: JSON.stringify({ grammar: "p1" }) },
    load: () => ({ LLMProvider: "custom" }),
    updateEnv: () => {},
  };
}

function dispatchTo(dispatcher, path) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(dispatcher).listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      http.get({ hostname: "127.0.0.1", port, path }, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          server.close(() => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
      }).on("error", (error) => { server.close(() => reject(error)); });
    });
  });
}

test("GET /settings/llm/cli exposes task choices without secrets", async () => {
  const dispatcher = createDispatcher(() => registerLlmSettingsRoutes({
    config: {},
    getLLMManager: async () => ({}),
    loader: fakeLoader(),
  }));
  const { status, body } = await dispatchTo(dispatcher, "/settings/llm/cli");
  assert.equal(status, 200);
  assert.deepEqual(body.tasks, TASKS);
  assert.ok(Array.isArray(body.profiles));
  assert.equal(typeof body.selections, "object");
  assert.ok(body.selected.grammar);
  assert.ok(body.selected.default);
  assert.ok(!("apiKeys" in body), "response must not expose API keys");
  assert.ok(!("config" in body), "response must not expose the raw config");
  assert.ok(!("saved" in body), "response must not expose saved provider internals");
  assert.equal(JSON.stringify(body).includes("sk-"), false);
});

test("legacy fallback marks tasks inherited when unselected", async () => {
  const dispatcher = createDispatcher(() => registerLlmSettingsRoutes({
    config: {},
    getLLMManager: async () => ({}),
    loader: fakeLoader(),
  }));
  const { body } = await dispatchTo(dispatcher, "/settings/llm/cli");
  assert.equal(body.selected.coach.inherited, true);
  assert.equal(body.selected.default.inherited, false);
});
