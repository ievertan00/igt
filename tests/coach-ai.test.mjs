import test from "node:test";
import assert from "node:assert/strict";
import { buildCoachEvidence, buildAICoachDiagnosis, parseCoachAnalysis } from "../lib/features/learning-diagnosis/ai-coach.mjs";

const data = {
  totalInputs: 4,
  diagnoses: [
    { error_type: "Grammar / Verb Tense", severity: "Major", timestamp: "2026-09-17 10:00:00", original_text: "I have finished it yesterday.", correction: "I finished it yesterday." },
    { error_type: "Grammar / Verb Tense", severity: "Moderate", timestamp: "2026-09-15 10:00:00", original_text: "I have sent it last week.", correction: "I sent it last week." },
  ],
  attempts: [{ target_error_type: "Grammar / Verb Tense", target_pattern: "past vs present perfect", created_at: "2026-09-16 10:00:00", prompt: "上周完成报告", learner_answer: "I have finished it last week.", reference_answer: "I finished it last week.", score: 60 }],
  undiagnosedInputs: [{ timestamp: "2026-09-14 10:00:00", original_text: "The report is ready." }],
};

test("coach evidence keeps independent input separate from generated practice", () => {
  const packet = buildCoachEvidence(data, 90);
  assert.equal(packet.totalInputs, 4);
  assert.ok(packet.evidence.some((item) => item.kind === "independent-input"));
  assert.ok(packet.evidence.some((item) => item.kind === "generated-practice"));
  assert.ok(packet.evidence.some((item) => item.kind === "input-without-recorded-errors"));
  assert.match(packet.sampling, /No error recorded/);
});

test("coach parser rejects fabricated evidence and requires four phases", () => {
  const packet = buildCoachEvidence(data, 90);
  const base = { summary: "分析", strengths: [], domainFindings: [], limitations: [] };
  assert.throws(() => parseCoachAnalysis(JSON.stringify({ ...base, priorities: [{
    errorType: "Grammar / Verb Tense", ability: "时态控制", analysis: "分析", evidenceIds: ["E999"], hypothesis: "假设", recommendation: "建议", phases: [],
  }] }), packet), /missing evidence|phases/i);
});

test("coach uses model output and does not create a plan when model returns no priorities", async () => {
  const calls = [];
  const diagnosis = await buildAICoachDiagnosis({
    days: 90,
    now: Date.parse("2026-09-18T00:00:00Z"),
    loadData: async () => data,
    llm: { generateWithFallback: async (input, prompt, options) => {
      calls.push({ input, prompt, options });
      return JSON.stringify({ summary: "证据不足", strengths: [], domainFindings: [], priorities: [], limitations: ["样本少"] });
    } },
  });
  assert.equal(diagnosis.source, "llm");
  assert.equal(diagnosis.priorities.length, 0);
  assert.equal(calls[0].options.taskType, "coach");
  assert.match(calls[0].prompt, /general ability/i);
});

test("coach preserves exact error types and model-authored phases", async () => {
  const packet = buildCoachEvidence(data, 90);
  const first = packet.evidence.find((item) => item.errorType === "Grammar / Verb Tense");
  const diagnosis = await buildAICoachDiagnosis({
    days: 90,
    now: Date.parse("2026-09-18T00:00:00Z"),
    loadData: async () => data,
    resourceMode: "local",
    llm: { generateWithFallback: async () => JSON.stringify({
      summary: "过去时与完成时的选择在已有句子中反复混淆。",
      strengths: [],
      domainFindings: [],
      priorities: [{
        errorType: "Grammar / Verb Tense",
        ability: "事件时间与时态选择",
        analysis: "带有明确过去时间标记时，样本仍多次使用现在完成时。",
        evidenceIds: [first.id],
        hypothesis: "可能先按中文完成体直译，再补时间副词。",
        recommendation: "先标记事件是否结束及时间锚点，再做最小对比和延迟复述。",
        phases: [1, 2, 3, 4].map((phase) => ({ phase, task: `模型任务 ${phase}`, check: `模型检查 ${phase}` })),
      }],
      limitations: [],
    }) },
  });
  assert.equal(diagnosis.priorities[0].errorType, "Grammar / Verb Tense");
  assert.equal(diagnosis.priorities[0].prescription[0].task, "模型任务 1");
  assert.equal(diagnosis.priorities[0].resources.every((item) => item.kind !== "web"), true);
});
