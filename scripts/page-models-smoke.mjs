import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { ConfigLoader } from "../lib/shared/config-loader.mjs";
import { initializeLLMProviders } from "../lib/server/llm/init.mjs";
import { requestModelManager } from "../lib/server/llm/request-model.mjs";
import { register, dispatch } from "../lib/server/router.mjs";
import { registerAskRoutes } from "../lib/server/routes/ask.mjs";

const cache = path.join(process.cwd(), ".cache");
fs.mkdirSync(cache, { recursive: true });
const root = fs.mkdtempSync(path.join(cache, "page-models-"));
const originalEnv = { ...process.env };
const calls = [];
const server = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  calls.push({ url: req.url, key: req.headers.authorization, ...JSON.parse(raw) });
  res.writeHead(200, { "Content-Type": "application/json" });
  const answer = JSON.stringify({ question: "Why?", answer: "A useful explanation.", title: "An explanation", related: [], category: "Grammar", tags: [] });
  res.end(JSON.stringify({ choices: [{ message: { content: answer } }], message: { content: answer } }));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const endpoint = `http://127.0.0.1:${server.address().port}`;
const profiles = [
  { id: "writing", name: "Writing", provider: "custom", baseUrl: `${endpoint}/writing/v1`, apiKeys: ["writing-only"], models: { flash: "writing-fast", pro: "writing-pro" } },
  { id: "ask", name: "Ask", provider: "custom", baseUrl: `${endpoint}/ask/v1`, apiKeys: [], models: { flash: "ask-fast", pro: "ask-pro" } },
  { id: "local", name: "Local", provider: "ollama", baseUrl: `${endpoint}/local`, apiKeys: [], ollamaFamily: "qwen3", models: { flash: "local-fast", pro: "local-pro" } },
];
fs.writeFileSync(path.join(root, "igt_config.json"), JSON.stringify({ Prompts: { AskPrompt: "Explain the learner's question. {history}" } }));
fs.writeFileSync(path.join(root, ".env"), `IGT_LLM_PROVIDER=custom\nIGT_CUSTOM_API_BASE=${endpoint}/default/v1\nIGT_CUSTOM_API_KEYS=global-key\nIGT_CUSTOM_FLASH_MODEL=default-fast\nIGT_CUSTOM_PRO_MODEL=default-pro\nIGT_LLM_PROFILES=${Buffer.from(JSON.stringify(profiles)).toString("base64")}\nIGT_LLM_ACTIVE_PROFILE=writing\n`);
process.env.IGT_LLM_PROVIDER = "custom";
process.env.IGT_CUSTOM_API_KEY = "global-key";
const loader = new ConfigLoader(root);
const config = loader.load();
const defaultManager = initializeLLMProviders(config);
const getLLMManager = requestModelManager(async () => defaultManager, loader);
registerAskRoutes({ config, getLLMManager });
register("POST", "/page-model-probe", async (_req, res, { body }) => {
  const manager = await getLLMManager();
  await new Promise(resolve => setTimeout(resolve, body.delay || 0));
  assert.equal(await getLLMManager(), manager, "one config snapshot per request");
  await manager.generateWithFallback("test", "test", { taskType: body.task || "grammar" });
  res.writeHead(200);
  res.end(JSON.stringify({ provider: manager.getCurrentProviderName() }));
});
async function invoke(url, profileId, body = {}) {
  let status;
  let payload;
  const headers = profileId === undefined ? {} : { "x-igt-model-profile": profileId };
  await dispatch({ method: "POST", url, headers, setTimeout() {}, on(event, cb) { if (event === "data") cb(JSON.stringify(body)); if (event === "end") cb(); } }, {
    setTimeout() {}, writeHead(value) { status = value; }, end(raw) { payload = JSON.parse(raw); },
  });
  return { status, ...payload };
}
try {
  const envBefore = fs.readFileSync(loader.envPath, "utf8");
  const [writing, ask, coach] = await Promise.all([
    invoke("/page-model-probe", "writing", { delay: 25 }),
    invoke("/ask", "ask", { question: "Why?", messages: [], language: "en" }),
    invoke("/page-model-probe", "local", { task: "coach" }),
  ]);
  assert.equal(writing.status, 200, JSON.stringify(writing));
  assert.equal(ask.status, 200, JSON.stringify(ask));
  assert.equal(ask.data.answer, "A useful explanation.");
  assert.equal(ask.perf.model, "ask-fast");
  assert.equal(coach.status, 200);
  assert.equal(calls.find(call => call.url === "/writing/v1/chat/completions").key, "Bearer writing-only");
  assert.equal(calls.find(call => call.url === "/writing/v1/chat/completions").model, "writing-fast");
  assert.equal(calls.find(call => call.url === "/ask/v1/chat/completions").key.trim(), "Bearer", "Ask's keyless endpoint never inherits the global key");
  assert.equal(calls.find(call => call.url === "/ask/v1/chat/completions").model, "ask-fast");
  assert.equal(calls.find(call => call.url === "/local/api/chat").model, "local-pro");
  assert.equal(config.CustomFlashModel, "default-fast");
  assert.equal(defaultManager.getCurrentProviderName(), "custom");
  assert.equal(process.env.IGT_CUSTOM_API_KEY, "global-key");
  assert.equal(fs.readFileSync(loader.envPath, "utf8"), envBefore, "page choices do not write global settings");
  assert.equal((await invoke("/page-model-probe", "missing")).status, 404);
  assert.equal((await invoke("/page-model-probe", ["writing", "ask"])).status, 400);
  assert.equal((await invoke("/page-model-probe")).status, 200, "clients without a page choice retain the configured default");
  assert.equal(calls.at(-1).model, "default-fast");
  console.log("Independent page models: concurrent providers/roles, real Ask routing, isolated keys, unchanged defaults/env, invalid IDs and legacy clients passed.");
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
}
