import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readLearningPracticeAttempts, readHandbookPracticeEvidence } from "../lib/features/practice/attempts.mjs";
import { getLearningProfileData } from "../lib/features/handbook/queries.mjs";
import { buildLearningProfile } from "../lib/features/handbook/profile.mjs";
import { buildLearningDiagnosis } from "../lib/features/learning-diagnosis/index.mjs";
import { buildReport } from "../lib/features/handbook/report.mjs";
import { buildCoachEvidence } from "../lib/features/learning-diagnosis/ai-coach.mjs";
import { getCoachPatterns } from "../lib/application/coach.mjs";

const type = "Grammar / Article Usage";
const now = Date.parse("2026-10-22T12:00:00Z");
const reviews = { entries: [], totalInputs: 3, diagnoses: [20, 19, 18].map((day) => ({
  error_type: type, severity: "Minor", timestamp: `2026-10-${day}T10:00:00Z`,
})) };
const attempt = (score, hints = 0) => ({
  id: 1, target_error_type: type, score, created_at: "2026-10-21 10:00:00", context_label: "shopping",
  feedback: JSON.stringify({ source: "handbook", target_assessment: "not-assessed", hints_used: hints }),
});

test("profile reads the complete practice window with the same linked counts as Web", async () => {
  const db = new Database(":memory:");
  try {
    db.exec(`CREATE TABLE practice_attempts (id INTEGER PRIMARY KEY, activity_type TEXT,
      target_error_type TEXT, target_pattern TEXT, context_label TEXT,
      prompt TEXT, learner_answer TEXT, reference_answer TEXT, score INTEGER, feedback TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
    const insert = db.prepare("INSERT INTO practice_attempts (activity_type, target_error_type, score, feedback) VALUES ('practice-sentence', ?, ?, ?)");
    db.transaction(() => {
      for (let i = 0; i < 510; i++) insert.run(type, 95, attempt(95, i % 2).feedback);
    })();
    db.prepare("INSERT INTO practice_attempts (target_error_type, created_at) VALUES (?, '2000-01-01 00:00:00')").run(type);
    const data = await getLearningProfileData(30, {
      loadReviews: (days) => { assert.equal(days, 30); return reviews; },
      loadAttempts: (options) => readLearningPracticeAttempts(db, options),
    });
    const item = buildLearningProfile(data, { now, windowDays: 30 }).weaknesses[0];
    const web = readHandbookPracticeEvidence(db, { days: 30, errorType: type });
    assert.equal(data.practiceEvidenceStatus, "available");
    assert.equal(item.practiceAttempts, 510);
    assert.equal(item.handbookPracticeAttempts, web.attempts);
    assert.equal(item.handbookWithoutHints, web.withoutHints);
    assert.equal(readLearningPracticeAttempts(db, { days: 0 }).length, 511);
  } finally { db.close(); }
});

test("linked overall scores do not create target weaknesses or transfer/retest claims", () => {
  const attempts = [attempt(100), { ...attempt(40, 2), id: 2, context_label: "work", created_at: "2026-10-22 10:00:00" }];
  const item = buildLearningProfile({ ...reviews, attempts }, { now, windowDays: 30 }).weaknesses[0];
  assert.equal(item.practiceAttempts, 2);
  assert.equal(item.lowScoreRate, null);
  assert.equal(item.contextCoverage, 0);
  assert.equal(item.transferStatus, "insufficient");
  assert.equal(item.observedPracticeAttempts, 0);
  assert.equal(item.practiceRecurrenceRate, null);
  assert.deepEqual(buildLearningProfile({ diagnoses: [], attempts }, { now }).priorities, []);
  const packet = buildCoachEvidence({ ...reviews, attempts }, 30);
  const samples = packet.evidence.filter((row) => row.kind === "generated-practice");
  assert.equal(samples.length, 2);
  assert.equal(samples[1].hintsUsed, 2);
  assert.equal(samples[0].targetAssessment, "not-assessed");
  assert.equal(packet.groups[0].practiceBelow75, 0);
});

const render = (learningProfile) => buildReport({ provider: "mock", handbookModel: "mock", date: "2026-10-22", days: 30,
  stats: { total_inputs: 3, total_diagnoses: 3 }, errorFrequency: [], trendData: [],
  examplesByType: new Map(), rules: new Map(), learningProfile });

test("report shows linked practice without converting missing follow-up to zero recurrence", async () => {
  const diagnosis = await buildLearningDiagnosis({ days: 30, now, resourceMode: "local",
    loadData: async () => ({ ...reviews, attempts: [attempt(95)], practiceEvidenceStatus: "available" }) });
  const markdown = render(diagnosis);
  assert.match(markdown, /1 linked from Handbook \(1 without hints; overall scores only\)/);
  assert.match(markdown, /follow-up not established/);
  assert.doesNotMatch(markdown, /0 recurrence|not tested yet|尚无复习反馈/);
  assert.match(markdown, /已有练习记录/);
});

test("unavailable practice storage preserves corrections and reports the evidence gap", async () => {
  const data = await getLearningProfileData(30, { loadReviews: () => reviews,
    loadAttempts: () => { throw new Error("storage unavailable"); } });
  assert.equal(data.totalInputs, 3);
  assert.equal(data.practiceEvidenceStatus, "unavailable");
  const diagnosis = await buildLearningDiagnosis({ days: 30, now, resourceMode: "local", loadData: async () => data });
  assert.match(render(diagnosis), /练习记录暂时无法读取/);
  assert.match(render(diagnosis), /practice records unavailable/);
  assert.doesNotMatch(render(diagnosis), /not tested yet/);
});

test("Coach patterns remain independent of Practice evidence", () => {
  let attempts = [];
  const entries = [1, 2].map(id => ({ source: "grammar", entryId: String(id), timestamp: "2026-10-21T10:00:00Z", userInput: "I read book.", diagnoses: [{ error_type: type }] }));
  const dependencies = { loadData: () => ({ entries, attempts }), now };
  const before = getCoachPatterns({ days: 30 }, dependencies);
  attempts = [attempt(95)];
  assert.deepEqual(getCoachPatterns({ days: 30 }, dependencies), before);
});
