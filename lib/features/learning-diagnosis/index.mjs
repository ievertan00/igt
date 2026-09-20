import { getLearningProfileData } from "../handbook/queries.mjs";
import { buildLearningProfile } from "../handbook/profile.mjs";
import { findLocalLearningResources } from "./local-resources.mjs";
import { assessResourceVerification } from "./resources.mjs";

const RESOURCE_MODES = new Set(["local", "web", "local-and-web"]);

const MECHANISM_HYPOTHESES = [
  [/Vocabulary|Usage/i, "可能已经认识单词含义，但还没有稳定掌握搭配、介词或正式/口语语域。"],
  [/Tense|Aspect/i, "可能把中文时间标记直接映射为英语时态，尚未稳定建立事件时间线。"],
  [/Article|Determiner|Pronoun/i, "可能在名词的特指、泛指和可数性判断上仍依赖直觉。"],
  [/Preposition|Conjunction/i, "可能记住了单词含义，但还没有形成稳定的搭配或连接词选择模式。"],
  [/Agreement/i, "可能在复杂主语中没有先定位真正的主语，再决定动词形式。"],
  [/Word Form/i, "可能能识别词义，但还没有根据句法位置稳定选择词形。"],
  [/Sentence|Parallel|Modifier/i, "可能在表达多个信息时先逐词翻译，导致从句、修饰语或平行结构失去整体规划。"],
];

function mechanismFor(errorType) {
  const match = MECHANISM_HYPOTHESES.find(([pattern]) => pattern.test(errorType));
  return {
    kind: "hypothesis",
    statement: match?.[1] || "当前记录不足以确定具体机制，可能同时涉及规则理解、提取速度或语境迁移。",
    evidence: "由错误类型、重复分布和练习结果推测，不是已验证的心理原因。",
  };
}

function goalLabel(goal) {
  return /work|business|email|meeting|office/i.test(goal) ? "工作" : "日常";
}

function makePrescription(item, goal) {
  const context = goalLabel(goal);
  return [
    {
      phase: 1,
      name: "识别",
      days: "第 1–3 天",
      task: `在${context}语境中标记触发选择的时间、主语或名词信息，不急着翻译整句。`,
      check: "完成 5 个最小对比判断，并能说出选择依据。",
    },
    {
      phase: 2,
      name: "对比",
      days: "第 4–6 天",
      task: `${item.practice} 然后立即口头复述其中 3 句。`,
      check: "同一规则连续答对 4/5 题。",
    },
    {
      phase: 3,
      name: "迁移",
      days: "第 7–10 天",
      task: `在${context}邮件、会议或状态更新中各写 1 句新句子，不复用旧例句。`,
      check: "至少 3 个新语境中目标结构正确。",
    },
    {
      phase: 4,
      name: "延迟复测",
      days: "第 11–14 天",
      task: "隔一天后重新完成混合题，不先查看规则或旧答案。",
      check: "复测得分达到 85 分且新语境没有同类错误；否则回到第 2 阶段。",
    },
  ];
}

function resourcesFor(item, resourceMode, vaultDir, now, resourceChecks = []) {
  const resources = [];
  if (resourceMode === "local" || resourceMode === "local-and-web") {
    resources.push(...findLocalLearningResources({
      vaultDir,
      errorType: item.errorType,
      targetPattern: item.targetPattern,
    }));
    resources.push({
      kind: "local",
      title: "IGT Grammar Reference",
      action: `使用 /ask 查询 “${item.errorType}”，再用自己的句子追问为什么。`,
      why: "先利用项目已有的本地语法参考，保持解释与当前错误记录一致。",
      estimatedMinutes: 15,
      direction: "input",
      check: "能用自己的话解释规则，并写出一个新例句。",
      verified: true,
      verificationSource: "IGT local reference",
    });
  }
  if (resourceMode === "web" || resourceMode === "local-and-web") {
    const runtimeCheck = resourceChecks.find((check) => check.url === item.resource.url) || null;
    const verification = assessResourceVerification(item.resource, { now, runtimeCheck });
    resources.push({
      kind: "web",
      title: item.resource.title,
      url: verification.verified ? item.resource.url : null,
      action: item.resource.why,
      why: "作为第二种解释和额外专项练习，不替代主动产出。",
      estimatedMinutes: 20,
      direction: "input-and-practice",
      check: "完成一个相关练习后，写一句与自己工作或生活有关的新句子。",
      verified: verification.verified,
      verifiedAt: item.resource.verifiedAt || null,
      verificationSource: item.resource.verificationSource || null,
      verificationStatus: verification.status,
      verificationReason: verification.reason,
    });
  }
  return resources;
}

function buildDiagnosisFromProfile(profile, { goal, resourceMode, vaultDir, now, resourceChecks }) {
  const priorities = profile.priorities.map((item) => ({
    ...item,
    mechanism: mechanismFor(item.errorType),
    prescription: makePrescription(item, goal),
    resources: resourcesFor(item, resourceMode, vaultDir, now, resourceChecks),
  }));
  const hasTransferEvidence = priorities.some((item) => item.contextCoverage >= 2);
  const hasRealInputContext = priorities.some((item) => item.realContexts?.length > 0);
  const limitations = [
    ...(hasTransferEvidence ? [] : ["当前记录还没有至少两个真实产出语境的标签，因此暂时不能可靠计算跨工作、对话、叙事场景的迁移覆盖率。"]),
    ...(hasRealInputContext ? [] : ["真实语法输入尚未形成高置信度语境标签；当前迁移证据主要来自系统生成的练习语境。"]),
    "机制解释是学习假设，需要通过后续练习和新语境复测验证。",
  ];
  if (!profile.weaknesses.some((item) => item.practiceAttempts > 0)) {
    limitations.push("目前还没有足够的练习结果，练习后复发率只能显示为空。" );
  }
  return {
    version: 1,
    goal,
    resourceMode,
    windowDays: profile.windowDays,
    generatedAt: new Date().toISOString(),
    sample: {
      totalInputs: profile.totalInputs,
      totalDiagnoses: profile.totalRecords,
      errorRate: profile.errorRate,
    },
    priorities,
    limitations,
  };
}

/**
 * The single public seam for evidence-bound learning diagnosis.
 * Database access is injectable so CLI, tests, and future API routes share it.
 */
export async function buildLearningDiagnosis({
  days = 90,
  goal = "general English",
  resourceMode = "local-and-web",
  vaultDir = null,
  now = Date.now(),
  loadData = getLearningProfileData,
} = {}) {
  const safeDays = Number.isInteger(days) && days >= 0 ? Math.min(days, 3650) : 90;
  const safeGoal = String(goal || "general English").trim().slice(0, 120);
  const safeResourceMode = RESOURCE_MODES.has(resourceMode) ? resourceMode : "local-and-web";
  const data = await loadData(safeDays);
  const profile = buildLearningProfile(data || {}, { now, windowDays: safeDays });
  return buildDiagnosisFromProfile(profile, {
    goal: safeGoal,
    resourceMode: safeResourceMode,
    vaultDir,
    now,
    resourceChecks: data?.resourceChecks || [],
  });
}
