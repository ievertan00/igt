import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { ConfigLoader } from "../lib/shared/config-loader.mjs";
import { registerLlmSettingsRoutes } from "../lib/server/routes/llm-settings.mjs";
import { dispatch } from "../lib/server/router.mjs";
import { initializeLLMProviders } from "../lib/server/llm/init.mjs";

const root = fs.mkdtempSync(path.join(process.cwd(), ".cache", "model-settings-"));
const originalEnv = { ...process.env };
const calls = [];
const server = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  calls.push({ url: req.url, authorization: req.headers.authorization, body: JSON.parse(raw) });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { content: "OK" } }], message: { content: "OK" } }));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const endpoint = `http://127.0.0.1:${server.address().port}`;
fs.writeFileSync(path.join(root, "igt_config.json"), JSON.stringify({ OllamaFamily: "gemma", GeminiProModel: "unused", QwenProModel: "unused", DeepseekProModel: "unused" }));
fs.writeFileSync(path.join(root, ".env"), `# Keep user comments\nIGT_LLM_PROVIDER=custom\nIGT_CUSTOM_API_BASE=${endpoint}/original/v1\nIGT_CUSTOM_FLASH_MODEL=original-flash\nIGT_CUSTOM_PRO_MODEL=original-pro\nIGT_CUSTOM_API_KEYS=original-secret\n`);
process.env.IGT_LLM_PROVIDER = "custom";
delete process.env.IGT_CUSTOM_API_KEY;
const loader = new ConfigLoader(root);
const config = loader.load();
const manager = initializeLLMProviders(config);
registerLlmSettingsRoutes({ config, loader, getLLMManager: async () => manager });

async function request(method, url, body = {}) {
  let status;
  let payload;
  await dispatch({ method, url, on(event, cb) { if (event === "data") cb(JSON.stringify(body)); if (event === "end") cb(); } }, {
    writeHead(code) { status = code; }, end(raw) { payload = JSON.parse(raw); },
  });
  return { status, ...payload };
}
const save = (name, provider, apiKey = "", id = "") => request("POST", "/settings/llm", {
  profileId: id, profileName: name, provider,
  models: { [provider]: { flash: `${name}-flash`, pro: `${name}-pro` } },
  baseUrls: { [provider === "ollama" ? "OllamaBaseUrl" : "CustomApiBase"]: `${endpoint}/${name}/v1` },
  apiKeys: { [provider]: apiKey },
});

try {
  const initial = await request("GET", "/settings/llm");
  assert.equal(initial.activeProfileId, "current");
  assert.equal(initial.profiles[0].models.flash, "original-flash");
  assert.ok(!JSON.stringify(initial).includes("original-secret"));

  const a = await save("Cloud", "custom", "cloud-secret#with$characters");
  assert.equal(a.status, 200);
  assert.equal(a.profiles.length, 2, "first new save preserves original setup");
  const cloudId = a.activeProfileId;
  assert.ok(cloudId);
  assert.ok(!JSON.stringify(a).includes("cloud-secret"));
  const b = await save("Local", "custom");
  assert.equal(b.status, 200);
  const localId = b.activeProfileId;
  assert.equal(b.providers.custom.keyConfigured, false, "new setup does not inherit another endpoint's credentials");
  await manager.generate("hello", "test", { taskType: "grammar" });
  assert.equal(calls.at(-1).url, "/Local/v1/chat/completions");
  assert.equal(calls.at(-1).authorization?.trim(), "Bearer");
  assert.equal(calls.at(-1).body.model, "Local-flash");

  const activate = id => request("POST", "/settings/llm", { action: "activate", profileId: id });
  assert.equal((await activate(cloudId)).activeProfileId, cloudId);
  await manager.generate("hello", "test", { taskType: "coach" });
  assert.equal(calls.at(-1).url, "/Cloud/v1/chat/completions");
  assert.equal(calls.at(-1).authorization, "Bearer cloud-secret#with$characters");
  assert.equal(calls.at(-1).body.model, "Cloud-pro");

  const connection = await request("POST", "/settings/llm/test", { profileId: localId, model: "probe", baseUrl: `${endpoint}/probe/v1` });
  assert.equal(connection.status, 200);
  assert.equal(calls.at(-1).authorization?.trim(), "Bearer", "testing keyless setup cannot reuse the active key");
  const edited = await save("CloudUpdated", "custom", "", cloudId);
  assert.equal(edited.profiles.length, 3);
  assert.deepEqual(loader.load().CustomApiKeys, ["cloud-secret#with$characters"], "special key characters survive dotenv reload");
  await manager.generate("hello", "test", { taskType: "practice" });
  assert.equal(calls.at(-1).authorization, "Bearer cloud-secret#with$characters", "blank edit retains this profile's key");
  assert.equal(calls.at(-1).body.model, "CloudUpdated-flash");

  const ollama = await save("Ollama", "ollama");
  assert.equal(ollama.status, 200);
  const ollamaId = ollama.activeProfileId;
  await manager.generate("hello", "test", { taskType: "grammar" });
  assert.equal(calls.at(-1).body.model, "Ollama-flash");
  assert.equal(manager.getCurrentProviderName(), "ollama");
  await activate(cloudId);
  await activate(ollamaId);
  assert.equal(config.OllamaFamily, "gemma");
  assert.equal((await request("GET", "/settings/llm")).activeProfileId, ollamaId);

  await activate("current");
  await manager.generate("hello", "test", { taskType: "grammar" });
  assert.equal(calls.at(-1).body.model, "original-flash");
  assert.equal(calls.at(-1).authorization, "Bearer original-secret");

  const clear = await request("POST", "/settings/llm", {
    profileId: cloudId, profileName: "CloudUpdated", provider: "custom",
    models: { custom: { flash: "CloudUpdated-flash", pro: "CloudUpdated-pro" } },
    baseUrls: { CustomApiBase: `${endpoint}/CloudUpdated/v1` }, clearApiKeys: { custom: true },
  });
  assert.equal(clear.status, 200);
  assert.equal(clear.providers.custom.keyConfigured, false);
  await manager.generate("hello", "test", { taskType: "grammar" });
  assert.equal(calls.at(-1).authorization?.trim(), "Bearer");
  await activate("current");
  const restarted = loader.load();
  const restartedManager = initializeLLMProviders(restarted);
  await restartedManager.generate("hello", "test", { taskType: "coach" });
  assert.equal(calls.at(-1).body.model, "original-pro", "active models persist after reload");
  assert.equal(calls.at(-1).authorization, "Bearer original-secret");

  const beforeCopy = await request("GET", "/settings/llm");
  const originalProfile = beforeCopy.profiles.find(p => p.id === "current");
  const copy = await request("POST", "/settings/llm", {
    action: "create", profileId: "current", profileName: "Another cloud model", provider: "custom",
    models: { custom: { flash: "another-flash", pro: "another-pro" } },
    baseUrls: { CustomApiBase: originalProfile.baseUrl },
  });
  assert.equal(copy.status, 200);
  assert.notEqual(copy.activeProfileId, "current", "save as new always creates a distinct configuration");
  assert.equal(copy.profiles.length, beforeCopy.profiles.length + 1);
  assert.deepEqual(copy.profiles.find(p => p.id === "current"), originalProfile, "save as new preserves the complete previous configuration");
  await manager.generate("hello", "test", { taskType: "grammar" });
  assert.equal(calls.at(-1).body.model, "another-flash");
  assert.equal(calls.at(-1).authorization, "Bearer original-secret", "copy retains the explicitly selected source credentials");
  const persistedCopyId = copy.activeProfileId;
  assert.equal((await request("GET", "/settings/llm")).profiles.some(p => p.id === persistedCopyId), true);
  await activate("current");
  await manager.generate("hello", "test", { taskType: "grammar" });
  assert.equal(calls.at(-1).body.model, "original-flash", "previous model remains usable after saving a new one");

  const beforeInvalid = fs.readFileSync(loader.envPath, "utf8");
  for (const bad of [
    { action: "activate", profileId: "missing" },
    { profileName: "", provider: "custom" },
    { profileName: "bad", provider: "custom", models: { custom: { flash: "x", pro: "y" } }, baseUrls: { CustomApiBase: "file:///secret" } },
    { profileName: "bad", provider: "custom", models: { custom: { flash: "", pro: "y" } }, baseUrls: { CustomApiBase: endpoint } },
  ]) assert.ok((await request("POST", "/settings/llm", bad)).status >= 400);
  assert.equal(fs.readFileSync(loader.envPath, "utf8"), beforeInvalid);
  const write = loader.updateEnv;
  loader.updateEnv = () => { throw new Error("Simulated storage failure"); };
  assert.equal((await activate(localId)).status, 500);
  assert.equal(manager.getCurrentProviderName(), "custom");
  assert.equal(config.CustomFlashModel, "original-flash", "failed persistence keeps live config unchanged");
  loader.updateEnv = write;
  assert.ok(beforeInvalid.includes("# Keep user comments"));

  // setDefault:false registers a saved model without switching the active setup.
  const beforePassive = await request("GET", "/settings/llm");
  const passive = await request("POST", "/settings/llm", {
    profileId: "", profileName: "Passive", provider: "custom",
    models: { custom: { flash: "passive-flash", pro: "passive-pro" } },
    baseUrls: { CustomApiBase: `${endpoint}/passive/v1` },
    setDefault: false,
  });
  assert.equal(passive.status, 200);
  assert.equal(passive.activeProfileId, beforePassive.activeProfileId, "setDefault:false keeps the active setup");
  assert.ok(passive.profiles.some(p => p.name === "Passive"), "registered profile is listed");
  const passiveId = passive.profiles.find(p => p.name === "Passive").id;
  // Deleting a saved model removes it from the pool; deleting a missing one is 404.
  const deleted = await request("POST", "/settings/llm", { action: "delete", profileId: passiveId });
  assert.equal(deleted.status, 200);
  assert.ok(!deleted.profiles.some(p => p.id === passiveId), "saved model is removed");
  assert.equal((await request("POST", "/settings/llm", { action: "delete", profileId: "missing" })).status, 404);
  // Deleting the active profile clears the pointer so nothing stays dangling.
  await activate(cloudId);
  assert.equal((await request("GET", "/settings/llm")).activeProfileId, cloudId);
  const removedActive = await request("POST", "/settings/llm", { action: "delete", profileId: cloudId });
  assert.equal(removedActive.status, 200);
  assert.notEqual(removedActive.activeProfileId, cloudId, "deleting the active profile resets the default");
  assert.ok(!removedActive.profiles.some(p => p.id === cloudId));
  await activate("current");

  // Existing native provider setups migrate using their active endpoint and key,
  // even if another compatible connection was saved earlier.
  loader.updateEnv({ IGT_LLM_PROFILES: "", IGT_LLM_ACTIVE_PROFILE: "", IGT_LLM_PROVIDER: "qwen", IGT_QWEN_API_BASE: `${endpoint}/legacy/v1`, DASHSCOPE_API_KEYS: "legacy-secret", IGT_QWEN_FLASH_MODEL: "legacy-flash", IGT_QWEN_PRO_MODEL: "legacy-pro" });
  process.env.IGT_LLM_PROVIDER = "qwen";
  const legacy = await request("GET", "/settings/llm");
  assert.equal(legacy.profiles[0].baseUrl, `${endpoint}/legacy/v1`);
  assert.equal(legacy.profiles[0].models.flash, "legacy-flash");
  assert.equal((await activate("current")).status, 200);
  await manager.generate("hello", "test", { taskType: "grammar" });
  assert.equal(calls.at(-1).url, "/legacy/v1/chat/completions");
  assert.equal(calls.at(-1).authorization, "Bearer legacy-secret");
  console.log("Model profiles: persistence, masked credentials, isolated keys, updates, provider/role switching, reload, validation and storage failure checks passed.");
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
}
