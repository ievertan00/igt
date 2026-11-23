import fs from "node:fs";
import path from "node:path";
import { generateCoachReport } from "../../../lib/application/coach-report.mjs";
import { CASES_DIR } from "../lib/variants.mjs";
import { checkCoach } from "../checks/coach.mjs";

export const taskType = "handbook";

export function loadCases({ filter } = {}) {
  const dir = path.join(CASES_DIR, "coach");
  if (!fs.existsSync(dir)) return [];
  const cases = fs.readdirSync(dir).filter(name => name.endsWith(".json")).sort().map(name => {
    const fixture = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    return {
      id: fixture.id || path.basename(name, ".json"),
      label: fixture.label || fixture.id || name,
      language: fixture.language || "zh-CN",
      days: fixture.days ?? 0,
      entries: fixture.entries,
      sourceStatus: fixture.sourceStatus || { grammar: "available", practice: "available" },
      expect: fixture.expect || {},
    };
  });
  return filter ? cases.filter(item => filter.includes(item.id)) : cases;
}

export async function run({ variant, case: testCase, manager }) {
  const started = Date.now();
  try {
    const report = await generateCoachReport(
      { days: testCase.days, language: testCase.language, refresh: true },
      {
        getLLMManager: async () => manager,
        loadData: () => ({ entries: testCase.entries, sourceStatus: testCase.sourceStatus }),
        systemPromptOverride: variant.parts.system,
      },
    );
    return {
      ok: true,
      ms: Date.now() - started,
      output: { markdown: report.markdown, evidenceIds: report.evidenceIds, totalChecks: report.totalChecks, sampled: report.sampled, truncated: report.truncated },
      checks: checkCoach({ markdown: report.markdown, language: testCase.language, evidence: report.evidence, expectations: testCase.expect || {} }),
    };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, error: String(error.message || error), errorCode: error.code || null, checks: [{ id: "call_succeeded", level: "hard", pass: false, detail: `${error.code || ""} ${error.message || error}`.trim() }] };
  }
}

export function judgeInput(testCase) {
  const sample = testCase.entries.slice(0, 12).map((entry, index) => ({
    label: `S${index + 1}`,
    source: entry.source || "grammar",
    original: entry.userInput,
    correction: entry.correction || undefined,
    diagnoses: (entry.diagnoses || []).map(item => item.error_type),
    practice: entry.practice ? { prompt: entry.practice.prompt, hintsUsed: entry.practice.hintsUsed } : undefined,
  }));
  return {
    instruction: `Personalized English proficiency diagnostic report. Requested report language: ${testCase.language}. The model received ${testCase.entries.length} saved learning records (grammar checks and practice answers); a truncated sample is shown below as context. Judge the report against this evidence.`,
    input: JSON.stringify(sample, null, 2),
  };
}

export function judgeOutput(result) {
  if (!result.ok) return `[GENERATION FAILED: ${result.error}]`;
  return result.output.markdown;
}