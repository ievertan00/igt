// validateActiveProviderKeys: empty key array for active provider → exit with clear message.
// Mirrors the function in lib/igt-http-server.mjs (which can't be imported without binding port).
import { test } from "node:test";
import assert from "node:assert/strict";

function makeManager(providerName) {
  return { getCurrentProviderName: () => providerName };
}

function validateActiveProviderKeys(manager, config) {
  const provider = (manager.getCurrentProviderName() || "").toLowerCase();
  const map = {
    gemini:   { keys: "GeminiApiKeys",   env: "GOOGLE_API_KEYS" },
    qwen:     { keys: "QwenApiKeys",     env: "DASHSCOPE_API_KEYS" },
    deepseek: { keys: "DeepseekApiKeys", env: "DEEPSEEK_API_KEYS" },
  };
  const entry = map[provider];
  if (!entry) return { ok: true };
  const keys = config[entry.keys];
  if (!Array.isArray(keys) || keys.length === 0) {
    return { ok: false, message: `Error: No API keys configured for "${provider}". Add ${entry.env} to .env\n` };
  }
  return { ok: true };
}

test("gemini with empty key array is rejected with GOOGLE_API_KEYS hint", () => {
  const r = validateActiveProviderKeys(makeManager("gemini"), { GeminiApiKeys: [] });
  assert.equal(r.ok, false);
  assert.match(r.message, /No API keys configured for "gemini"/);
  assert.match(r.message, /GOOGLE_API_KEYS/);
});

test("qwen with populated key array passes", () => {
  const r = validateActiveProviderKeys(makeManager("qwen"), { QwenApiKeys: ["sk-x"] });
  assert.equal(r.ok, true);
});

test("deepseek with missing key array (undefined) is rejected", () => {
  const r = validateActiveProviderKeys(makeManager("deepseek"), {});
  assert.equal(r.ok, false);
  assert.match(r.message, /DEEPSEEK_API_KEYS/);
});

test("unknown provider is a no-op (returns ok)", () => {
  const r = validateActiveProviderKeys(makeManager("anthropic"), {});
  assert.equal(r.ok, true);
});

test("each provider points at its own env var", () => {
  assert.match(validateActiveProviderKeys(makeManager("gemini"),   { GeminiApiKeys:   [] }).message, /GOOGLE_API_KEYS/);
  assert.match(validateActiveProviderKeys(makeManager("qwen"),     { QwenApiKeys:     [] }).message, /DASHSCOPE_API_KEYS/);
  assert.match(validateActiveProviderKeys(makeManager("deepseek"), { DeepseekApiKeys: [] }).message, /DEEPSEEK_API_KEYS/);
});
