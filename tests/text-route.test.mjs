import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerTextRoutes } from "../lib/server/routes/text.mjs";
import { dispatch } from "../lib/server/router.mjs";
import { parseTextAnalysis } from "../lib/server/routes/text.mjs";
import { TEXT_ANALYSIS_RESPONSE_SCHEMA } from "../lib/features/text/analysis.mjs";
import { textDataToMarkdown } from "../lib/cli/commands/render.mjs";
import { resolveModel } from "../lib/server/llm/model-resolver.mjs";

function callRoute(body) {
  let status = 0;
  let responseBody = "";
  const req = {
    method: "POST",
    url: "/text",
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

describe("text analysis", () => {
  it("uses the four-field contract and preserves paragraph evidence", () => {
    const data = parseTextAnalysis(JSON.stringify({
      correction: "I sent the report yesterday.",
      refine: "I sent over the report yesterday.",
      diagnoses: [{
        error_type: "Coherence",
        scope: "paragraph",
        severity: "Moderate",
        evidence: "However, ...",
        explanation: "The transition does not match the preceding contrast.",
        suggestion: "Use a continuation transition.",
      }],
      remember: ["Make each transition express the relationship between paragraphs."],
      review: "must be ignored",
      rule: "must be ignored",
      tip: "must be ignored",
    }));

    assert.deepEqual(Object.keys(data), ["correction", "refine", "diagnoses", "remember"]);
    assert.equal(data.diagnoses[0].scope, "paragraph");
    assert.equal(data.diagnoses[0].evidence, "However, ...");
    assert.equal(TEXT_ANALYSIS_RESPONSE_SCHEMA.required.includes("remember"), true);
  });

  it("passes task type text and the new schema to the model", async () => {
    let receivedOptions;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "igt-text-route-"));
    const llm = {
      getCurrentProviderName: () => "mock",
      generateWithFallback: async (_input, _prompt, options) => {
        receivedOptions = options;
        return JSON.stringify({ correction: "Corrected.", refine: "Better.", diagnoses: [], remember: [] });
      },
    };
    try {
      registerTextRoutes({
        getLLMManager: async () => llm,
        getConfig: () => ({ ReviewPath: path.join(tempDir, "review.md") }),
      });

      const call = callRoute({ text: "A complete paragraph." });
      await dispatch(call.req, call.res);
      const result = call.result();

      assert.equal(result.status, 200);
      assert.equal(receivedOptions.taskType, "text");
      assert.deepEqual(Object.keys(result.body.data), ["correction", "refine", "diagnoses", "remember"]);
      assert.equal(result.body.persistence.saved, true);
      assert.match(fs.readFileSync(path.join(tempDir, "review.md"), "utf8"), /A complete paragraph\./);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("routes text analysis to the pro model", () => {
    const result = resolveModel("gemini", "text", { GeminiProModel: "test-pro" });
    assert.equal(result.model, "test-pro");
  });

  it("does not persist a duplicate natural rewrite", () => {
    const markdown = textDataToMarkdown({
      correction: "A clear paragraph.",
      refine: "A clear  paragraph.\n",
      diagnoses: [],
      remember: ["Keep one idea per paragraph."],
    });
    assert.doesNotMatch(markdown, /\*\*Refine\*\*/);
    assert.match(markdown, /\*\*Remember\*\*/);
  });
});
