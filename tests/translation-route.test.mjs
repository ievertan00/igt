import { describe, it } from "node:test";
import assert from "node:assert";
import { registerTranslationRoutes } from "../lib/server/routes/translation.mjs";
import { dispatch } from "../lib/server/router.mjs";
import ollama from "../lib/server/llm/ollama.mjs";
import { parseQuizQuestions } from "../lib/features/quiz/prompts.mjs";
import { formatQuizFeedback } from "../lib/cli/commands/quiz.mjs";

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
      // Canonical provider-agnostic option — the provider, not the route,
      // translates this to responseSchema / response_format / format:json.
      assert.ok(options.jsonSchema, "route should pass a canonical jsonSchema");
      assert.strictEqual(options.jsonSchema.type, "object");
      return JSON.stringify({ translation: "Hello" });
    };

    let status = 0;
    let responseBody = "";

    const req = {
      method: "POST",
      url: "/translation",
      on: (event, cb) => {
        if (event === "data") cb(JSON.stringify({ text: "你好", direction: "zh2en" }));
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
        if (event === "data") cb(JSON.stringify({ text: "这是一个测试", direction: "zh2en" }));
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

describe("Ollama structured output", () => {
  it("passes the canonical JSON schema to Ollama's format field", async () => {
    const originalFetch = globalThis.fetch;
    let requestBody;
    globalThis.fetch = async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ message: { content: '{"value":"ok"}' } }),
      };
    };
    const schema = {
      type: "object",
      properties: { value: { type: "string" } },
      required: ["value"],
    };
    try {
      await ollama.generateWithFallback("input", "prompt", {
        config: {
          OllamaBaseUrl: "http://localhost:11434",
          OllamaFamily: "gemma",
          OllamaGemmaFlashModel: "gemma4:12b",
        },
        taskType: "practice",
        jsonSchema: schema,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.deepStrictEqual(requestBody.format, schema);
  });
});

describe("quiz content quality", () => {
  it("rejects meta-instructions and non-English reference answers", () => {
    const questions = parseQuizQuestions(JSON.stringify({
      questions: [
        {
          chinese: "请根据提供的纠错数据，总结出最核心的 3 条改进建议。",
          reference_answer: "1. 修正语法。2. 改进表达。",
          focus: "Summary",
          error_type: "Summary",
        },
        {
          chinese: "我本来想早点出发，但最后还是错过了火车。",
          reference_answer: "I meant to leave earlier, but I still missed the train.",
          focus: "Past tense and contrast",
          error_type: "Verb Tense",
        },
      ],
    }), 2);
    assert.strictEqual(questions.length, 1);
    assert.match(questions[0].reference_answer, /^I meant/);
  });

  it("formats feedback into spaced sections and prioritizes one recommendation", () => {
    const output = formatQuizFeedback({
      score: 65,
      feedback_zh: "你的翻译整体准确，并且正确使用了现在完成时（haven't received）来表达持续到现在的状态。",
      corrected_answer: "Summarize the three key suggestions concisely.",
      strengths_zh: ["句子结构完整。"],
      improvements_zh: ["补充 concisely。"],
    }, {
      reference_answer: "Summarize the three key suggestions concisely.",
    }, 60).replace(/\x1b\[[0-9;]*m/g, "");

    assert.match(output, /点评\n\s+你的翻译整体准确/);
    assert.match(output, /\n\n做得好的地方\n/);
    assert.match(output, /\n\n下一步\n/);
    assert.match(output, /\n\n推荐表达\n/);
    assert.doesNotMatch(output, /参考表达/);
    assert.doesNotMatch(output, /rece\n\s*ived/);
  });
});

