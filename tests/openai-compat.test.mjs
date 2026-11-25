import { test } from "node:test";
import assert from "node:assert/strict";

import { createOpenAICompatProvider } from "../lib/server/llm/openai-compat.mjs";
import qwen from "../lib/server/llm/qwen.mjs";
import deepseek from "../lib/server/llm/deepseek.mjs";

const PROVIDER_INTERFACE = ["name", "generate", "generateWithFallback", "generateWithTools", "getApiKeys", "getModelName"];


// A spec with isolated env var names so tests never collide with real keys.
function makeSpec(overrides = {}) {
  return {
    name: "testprov",
    defaultBaseUrl: "https://example.test/v1",
    baseUrlConfigKey: "TestApiBase",
    keyEnvVars: ["TESTPROV_API_KEY", "TESTPROV_ALT_KEY"],
    keyConfigArray: "TestApiKeys",
    keyConfigSingle: "TestApiKey",
    ...overrides,
  };
}

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("qwen and deepseek expose the identical provider interface", () => {
  for (const p of [qwen, deepseek]) {
    for (const member of PROVIDER_INTERFACE) {
      assert.ok(member in p, `${p.name} missing ${member}`);
    }
    for (const fn of PROVIDER_INTERFACE.slice(1)) {
      assert.equal(typeof p[fn], "function", `${p.name}.${fn} should be a function`);
    }
  }
  assert.equal(qwen.name, "qwen");
  assert.equal(deepseek.name, "deepseek");
});

test("getApiKeys: config array wins and is de-duplicated", () => {
  const provider = createOpenAICompatProvider(makeSpec());
  withEnv({ TESTPROV_API_KEY: undefined, TESTPROV_ALT_KEY: undefined }, () => {
    const keys = provider.getApiKeys({ TestApiKeys: ["sk-1", "sk-2", "sk-1"] });
    assert.deepEqual(keys, ["sk-1", "sk-2"]);
  });
});

test("getApiKeys: env vars are collected in order, then config keys", () => {
  const provider = createOpenAICompatProvider(makeSpec());
  withEnv({ TESTPROV_API_KEY: "env-1", TESTPROV_ALT_KEY: "env-2" }, () => {
    const keys = provider.getApiKeys({ TestApiKeys: ["cfg-1"] });
    assert.deepEqual(keys, ["env-1", "env-2", "cfg-1"]);
  });
});

test("getApiKeys: single-key config field is the fallback when array is absent", () => {
  const provider = createOpenAICompatProvider(makeSpec());
  withEnv({ TESTPROV_API_KEY: undefined, TESTPROV_ALT_KEY: undefined }, () => {
    assert.deepEqual(provider.getApiKeys({ TestApiKey: "solo" }), ["solo"]);
    assert.deepEqual(provider.getApiKeys({ TestApiKeys: [], TestApiKey: "solo" }), ["solo"]);
  });
});

test("getApiKeys: empty when nothing is configured", () => {
  const provider = createOpenAICompatProvider(makeSpec());
  withEnv({ TESTPROV_API_KEY: undefined, TESTPROV_ALT_KEY: undefined }, () => {
    assert.deepEqual(provider.getApiKeys({}), []);
  });
});

test("getModelName routes through the model resolver per task tier", () => {
  // Flash tasks and the pro (handbook) task resolve to their configured fields.
  assert.equal(qwen.getModelName({ QwenFlashModel: "qwen-flash-x" }, "grammar"), "qwen-flash-x");
  assert.equal(qwen.getModelName({ QwenProModel: "qwen-pro-x" }, "handbook"), "qwen-pro-x");
  assert.equal(deepseek.getModelName({ DeepseekFlashModel: "ds-flash-x" }, "ask"), "ds-flash-x");
});

test("real qwen/deepseek specs read their own key sources independently", () => {
  withEnv({ DASHSCOPE_API_KEY: undefined, QWEN_API_KEY: undefined, DEEPSEEK_API_KEY: undefined }, () => {
    assert.deepEqual(qwen.getApiKeys({ QwenApiKeys: ["q1"] }), ["q1"]);
    assert.deepEqual(qwen.getApiKeys({ DeepseekApiKeys: ["d1"] }), []); // qwen ignores deepseek's field
    assert.deepEqual(deepseek.getApiKeys({ DeepseekApiKeys: ["d1"] }), ["d1"]);
  });
});
