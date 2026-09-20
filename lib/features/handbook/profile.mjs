const SEVERITY_WEIGHT = { Major: 3, Moderate: 2, Minor: 1 };

export const RESOURCE_CATALOG = [
  {
    match: /Vocabulary|Usage/i,
    title: "British Council Vocabulary",
    url: "https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2",
    why: "按主题学习词义、搭配和真实语境用法，适合从识词转向主动产出。",
    verified: false,
    verifiedAt: "2026-09-18",
    verificationSource: "British Council LearnEnglish; runtime verification pending",
  },
  {
    match: /Article|Pronoun|Preposition|Conjunction|Determiner/i,
    title: "British Council Grammar",
    url: "https://learnenglish.britishcouncil.org/free-resources/grammar",
    why: "按语法主题和级别练习，适合先建立规则与基础准确度。",
    verified: false,
    verifiedAt: "2026-09-18",
    verificationSource: "British Council LearnEnglish; runtime verification pending",
  },
  {
    match: /Tense|Agreement|Sentence|Parallel|Modifier|Comparison|Negation|Word Form/i,
    title: "Cambridge Grammar",
    url: "https://dictionary.cambridge.org/us/grammar/british-grammar/",
    why: "用真实语境例句对比结构和用法，适合处理反复出现的细微差别。",
    verified: false,
    verifiedAt: "2026-09-18",
    verificationSource: "Cambridge Dictionary; runtime verification pending",
  },
  {
    match: /Article|Tense|Agreement|Preposition|Word Form|Sentence/i,
    title: "Purdue OWL Grammar Exercises",
    url: "https://owl.purdue.edu/owl_exercises/grammar_exercises/index.html",
    why: "提供文章、介词、时态一致等专项练习，适合做短时集中训练。",
    verified: true,
    verifiedAt: "2026-09-18",
    verificationSource: "Purdue OWL",
  },
];

const PRACTICE_BY_TYPE = [
  [/Article|Pronoun|Preposition|Conjunction|Determiner/i, "做最小对比练习：每次只改变一个冠词、介词或连接词，并马上造一个工作/生活句子。"],
  [/Tense|Agreement|Comparison|Negation/i, "先画出事件时间线或主语，再做 5 组“中文情境 → 英文句子 → 延迟复述”，不要只看改正后的答案。"],
  [/Sentence|Parallel|Modifier|Word Form/i, "把一个旧错误改写成 3 个新语境：邮件、会议、日常对话；第二天不看答案重新表达。"],
];

function daysBetween(now, timestamp) {
  const time = Date.parse(String(timestamp || "").replace(" ", "T") + (String(timestamp).includes("Z") ? "" : "Z"));
  return Number.isFinite(time) ? Math.max(0, (now - time) / 86400000) : Infinity;
}

function timestampMs(timestamp) {
  const value = String(timestamp || "");
  const time = Date.parse(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  return Number.isFinite(time) ? time : null;
}

function resourceFor(errorType) {
  const matches = RESOURCE_CATALOG.filter((item) => item.match.test(errorType));
  return matches.find((item) => item.verified === true) || matches[0] || RESOURCE_CATALOG[0];
}

function practiceFor(errorType) {
  return PRACTICE_BY_TYPE.find(([match]) => match.test(errorType))?.[1]
    || "每周选择 3 个真实语境，先独立写句子，再对照纠正并隔天复述。";
}

/**
 * Turn raw diagnosis history into an evidence-bound learning profile.
 * No LLM is used here: callers can render or explain this result safely.
 */
export function buildLearningProfile(source, { now = Date.now(), windowDays = 30 } = {}) {
  // Keep the old array input working for handbook callers while the diagnosis
  // seam grows to accept denominator and practice evidence.
  const legacy = Array.isArray(source);
  const diagnoses = legacy ? source : (source?.diagnoses || []);
  const attempts = legacy ? [] : (source?.attempts || []);
  const totalInputs = Math.max(
    0,
    Number(legacy ? new Set(diagnoses.map((row) => row.input_id).filter(Boolean)).size : source?.totalInputs) || 0,
  );
  const groups = new Map();
  for (const row of diagnoses) {
    const type = String(row.error_type || "Unknown").trim();
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(row);
  }
  for (const type of new Set(attempts.map((attempt) => String(attempt.target_error_type || "").trim()).filter(Boolean))) {
    if (groups.has(type)) continue;
    const matchingAttempts = attempts.filter((attempt) => String(attempt.target_error_type || "").trim() === type);
    if (matchingAttempts.some((attempt) => Number(attempt.score) < 75)) groups.set(type, []);
  }

  const weaknesses = [...groups.entries()].map(([errorType, items]) => {
    const matchingAttempts = attempts.filter((attempt) => String(attempt.target_error_type || "").trim() === errorType);
    const targetPatterns = [...new Set(matchingAttempts.map((attempt) => String(attempt.target_pattern || "").trim()).filter(Boolean))];
    const evidenceRows = items.length ? items : matchingAttempts;
    const timestampOf = (item) => item.timestamp || item.created_at;
    const recent = evidenceRows.filter((item) => daysBetween(now, timestampOf(item)) <= Math.min(14, windowDays)).length;
    const previous = evidenceRows.filter((item) => {
      const age = daysBetween(now, timestampOf(item));
      return age > 14 && age <= windowDays;
    }).length;
    const days = new Set(evidenceRows.map((item) => String(timestampOf(item) || "").slice(0, 10)).filter(Boolean)).size;
    const sessions = new Set(items.map((item) => item.session_id).filter((value) => value !== null && value !== undefined)).size;
    const severityScore = items.length
      ? items.reduce((sum, item) => sum + (SEVERITY_WEIGHT[item.severity] || 1), 0)
      : matchingAttempts.reduce((sum, attempt) => sum + (Number(attempt.score) < 75 ? 2 : 1), 0);
    const reviewed = items.reduce((sum, item) => sum + Number(item.total_reviews || 0), 0);
    const reviewStreak = items.reduce((sum, item) => sum + Number(item.correct_streak || 0), 0);
    const persistence = Math.min(1, days / Math.max(3, Math.ceil(windowDays / 10)));
    const recency = recent > 0 ? 1 : 0;
    const lowScoreAttempts = matchingAttempts.filter((attempt) => Number(attempt.score) < 75).length;
    const timedAttempts = matchingAttempts
      .map((attempt) => ({ attempt, time: timestampMs(attempt.created_at) }))
      .filter((item) => item.time !== null)
      .sort((a, b) => a.time - b.time);
    let postPracticeRecurrences = 0;
    let observedPracticeAttempts = 0;
    for (let index = 0; index < timedAttempts.length; index++) {
      const current = timedAttempts[index];
      const nextTime = timedAttempts[index + 1]?.time ?? now;
      const recurrences = items.filter((item) => {
        const errorTime = timestampMs(item.timestamp);
        return errorTime !== null && errorTime > current.time && errorTime < nextTime;
      }).length;
      const hasFollowUpPractice = Boolean(timedAttempts[index + 1]);
      if (!hasFollowUpPractice && recurrences === 0) continue;
      postPracticeRecurrences += recurrences;
      observedPracticeAttempts += 1;
    }
    const practiceRecurrenceRate = observedPracticeAttempts > 0
      ? Math.round((postPracticeRecurrences / observedPracticeAttempts) * 100) / 100
      : null;
    const contextScores = new Map();
    for (const attempt of matchingAttempts) {
      const context = String(attempt.context_label || "").trim();
      if (!context || /^(drill|review):/i.test(context)) continue;
      if (!contextScores.has(context)) contextScores.set(context, []);
      contextScores.get(context).push(Number(attempt.score));
    }
    const contexts = [...contextScores.keys()].sort();
    const contextAverages = Object.fromEntries(contexts.map((context) => [
      context,
      Math.round((contextScores.get(context).reduce((sum, score) => sum + score, 0) / contextScores.get(context).length) * 10) / 10,
    ]));
    const contextValues = Object.values(contextAverages);
    const realContexts = [...new Set(items
      .filter((item) => item.context_label && item.context_confidence === "high")
      .map((item) => String(item.context_label).trim()))].sort();
    const contextAverage = contextValues.length
      ? Math.round((contextValues.reduce((sum, score) => sum + score, 0) / contextValues.length) * 10) / 10
      : null;
    const transferStatus = contexts.length < 2
      ? "insufficient"
      : contextAverage >= 85 ? "strong" : contextAverage >= 75 ? "mixed" : "weak";
    const errorRate = items.length && totalInputs > 0 ? Math.round((items.length / totalInputs) * 1000) / 1000 : null;
    const evidenceCount = evidenceRows.length;
    const score = Math.round((severityScore + evidenceCount * 1.5 + persistence * 3 + recency * 2
      + (practiceRecurrenceRate || 0) * 2) * 10) / 10;
    const trend = recent > previous ? "rising" : recent < previous ? "improving" : "stable";
    const confidence = items.length
      ? items.length >= 5 && days >= 3 ? "high" : items.length >= 3 || days >= 2 ? "medium" : "low"
      : matchingAttempts.length >= 3 && days >= 3 ? "high" : matchingAttempts.length >= 2 && days >= 2 ? "medium" : "low";
    return {
      errorType, count: evidenceCount, errorRate, days, sessions, recent, previous, trend, score, confidence,
      targetPatterns,
      targetPattern: targetPatterns.length === 1 ? targetPatterns[0] : null,
      major: items.filter((item) => item.severity === "Major").length,
      reviewed, reviewStreak,
      practiceAttempts: matchingAttempts.length,
      lowScoreAttempts,
      lowScoreRate: matchingAttempts.length > 0 ? Math.round((lowScoreAttempts / matchingAttempts.length) * 100) / 100 : null,
      postPracticeRecurrences,
      observedPracticeAttempts,
      practiceRecurrenceRate,
      contextCoverage: contexts.length,
      contexts,
      practiceContexts: contexts,
      realContexts,
      contextSources: { practice: contexts.length, realInput: realContexts.length },
      contextAverages,
      contextAverage,
      transferStatus,
      transferEvidence: contexts.length >= 2 ? "supported" : "insufficient",
      evidence: items.slice(0, 3).map((item) => ({ original_text: item.original_text, correction: item.correction })),
      practice: practiceFor(errorType),
      resource: resourceFor(errorType),
    };
  }).sort((a, b) => b.score - a.score || b.count - a.count);

  return {
    windowDays,
    totalInputs,
    errorRate: totalInputs > 0 ? Math.round((diagnoses.length / totalInputs) * 1000) / 1000 : null,
    totalRecords: diagnoses.length,
    weaknesses,
    priorities: weaknesses.filter((item) => item.confidence !== "low").slice(0, 3),
  };
}
