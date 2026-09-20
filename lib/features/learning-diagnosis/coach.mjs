function formatEvidence(item) {
  return `${item.count} records across ${item.days} days and ${item.sessions || "unknown"} sessions; trend: ${item.trend}; confidence: ${item.confidence}`;
}

export function practiceEvidenceStatus(item) {
  if (!item?.practiceAttempts) return "尚未开始练习";
  if (!item.observedPracticeAttempts) return "尚无复测证据";
  if (item.postPracticeRecurrences > 0) return "练习后仍有复发";
  return "复测后暂未观察到复发";
}

export function selectNextPhaseIndex(item) {
  if (!item?.practiceAttempts) return 0;
  if (!item.observedPracticeAttempts) return 1;
  if (item.postPracticeRecurrences > 0) return 1;
  if (item.practiceAttempts < 3) return 2;
  return 3;
}

function nextPhaseReason(item) {
  if (!item?.practiceAttempts) return "先建立基础识别证据";
  if (!item.observedPracticeAttempts) return "已有练习，但还没有后续复测";
  if (item.postPracticeRecurrences > 0) return "练习后仍复发，先回到对比练习";
  if (item.practiceAttempts < 3) return "继续积累主动产出，再进行延迟复测";
  return "已有足够练习且暂未复发，进入延迟复测";
}

export function selectTodayTasks(diagnosis, { max = 3 } = {}) {
  return (diagnosis?.priorities || []).slice(0, max).map((item) => {
    const phaseIndex = selectNextPhaseIndex(item);
    const phase = item.prescription?.[Math.min(phaseIndex, (item.prescription?.length || 1) - 1)] || item.prescription?.[0];
    return { errorType: item.errorType, phase, evidenceStatus: practiceEvidenceStatus(item), reason: nextPhaseReason(item) };
  }).filter((task) => task.phase);
}

export function renderTodayTasks(tasks) {
  if (!tasks?.length) return "";
  let output = "  Coach tasks for today\n";
  for (const task of tasks) {
    const taskId = task.id ? ` [#${task.id}]` : "";
    output += `  - ${task.errorType}${taskId} · ${task.phase.name}: ${task.phase.task}\n`;
    output += `    Evidence: ${task.evidenceStatus}\n`;
    output += `    Why: ${task.reason}\n`;
    output += `    Check: ${task.phase.check}\n`;
  }
  return output;
}

/** Render only; diagnosis selection stays in learning-diagnosis/index.mjs. */
export function renderCoachPlan(diagnosis) {
  if (diagnosis.source === "llm" || diagnosis.source === "insufficient-evidence") return renderAICoachPlan(diagnosis);
  let output = "\nTwo-week learning plan\n=======================\n";
  if (diagnosis.planId) output += `Plan: #${diagnosis.planId}\n`;
  output += `Goal: ${diagnosis.goal}\nWindow: ${diagnosis.windowDays} days\n`;
  if (diagnosis.sample) {
    output += `Evidence: ${diagnosis.sample.totalInputs} inputs, ${diagnosis.sample.totalDiagnoses} diagnoses, error rate ${diagnosis.sample.errorRate ?? "N/A"}\n`;
  }

  if (!diagnosis.priorities?.length) {
    output += "\nNo stable priority has enough evidence yet. Keep submitting varied sentences and complete practice attempts.\n";
  }

  for (let index = 0; index < (diagnosis.priorities || []).length; index++) {
    const item = diagnosis.priorities[index];
    output += `\n${index + 1}. ${item.errorType}\n`;
    output += `   Evidence: ${formatEvidence(item)}\n`;
    output += `   Practice evidence: ${practiceEvidenceStatus(item)}\n`;
    if (item.realContexts?.length || item.practiceContexts?.length) {
      output += `   Context evidence: real input [${item.realContexts?.join(", ") || "none"}] · generated practice [${item.practiceContexts?.join(", ") || "none"}]\n`;
    }
    const nextPhase = item.prescription?.[Math.min(selectNextPhaseIndex(item), (item.prescription?.length || 1) - 1)];
    if (nextPhase) output += `   Next: ${nextPhase.name} — ${nextPhaseReason(item)}\n`;
    output += `   机制假设（待验证）：${item.mechanism.statement}\n`;
    output += `   依据边界：${item.mechanism.evidence}\n`;
    for (const phase of item.prescription || []) {
      output += `   [${phase.days}] ${phase.name}: ${phase.task}\n`;
      output += `       Check: ${phase.check}\n`;
    }
    output += "   Resources:\n";
    for (const resource of item.resources || []) {
      const link = resource.url ? ` — ${resource.url}` : "";
      const verification = resource.url
        ? ` [${resource.verified ? `verified ${resource.verifiedAt}` : "unverified"}]`
        : "";
      output += `     - ${resource.kind}: ${resource.title}${link} (${resource.estimatedMinutes} min)${verification}\n`;
      if (resource.why) output += `       Why: ${resource.why}\n`;
      if (resource.direction) output += `       Direction: ${resource.direction}\n`;
      output += `       ${resource.action}\n`;
      output += `       Check: ${resource.check}\n`;
    }
  }

  if (diagnosis.limitations?.length) {
    output += "\nLimits\n------\n";
    for (const limitation of diagnosis.limitations) output += `- ${limitation}\n`;
  }
  output += "\nAfter the delayed retest, run /coach again to adjust the next cycle.\n";
  return output;
}

function renderAICoachPlan(diagnosis) {
  let output = "\nEnglish ability analysis & two-week plan\n========================================\n";
  if (diagnosis.planId) output += `Plan: #${diagnosis.planId}\n`;
  if (diagnosis.source === "llm" && diagnosis.provider) output += `Model: ${diagnosis.provider} / ${diagnosis.model}\n`;
  output += `Window: ${diagnosis.windowDays === 0 ? "all history" : `${diagnosis.windowDays} days`}\n`;
  output += `Evidence: ${diagnosis.sample.totalInputs} inputs, ${diagnosis.sample.totalDiagnoses} diagnoses; ${diagnosis.sample.errorRate ?? "N/A"} diagnoses per input\n`;
  output += `\n能力分析\n${diagnosis.summary}\n`;
  for (const [label, items] of [["已有优势", diagnosis.strengths], ["从样本发现的领域性问题", diagnosis.domainFindings]]) {
    if (!items?.length) continue;
    output += `\n${label}\n`;
    for (const item of items) output += `- ${item.finding} [${item.evidenceIds.join(", ")}]\n`;
  }
  for (const [index, item] of diagnosis.priorities.entries()) {
    output += `\n${index + 1}. ${item.ability} (${item.errorType})\n`;
    output += `   分析：${item.analysis} [${item.evidenceIds.join(", ")}]\n`;
    output += `   原因假设（待验证）：${item.hypothesis}\n`;
    output += `   建议：${item.recommendation}\n`;
    for (const phase of item.prescription) {
      output += `   [${phase.days}] ${phase.name}: ${phase.task}\n       Check: ${phase.check}\n`;
    }
    for (const resource of item.resources || []) {
      output += `   参考：${resource.title}${resource.url ? ` — ${resource.url}` : ""}\n       ${resource.action}\n`;
    }
  }
  const cited = new Set([
    ...diagnosis.strengths, ...diagnosis.domainFindings, ...diagnosis.priorities,
  ].flatMap((item) => item.evidenceIds));
  if (cited.size) {
    output += "\n引用样本（历史纠错和评分也可能有误）\n";
    for (const row of diagnosis.evidence.filter((item) => cited.has(item.id))) {
      output += `[${row.id}] ${row.kind} · ${row.timestamp || "unknown date"}\n`;
      if (row.prompt) output += `  题目：${row.prompt}\n`;
      output += `  原始表达：${row.original || row.answer || "未记录"}\n`;
      if (row.correction || row.reference) output += `  历史纠正/参考：${row.correction || row.reference}\n`;
      if (row.score !== undefined) output += `  历史评分：${row.score}\n`;
    }
  }
  if (diagnosis.limitations.length) output += `\n证据边界\n${diagnosis.limitations.map((item) => `- ${item}`).join("\n")}\n`;
  if (diagnosis.planId) output += "\nUse /today for pending tasks. Run /coach again after retesting to generate the next plan.\n";
  return output;
}
