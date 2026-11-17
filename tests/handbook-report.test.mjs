import test from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../lib/features/handbook/report.mjs";

test("handbook renders the learning diagnosis without owning its logic", () => {
  const markdown = buildReport({
    provider: "mock",
    handbookModel: "mock-model",
    date: "2026-09-18",
    days: 90,
    stats: { total_inputs: 20, total_diagnoses: 3 },
    errorFrequency: [],
    trendData: [],
    examplesByType: new Map(),
    rules: new Map(),
    overallSummary: null,
    learningProfile: {
      sample: { errorRate: 0.15 },
      priorities: [{
        errorType: "Grammar / Verb Tense",
        count: 3,
        days: 3,
        sessions: 2,
        recent: 2,
        trend: "rising",
        confidence: "medium",
        practiceAttempts: 1,
        practiceRecurrenceRate: 1,
        reviewed: 0,
        practice: "做时态对比练习。",
        resource: { title: "Cambridge Grammar", url: "https://example.com", why: "对比真实例句。" },
      }],
    },
  });

  assert.match(markdown, /Learning Profile & Next Actions/);
  assert.match(markdown, /0\.15/);
  assert.match(markdown, /Grammar \/ Verb Tense/);
  assert.match(markdown, /Practice recurrence/);
  assert.match(markdown, /Cambridge Grammar/);
});
