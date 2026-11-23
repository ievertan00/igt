import fs from "node:fs";
import path from "node:path";
import { analyzeGrammar } from "../../../lib/application/grammar.mjs";
import { parseDiagnosis } from "../../../lib/domain/parse-diagnosis.mjs";
import * as errorTypes from "../../../lib/domain/error-types.mjs";
import { CASES_DIR } from "../lib/variants.mjs";
import { checkGrammar } from "../checks/grammar.mjs";

export const taskType = "grammar";

export function loadCases({ filter } = {}) {
  const cases = JSON.parse(fs.readFileSync(path.join(CASES_DIR, "grammar-cases.json"), "utf8"));
  return filter ? cases.filter(item => filter.includes(item.id)) : cases;
}

export async function run({ variant, case: testCase, manager }) {
  const started = Date.now();
  try {
    const { response } = await analyzeGrammar({
      text: testCase.input,
      getLLMManager: async () => manager,
      systemPrompt: variant.parts.system,
      inputScope: variant.parts.inputScope,
      parseDiagnosis: output => parseDiagnosis(output, errorTypes),
    });
    const output = response.result;
    return {
      ok: true,
      ms: Date.now() - started,
      output,
      checks: checkGrammar({ input: testCase.input, output, expectations: testCase.expect || {} }),
    };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, error: String(error.message || error), checks: [{ id: "call_succeeded", level: "hard", pass: false, detail: String(error.message || error) }] };
  }
}

export function judgeInput(testCase) {
  return { instruction: "Grammar check of the learner passage below.", input: testCase.input };
}

export function judgeOutput(result) {
  if (!result.ok) return `[GENERATION FAILED: ${result.error}]`;
  const { correction, refine, evaluate, diagnoses, remember } = result.output;
  return JSON.stringify({ correction, refine, evaluate, diagnoses, remember }, null, 2);
}