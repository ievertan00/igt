import { describe, it } from "node:test";
import assert from "node:assert";
import { registerTranslationRoutes } from "../lib/server/routes/translation.mjs";
import { registerQuizRoutes } from "../lib/server/routes/quiz.mjs";
import { dispatch } from "../lib/server/router.mjs";
import ollama from "../lib/server/llm/ollama.mjs";
import { parseQuizQuestions } from "../lib/features/quiz/prompts.mjs";
import { formatQuizFeedback } from "../lib/cli/commands/quiz.mjs";
import { isSimilarQuizQuestion } from "../lib/features/quiz/history.mjs";

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

describe("quiz routes", () => {
  let malformedFirst = false;
  let quizWriterCalls = 0;
  let quizHistory = [];
  const records = [{
    error_type: "Articles",
    original_text: "I went to bank.",
    correction: "I went to the bank.",
    explanation: "A specific place needs the definite article.",
    rule: "Use the before a specific place.",
    tip: "Ask whether the listener knows which place.",
    recurrence: 4,
  }];

  const mockLLMManager = {
    getCurrentProviderName: () => "mock",
    generateWithFallback: async (input, prompt, options) => {
      assert.strictEqual(options.taskType, "practice");
      assert.strictEqual(options.jsonSchema.type, "object");
      if (prompt.includes("quiz writer")) {
        quizWriterCalls += 1;
        const request = JSON.parse(input);
        if (request.excluded_questions?.includes("我去了我们常去的那家银行。")) {
          return JSON.stringify({ questions: [{ chinese: "我昨天在车站遇到了大学同学。", reference_answer: "I ran into a college classmate at the station yesterday.", focus: "Past tense", error_type: "Verb Tense" }] });
        }
        if (malformedFirst && quizWriterCalls === 1) return '{"questions":[{"chinese":"截断的题目"';
        assert.match(input, /Articles/);
        return JSON.stringify({
          questions: [{
            prompt: "我去了我们常去的那家银行。",
            reference_answer: "I went to the bank we usually use.",
            focus: "Use the definite article for a specific place.",
          }],
        });
      }
      assert.match(input, /I went to the bank yesterday\./);
      return JSON.stringify({
        score: 88,
        verdict: "good",
        corrected_answer: "I went to the bank yesterday.",
        feedback_zh: "意思准确，冠词使用正确。",
        strengths_zh: ["正确使用了 the"],
        improvements_zh: ["可以补充更自然的时间位置"],
      });
    },
  };

  registerQuizRoutes({
    getLLMManager: async () => mockLLMManager,
    loadQuizRecords: async () => records,
    loadQuizHistory: async () => quizHistory,
    persistQuizQuestions: async () => 0,
  });

  function callRoute(url, body) {
    let status = 0;
    let responseBody = "";
    const req = {
      method: "POST",
      url,
      on: (event, cb) => {
        if (event === "data") cb(JSON.stringify(body));
        if (event === "end") cb();
      },
      setTimeout: () => {},
    };
    const res = {
      writeHead: (value) => { status = value; },
      end: (value) => { responseBody = value; },
      setTimeout: () => {},
    };
    return { req, res, result: () => ({ status, body: JSON.parse(responseBody) }) };
  }

  it("generates questions from handbook-source records", async () => {
    const call = callRoute("/quiz/generate", { count: 1, days: 30 });
    await dispatch(call.req, call.res);
    const result = call.result();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.questions.length, 1);
    assert.strictEqual(result.body.data.questions[0].chinese, "我去了我们常去的那家银行。");
    assert.strictEqual(result.body.data.record_count, 1);
  });

  it("generates multiple questions as short independent requests", async () => {
    quizWriterCalls = 0;
    const call = callRoute("/quiz/generate", { count: 2, days: 30 });
    await dispatch(call.req, call.res);
    const result = call.result();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.questions.length, 2);
    assert.strictEqual(quizWriterCalls, 2);
  });

  it("replaces a prompt that already exists in quiz history", async () => {
    quizHistory = [{ chinese: "我去了我们常去的那家银行。" }];
    try {
      const call = callRoute("/quiz/generate", { count: 1, days: 30 });
      await dispatch(call.req, call.res);
      const result = call.result();
      assert.strictEqual(result.status, 200);
      assert.strictEqual(result.body.data.questions[0].chinese, "我昨天在车站遇到了大学同学。");
    } finally {
      quizHistory = [];
    }
  });

  it("returns a clear error when no handbook records exist", async () => {
    const previous = records.splice(0);
    try {
      const call = callRoute("/quiz/generate", { count: 2 });
      await dispatch(call.req, call.res);
      const result = call.result();
      assert.strictEqual(result.status, 422);
      assert.match(result.body.error, /handbook records/i);
    } finally {
      records.push(...previous);
    }
  });

  it("retries when the quiz writer returns malformed JSON", async () => {
    malformedFirst = true;
    quizWriterCalls = 0;
    try {
      const call = callRoute("/quiz/generate", { count: 1, days: 30 });
      await dispatch(call.req, call.res);
      const result = call.result();
      assert.strictEqual(result.status, 200);
      assert.strictEqual(result.body.data.questions.length, 1);
      assert.strictEqual(quizWriterCalls, 2);
    } finally {
      malformedFirst = false;
    }
  });

  it("evaluates an English answer and returns Chinese feedback", async () => {
    const call = callRoute("/quiz/evaluate", {
      question: {
        chinese: "我昨天去了银行。",
        reference_answer: "I went to the bank yesterday.",
        focus: "Definite article",
        error_type: "Articles",
      },
      answer: "I went to the bank yesterday.",
    });
    await dispatch(call.req, call.res);
    const result = call.result();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.data.score, 88);
    assert.match(result.body.data.feedback_zh, /冠词/);
  });

  it("rejects an empty English answer", async () => {
    const call = callRoute("/quiz/evaluate", { question: {}, answer: "" });
    await dispatch(call.req, call.res);
    const result = call.result();
    assert.strictEqual(result.status, 400);
    assert.match(result.body.error, /answer/i);
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
  it("detects exact and near-duplicate Chinese prompts", () => {
    assert.equal(isSimilarQuizQuestion("这些设置可以被关闭，但不能重新开启。", "这些设置可以被关闭，但无法再次开启。"), true);
    assert.equal(isSimilarQuizQuestion("我昨天在车站遇到了同学。", "我今天在办公室提交了申请。"), false);
  });
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

