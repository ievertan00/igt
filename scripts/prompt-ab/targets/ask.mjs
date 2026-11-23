import fs from "node:fs";
import path from "node:path";
import { askStateless } from "../../../lib/application/ask.mjs";
import { CASES_DIR } from "../lib/variants.mjs";
import { checkAsk } from "../checks/ask.mjs";

export const taskType = "ask";

export function loadCases({ filter } = {}) {
  const cases = JSON.parse(fs.readFileSync(path.join(CASES_DIR, "ask-cases.json"), "utf8"));
  return filter ? cases.filter(item => filter.includes(item.id)) : cases;
}

export async function run({ variant, case: testCase, manager, config }) {
  const started = Date.now();
  try {
    // askStateless is the production Web path (explicit messages history); the
    // variant only replaces Prompts.AskPrompt, metadata/language/formatting
    // fragments stay exactly as production appends them.
    const { response } = await askStateless({
      messages: testCase.history || [],
      question: testCase.question,
      llm: manager,
      config: { ...config, Prompts: { ...config.Prompts, AskPrompt: variant.parts.ask } },
      language: testCase.language,
    });
    const output = response.data;
    return {
      ok: true,
      ms: Date.now() - started,
      output,
      checks: checkAsk({ question: testCase.question, language: testCase.language, output, expectations: testCase.expect || {} }),
    };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, error: String(error.message || error), checks: [{ id: "call_succeeded", level: "hard", pass: false, detail: String(error.message || error) }] };
  }
}

export function judgeInput(testCase) {
  const history = (testCase.history || []).map((turn, index) => `Q${index + 1}: ${turn.question}\nA${index + 1}: ${turn.answer}`).join("\n\n");
  return {
    instruction: `English-learning consultation. Requested response language: ${testCase.language || "default (follow the question)"}.`,
    input: history ? `Prior turns:\n${history}\n\nCurrent question: ${testCase.question}` : testCase.question,
  };
}

export function judgeOutput(result) {
  if (!result.ok) return `[GENERATION FAILED: ${result.error}]`;
  const { title, answer, related, tags, category } = result.output;
  return JSON.stringify({ title, answer, related, tags, category }, null, 2);
}