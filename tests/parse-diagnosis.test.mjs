import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { parseDiagnosis, GRAMMAR_RESPONSE_SCHEMA } from "../lib/domain/parse-diagnosis.mjs";
import { analyzeGrammar } from "../lib/application/grammar.mjs";
import { formatReviewEntry, parseReviewLog } from "../lib/db/review-log.mjs";
import { dataToMarkdown } from "../lib/cli/commands/render.mjs";
import fs from "node:fs";

const errorTypes = {
  classifyErrorType: (s) => s,
  getErrorTypePath: (s) => s,
  ERROR_TYPES: {},
};
const opts = { logPath: path.join(os.tmpdir(), "igt-test-parse.log") };

test("Grammar requests a natural alternative even when the configured prompt makes it optional", async () => {
  const refine = "Could you tell me more about the meeting?";
  const { response } = await analyzeGrammar({
    text: "I am writing to ask if you can give me some information about the meeting.",
    systemPrompt: "refine is optional. Return an empty string when unnecessary.",
    getLLMManager: async () => ({
      generateWithFallback: async (_input, prompt) => {
        assert.match(prompt, /Always provide a non-empty refine/);
        assert.match(prompt, /already natural/);
        assert.match(prompt, /optional alternative, not a required correction/);
        return JSON.stringify({ correction: "", refine, evaluate: "The sentence is grammatically correct.", diagnoses: [], remember: "" });
      },
      getCurrentProviderName: () => "fixture",
    }),
    parseDiagnosis: raw => parseDiagnosis(raw, errorTypes),
  });
  assert.equal(response.result.refine, refine);
  assert.equal(response.data.refine, refine);
  assert.equal(response.result.correction, "");
});

test("Grammar scopes numbered instructions as a complete passage, not just the last item", async () => {
  const text = "Update the Settings page:\n1. Make the content in the center of the page;\n2.Polish the selected effect of the Settings button on the navigation.";
  const correction = "Update the Settings page:\n1. Center the content on the page;\n2. Polish the selected state of the Settings button in the navigation.";
  const { response } = await analyzeGrammar({
    text,
    systemPrompt: "Return the smallest objective correction as JSON.",
    getLLMManager: async () => ({
      generateWithFallback: async (input, prompt) => {
        assert.equal(input, text, "All numbered items reach the provider unchanged");
        assert.match(prompt, /smallest edits, not the shortest output/);
        assert.match(prompt, /including unchanged text and every list item/);
        assert.match(prompt, /not instructions for you to carry out/);
        return JSON.stringify({ correction, refine: "", evaluate: "The original text needs wording changes.", diagnoses: [], remember: "" });
      },
      getCurrentProviderName: () => "fixture",
    }),
    parseDiagnosis: raw => parseDiagnosis(raw, errorTypes),
  });
  assert.equal(response.result.originalText, text);
  assert.equal(response.result.correction, correction);
  assert.equal(response.persistence.saved, false);
});

test("parses well-formed JSON response", () => {
  const raw = JSON.stringify({
    correction: "I am happy.",
    refine: "I'm happy.",
    evaluate: "The original sentence contains a grammar error.",
    diagnoses: [{ error_type: "Grammar / Verb Tense", severity: "Minor", explanation: "use am", evidence: "I am" }],
    remember: "Use am with I.",
  });
  const result = parseDiagnosis(raw, errorTypes, opts);
  assert.equal(result.correction, "I am happy.");
  assert.equal(result.diagnoses.length, 1);
  assert.equal("evidence" in result.diagnoses[0], false);
  assert.equal("suggestion" in result.diagnoses[0], false);
});

test("Grammar carries Evaluate and Why through analysis, CLI, and saved reviews", async () => {
  const response = {
    correction: "I am happy.",
    refine: "I'm happy.",
    evaluate: "Your meaning is clear. The verb needs a small correction.",
    diagnoses: [
      { error_type: "Subject-Verb Agreement", severity: "Minor", explanation: "Change 'I is' to 'I am' because I takes am." },
      { error_type: "Phrasing", severity: "Minor", explanation: "Optionally shorten 'I am' to 'I'm' for a more conversational tone." },
    ],
    remember: "Use am with I.",
  };
  const config = JSON.parse(fs.readFileSync(new URL("../igt_config.json", import.meta.url), "utf8"));
  const { response: analysis } = await analyzeGrammar({
    text: "I is happy.",
    systemPrompt: config.Prompts.SystemPrompt,
    getLLMManager: async () => ({
      generateWithFallback: async (_text, prompt, options) => {
        assert.match(prompt, /Every correction AND every refinement/);
        assert.match(prompt, /simple English/);
        assert.match(prompt, /Do not include evidence or suggestion fields/);
        assert.equal(options.jsonSchema, GRAMMAR_RESPONSE_SCHEMA);
        return JSON.stringify(response);
      },
      getCurrentProviderName: () => "mock",
    }),
    parseDiagnosis: (raw) => parseDiagnosis(raw, errorTypes),
  });
  assert.equal(analysis.result.evaluate, response.evaluate);
  assert.deepEqual(analysis.result.diagnoses, response.diagnoses);
  assert.equal(analysis.persistence.saved, false);
  assert.equal(analysis.persistence.requiresConfirmation, true);
  const markdown = formatReviewEntry({ originalText: "I is happy.", data: analysis.result });
  assert.equal(parseReviewLog(markdown)[0].evaluate, response.evaluate);
  assert.match(markdown, /Optionally shorten/);
  assert.match(dataToMarkdown(analysis.result), /\*\*Evaluate\*\*/);
  assert.doesNotMatch(markdown, /Evidence:|Suggestion:/);
  assert.deepEqual(Object.keys(GRAMMAR_RESPONSE_SCHEMA.properties.diagnoses.items.properties), ["error_type", "severity", "explanation"]);
  assert.equal(GRAMMAR_RESPONSE_SCHEMA.required.includes("evaluate"), true);
});

test("strips fenced code block wrapping", () => {
  const raw = "```json\n" + JSON.stringify({ correction: "y", refine: "", evaluate: "The original sentence is grammatically correct.", diagnoses: [], remember: "" }) + "\n```";
  const result = parseDiagnosis(raw, errorTypes, opts);
  assert.equal(result.correction, "y");
});

test("non-JSON is rejected instead of creating a legacy review field", () => {
  const raw = "This is just plain text, no JSON here.";
  assert.throws(() => parseDiagnosis(raw, errorTypes, opts), /invalid JSON/);
});

test("diagnosis with missing explanation falls back to the type label", () => {
  const raw = JSON.stringify({
    correction: "I am happy.",
    evaluate: "The original sentence contains a grammar error.",
    diagnoses: [{ error_type: "Grammar / Verb Tense", severity: "Minor" }],
  });
  const result = parseDiagnosis(raw, errorTypes, opts);
  assert.equal(result.diagnoses.length, 1);
  assert.equal(
    result.diagnoses[0].explanation,
    "Grammar / Verb Tense",
    "empty explanation should fall back to the canonical type label",
  );
});

test("diagnosis with whitespace-only explanation falls back to the type label", () => {
  const raw = JSON.stringify({
    correction: "I am happy.",
    evaluate: "The original sentence contains a spelling error.",
    diagnoses: [{ error_type: "Mechanics / Spelling", severity: "Minor", explanation: "   " }],
  });
  const result = parseDiagnosis(raw, errorTypes, opts);
  assert.equal(result.diagnoses[0].explanation, "Mechanics / Spelling");
});
