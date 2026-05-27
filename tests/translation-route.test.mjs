import { describe, it } from "node:test";
import assert from "node:assert";
import { registerTranslationRoutes } from "../lib/server/routes/translation.mjs";
import { dispatch } from "../lib/server/router.mjs";

describe("translation route", () => {
  let llmGenerateMock;
  
  const mockLLMManager = {
    getCurrentProviderName: () => "mock",
    generateWithFallback: async (input, prompt, options) => {
      return llmGenerateMock(input, prompt, options);
    }
  };

  registerTranslationRoutes({ getLLMManager: async () => mockLLMManager });

  it("should return 400 if text is missing", async () => {
    let status = 0;
    let responseBody = "";
    
    const req = {
      method: "POST",
      url: "/translation",
      on: (event, cb) => {
        if (event === "data") cb(JSON.stringify({}));
        if (event === "end") cb();
      },
      setTimeout: () => {}
    };

    const res = {
      writeHead: (s) => { status = s; },
      end: (data) => { responseBody = data; },
      setTimeout: () => {}
    };

    await dispatch(req, res);

    assert.strictEqual(status, 400);
    assert.match(responseBody, /Missing 'text'/);
  });

  it("should call llm and return translation successfully", async () => {
    llmGenerateMock = async (input, prompt, options) => {
      assert.strictEqual(input, "你好");
      assert.strictEqual(options.taskType, "translation");
      assert.strictEqual(options.responseFormat.type, "json_object");
      return JSON.stringify({ translation: "Hello" });
    };

    let status = 0;
    let responseBody = "";

    const req = {
      method: "POST",
      url: "/translation",
      on: (event, cb) => {
        if (event === "data") cb(JSON.stringify({ text: "你好" }));
        if (event === "end") cb();
      },
      setTimeout: () => {}
    };

    const res = {
      writeHead: (s) => { status = s; },
      end: (data) => { responseBody = data; },
      setTimeout: () => {}
    };

    await dispatch(req, res);

    assert.strictEqual(status, 200);
    const parsed = JSON.parse(responseBody);
    assert.strictEqual(parsed.data.translation, "Hello");
    assert.ok(parsed.perf.llm_ms !== undefined);
  });

  it("should handle plain text fallback correctly", async () => {
    llmGenerateMock = async (input) => {
      assert.strictEqual(input, "这是一个测试");
      return "This is a test"; // Returning non-JSON string
    };

    let status = 0;
    let responseBody = "";

    const req = {
      method: "POST",
      url: "/translation",
      on: (event, cb) => {
        if (event === "data") cb(JSON.stringify({ text: "这是一个测试" }));
        if (event === "end") cb();
      },
      setTimeout: () => {}
    };

    const res = {
      writeHead: (s) => { status = s; },
      end: (data) => { responseBody = data; },
      setTimeout: () => {}
    };

    await dispatch(req, res);

    assert.strictEqual(status, 200);
    const parsed = JSON.parse(responseBody);
    assert.strictEqual(parsed.data.translation, "This is a test");
  });
});

