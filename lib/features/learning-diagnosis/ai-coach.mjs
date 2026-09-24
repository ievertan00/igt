import { getCoachEvidenceData } from "../handbook/queries.mjs";
import { buildLearningProfile } from "../handbook/profile.mjs";
import { buildLearningDiagnosis } from "./index.mjs";
import { parseJson } from "../quiz/prompts.mjs";
import { COACH_PROMPT, COACH_SCHEMA } from "./coach-prompt.mjs";
import { beijingISO } from "../../shared/timezone.mjs";

const PHASES = [
  { phase: 1, name: "识别", days: "第 1–3 天" },
  { phase: 2, name: "对比", days: "第 4–6 天" },
  { phase: 3, name: "迁移", days: "第 7–10 天" },
  { phase: 4, name: "延迟复测", days: "第 11–14 天" },
];
const clip = (value) => String(value || "").slice(0, 600);

// Include recent and older examples rather than only the most recent repetitions.
function sample(rows, max = 3) {
  if (rows.length <= max) return rows;
  return Array.from({ length: max }, (_, index) => rows[Math.round(index * (rows.length - 1) / (max - 1))]);
}

export function buildCoachEvidence(data, days) {
  const diagnoses = data.diagnoses || [];
  const attempts = data.attempts || [];
  const types = [...new Set([...diagnoses.map((row) => row.error_type), ...attempts.map((row) => row.target_error_type)].filter(Boolean))].sort();
  const evidence = [];
  let characters = 0;
  const add = (record) => {
    const size = JSON.stringify(record).length;
    if (characters + size > 45000) return;
    evidence.push({ id: `E${evidence.length + 1}`, ...record });
    characters += size;
  };
  const groups = types.map((errorType) => {
    const errors = diagnoses.filter((row) => row.error_type === errorType);
    const practices = attempts.filter((row) => row.target_error_type === errorType);
    return {
      errorType,
      diagnoses: errors.length,
      daysWithErrors: new Set(errors.map((row) => String(row.timestamp).slice(0, 10))).size,
      majorErrors: errors.filter((row) => row.severity === "Major").length,
      practiceAttempts: practices.length,
      practiceBelow75: practices.filter((row) => Number(row.score) < 75).length,
      samples: [
        ...sample(errors).map((row) => ({
          kind: "independent-input", errorType, timestamp: row.timestamp,
          original: clip(row.original_text), correction: clip(row.correction),
          previousExplanation: clip(row.explanation), severity: row.severity,
        })),
        ...sample(practices).map((row) => ({
          kind: "generated-practice", errorType, timestamp: row.created_at,
          target: clip(row.target_pattern), prompt: clip(row.prompt),
          answer: clip(row.learner_answer), reference: clip(row.reference_answer), score: row.score,
        })),
      ],
    };
  });
  // Round-robin prevents one large category from consuming the evidence budget.
  for (let index = 0; index < 6; index++) {
    for (const group of groups) if (group.samples[index]) add(group.samples[index]);
  }
  for (const row of sample(data.undiagnosedInputs || [], 5)) {
    add({ kind: "input-without-recorded-errors", timestamp: row.timestamp, original: clip(row.original_text) });
  }
  for (const row of sample(attempts.filter((item) => !item.target_error_type), 3)) {
    add({ kind: "generated-practice", timestamp: row.created_at, prompt: clip(row.prompt), answer: clip(row.learner_answer), score: row.score });
  }
  return {
    windowDays: days,
    totalInputs: data.totalInputs || 0,
    totalDiagnoses: diagnoses.length,
    totalPracticeAttempts: attempts.length,
    groups: groups.map(({ samples, ...metrics }) => metrics),
    evidence,
    sampling: "Up to 3 spaced diagnoses and 3 spaced attempts per type, 5 inputs without recorded errors, and 3 unlabelled attempts; excerpts limited to 600 characters, evidence budget 45000 characters. No error recorded does not establish correctness. No preset context tags supplied.",
  };
}

function requiredText(value, field, max = 2000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid coach field: ${field}`);
  return value.trim();
}

function list(value, field, max) {
  if (!Array.isArray(value) || value.length > max) throw new Error(`Invalid coach list: ${field}`);
  return value;
}

export function parseCoachAnalysis(raw, packet) {
  const result = parseJson(raw);
  const evidence = new Map(packet.evidence.map((item) => [item.id, item]));
  const refs = (value) => {
    const ids = list(value, "evidenceIds", 12);
    if (!ids.length || ids.some((id) => !evidence.has(id))) throw new Error("Coach analysis cites missing evidence");
    return [...new Set(ids)];
  };
  const findings = (value, field) => list(value, field, 5).map((item) => ({
    finding: requiredText(item?.finding, field), evidenceIds: refs(item?.evidenceIds),
  }));
  const used = new Set();
  const priorities = list(result.priorities, "priorities", 3).map((item) => {
    const errorType = requiredText(item?.errorType, "errorType", 200);
    const ids = refs(item.evidenceIds);
    if (used.has(errorType) || !ids.some((id) => evidence.get(id).errorType === errorType)) {
      throw new Error("Coach priority must cite its exact recorded error type without duplicates");
    }
    used.add(errorType);
    const phases = list(item.phases, "phases", 4);
    if (phases.length !== 4 || PHASES.some(({ phase }) => phases.filter((entry) => entry?.phase === phase).length !== 1)) {
      throw new Error("Coach plan must contain phases 1 through 4 exactly once");
    }
    return {
      errorType,
      ability: requiredText(item.ability, "ability", 200),
      analysis: requiredText(item.analysis, "analysis"),
      evidenceIds: ids,
      hypothesis: requiredText(item.hypothesis, "hypothesis"),
      recommendation: requiredText(item.recommendation, "recommendation"),
      prescription: PHASES.map((phase) => {
        const generated = phases.find((entry) => entry.phase === phase.phase);
        return { ...phase, task: requiredText(generated.task, "task"), check: requiredText(generated.check, "check", 1000) };
      }),
    };
  });
  return {
    summary: requiredText(result.summary, "summary", 4000),
    strengths: findings(result.strengths, "strengths"),
    domainFindings: findings(result.domainFindings, "domainFindings"),
    priorities,
    limitations: list(result.limitations, "limitations", 10).map((item) => requiredText(item, "limitation", 1000)),
  };
}

export async function buildAICoachDiagnosis({ llm, days = 90, resourceMode = "local-and-web", vaultDir = null, loadData = getCoachEvidenceData, now = Date.now() } = {}) {
  const safeDays = Number.isInteger(days) && days >= 0 && days <= 3650 ? days : 90;
  const data = await loadData(safeDays);
  const packet = buildCoachEvidence(data, safeDays);
  const base = {
    version: 2, source: "llm", goal: "General English ability", windowDays: safeDays,
    generatedAt: beijingISO(new Date(now)),
    sample: { totalInputs: packet.totalInputs, totalDiagnoses: packet.totalDiagnoses,
      errorRate: packet.totalInputs ? Math.round(packet.totalDiagnoses / packet.totalInputs * 1000) / 1000 : null },
    evidence: packet.evidence,
  };
  if (!packet.evidence.length) {
    return { ...base, source: "insufficient-evidence", summary: "暂无可分析的英语使用记录。请先提交自己的英文表达或完成练习，再运行 /coach。", strengths: [], domainFindings: [], priorities: [], limitations: ["没有学习样本，尚未调用大模型或创建计划。"] };
  }
  if (!llm?.generateWithFallback) throw new Error("Coach requires a configured LLM provider");
  // JSON-only providers do not receive a native schema, so include it in the prompt too.
  const prompt = `${COACH_PROMPT}\nOutput JSON schema:\n${JSON.stringify(COACH_SCHEMA)}`;
  const raw = await llm.generateWithFallback(JSON.stringify(packet), prompt, { taskType: "coach", jsonSchema: COACH_SCHEMA });
  const analysis = parseCoachAnalysis(raw, packet);
  const profile = buildLearningProfile(data, { now, windowDays: safeDays });
  // Reuse verified resources only; the model selects priorities and writes all advice/tasks.
  const resources = await buildLearningDiagnosis({ days: safeDays, resourceMode, vaultDir, now, loadData: async () => data });
  return {
    ...base, ...analysis,
    priorities: analysis.priorities.map((item) => ({
      ...profile.weaknesses.find((entry) => entry.errorType === item.errorType),
      ...item,
      mechanism: { kind: "hypothesis", statement: item.hypothesis, evidence: "模型根据所引样本提出的待验证假设，不是已证实原因。" },
      resources: resources.priorities.find((entry) => entry.errorType === item.errorType)?.resources || [],
    })),
    limitations: [...analysis.limitations, "模型分析基于抽样文本；引用存在不代表推断必然正确，听说能力与整体等级未评估。"],
  };
}

export async function generateAndSaveCoachPlan(options, savePlan) {
  const diagnosis = await buildAICoachDiagnosis(options);
  if (!diagnosis.priorities.length) return diagnosis;
  const plan = await savePlan(diagnosis);
  return { ...diagnosis, planId: plan.id };
}
