import test from "node:test";
import assert from "node:assert/strict";
import { buildLearningProfile } from "../lib/features/handbook/profile.mjs";

const now = Date.parse("2026-09-18T00:00:00Z");
const row = (type, date, extra = {}) => ({ error_type: type, severity: "Moderate", timestamp: `${date} 10:00:00`, ...extra });

test("ranks repeated recent weaknesses and exposes evidence-bound actions", () => {
  const profile = buildLearningProfile([
    row("Grammar / Article Usage", "2026-09-17"),
    row("Grammar / Article Usage", "2026-09-15", { total_reviews: 2, correct_streak: 1 }),
    row("Grammar / Article Usage", "2026-09-01"),
    row("Grammar / Verb Tense", "2026-08-20", { severity: "Major" }),
  ], { now, windowDays: 30 });

  assert.equal(profile.priorities[0].errorType, "Grammar / Article Usage");
  assert.equal(profile.priorities[0].trend, "rising");
  assert.equal(profile.priorities[0].confidence, "medium");
  assert.match(profile.priorities[0].practice, /对比|练习/);
  assert.match(profile.priorities[0].resource.url, /^https:\/\//);
});

test("does not call a single isolated record a stable weakness", () => {
  const profile = buildLearningProfile([row("Grammar / Preposition Usage", "2026-09-17")], { now, windowDays: 30 });
  assert.equal(profile.weaknesses[0].confidence, "low");
  assert.equal(profile.priorities.length, 0);
});

test("computes error rate, cross-session persistence, and practice recurrence", () => {
  const profile = buildLearningProfile({
    totalInputs: 10,
    diagnoses: [
      row("Grammar / Verb Tense", "2026-09-17", { input_id: 1, session_id: 1 }),
      row("Grammar / Verb Tense", "2026-09-15", { input_id: 2, session_id: 2 }),
      row("Grammar / Verb Tense", "2026-09-01", { input_id: 3, session_id: 3 }),
      row("Grammar / Verb Tense", "2026-09-01", { input_id: 4, session_id: 3 }),
    ],
    attempts: [
      { target_error_type: "Grammar / Verb Tense", score: 60, created_at: "2026-09-10 10:00:00" },
      { target_error_type: "Grammar / Verb Tense", score: 88, created_at: "2026-09-16 10:00:00" },
    ],
  }, { now, windowDays: 30 });

  const weakness = profile.weaknesses[0];
  assert.equal(profile.errorRate, 0.4);
  assert.equal(weakness.days, 3);
  assert.equal(weakness.sessions, 3);
  assert.equal(weakness.recent, 2);
  assert.equal(weakness.previous, 2);
  assert.equal(weakness.practiceAttempts, 2);
  assert.equal(weakness.lowScoreRate, 0.5);
  assert.equal(weakness.postPracticeRecurrences, 2);
  assert.equal(weakness.observedPracticeAttempts, 2);
  assert.equal(weakness.practiceRecurrenceRate, 1);
});

test("reports an improving trend when recent error opportunities fall", () => {
  const profile = buildLearningProfile({
    totalInputs: 20,
    diagnoses: [
      row("Grammar / Article Usage", "2026-09-17"),
      row("Grammar / Article Usage", "2026-08-29"),
      row("Grammar / Article Usage", "2026-08-27"),
      row("Grammar / Article Usage", "2026-08-25"),
    ],
    attempts: [],
  }, { now, windowDays: 30 });

  assert.equal(profile.weaknesses[0].trend, "improving");
  assert.equal(profile.weaknesses[0].recent, 1);
  assert.equal(profile.weaknesses[0].previous, 3);
});

test("measures transfer evidence across production contexts", () => {
  const profile = buildLearningProfile({
    totalInputs: 12,
    diagnoses: [
      row("Grammar / Preposition Usage", "2026-09-17"),
      row("Grammar / Preposition Usage", "2026-09-15"),
    ],
    attempts: [
      { target_error_type: "Grammar / Preposition Usage", context_label: "work-email", score: 90, created_at: "2026-09-12 10:00:00" },
      { target_error_type: "Grammar / Preposition Usage", context_label: "meeting", score: 70, created_at: "2026-09-13 10:00:00" },
      { target_error_type: "Grammar / Preposition Usage", context_label: "daily-routine", score: 80, created_at: "2026-09-14 10:00:00" },
      { target_error_type: "Grammar / Preposition Usage", context_label: "drill:B1", score: 100, created_at: "2026-09-14 11:00:00" },
    ],
  }, { now, windowDays: 30 });

  const weakness = profile.weaknesses[0];
  assert.equal(weakness.contextCoverage, 3);
  assert.deepEqual(weakness.contexts, ["daily-routine", "meeting", "work-email"]);
  assert.equal(weakness.transferStatus, "mixed");
  assert.equal(weakness.transferEvidence, "supported");
  assert.deepEqual(weakness.realContexts, []);
});

test("keeps high-confidence real input contexts separate from practice contexts", () => {
  const profile = buildLearningProfile({
    totalInputs: 4,
    diagnoses: [
      row("Grammar / Article Usage", "2026-09-17", { context_label: "work-email", context_confidence: "high" }),
      row("Grammar / Article Usage", "2026-09-15", { context_label: "meeting", context_confidence: "ambiguous" }),
    ],
    attempts: [],
  }, { now, windowDays: 30 });
  assert.deepEqual(profile.weaknesses[0].realContexts, ["work-email"]);
  assert.deepEqual(profile.weaknesses[0].practiceContexts, []);
});

test("promotes repeated low-scoring vocabulary practice into a diagnosis priority", () => {
  const profile = buildLearningProfile({
    totalInputs: 0,
    diagnoses: [],
    attempts: [
      { target_error_type: "Vocabulary / Usage", target_pattern: "address", score: 62, created_at: "2026-09-17 10:00:00", context_label: "customer-issue" },
      { target_error_type: "Vocabulary / Usage", target_pattern: "address", score: 70, created_at: "2026-09-15 10:00:00", context_label: "meeting" },
      { target_error_type: "Vocabulary / Usage", target_pattern: "address", score: 68, created_at: "2026-09-12 10:00:00", context_label: "work-email" },
    ],
  }, { now, windowDays: 30 });

  assert.equal(profile.priorities[0].errorType, "Vocabulary / Usage");
  assert.equal(profile.priorities[0].count, 3);
  assert.equal(profile.priorities[0].confidence, "high");
  assert.equal(profile.priorities[0].practiceAttempts, 3);
  assert.equal(profile.priorities[0].lowScoreAttempts, 3);
});

test("does not treat an isolated practice attempt as a completed retest", () => {
  const profile = buildLearningProfile({
    totalInputs: 0,
    diagnoses: [],
    attempts: [{
      target_error_type: "Vocabulary / Usage",
      target_pattern: "address",
      score: 62,
      created_at: "2026-09-17 10:00:00",
      context_label: "work-email",
    }],
  }, { now, windowDays: 30 });
  assert.equal(profile.weaknesses[0].observedPracticeAttempts, 0);
  assert.equal(profile.weaknesses[0].practiceRecurrenceRate, null);
});
