import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, QUALITY_CORRECT, QUALITY_WRONG } from "../lib/srs.mjs";

test("correct answer increases interval and ease", () => {
  // Need totalReviews >= 2 so SM-2 uses the exponential branch (not the 1d/6d seeding)
  const next = grade({ ease: 2.5, intervalDays: 1, totalReviews: 2, correctStreak: 2 }, QUALITY_CORRECT);
  assert.ok(next.intervalDays > 1, "interval should grow after correct answer");
  assert.ok(next.ease >= 2.5, "ease should not decrease after correct answer");
  assert.equal(next.totalReviews, 3);
  assert.equal(next.correctStreak, 3);
});

test("wrong answer resets interval to 1 and decreases ease", () => {
  const next = grade({ ease: 2.5, intervalDays: 30, totalReviews: 5, correctStreak: 5 }, QUALITY_WRONG);
  assert.equal(next.intervalDays, 1, "interval should reset to 1 day");
  assert.ok(next.ease < 2.5, "ease should decrease after wrong answer");
  assert.equal(next.correctStreak, 0);
});

test("ease has a floor of 1.3", () => {
  let state = { ease: 1.3, intervalDays: 1, totalReviews: 0, correctStreak: 0 };
  for (let i = 0; i < 5; i++) state = grade(state, QUALITY_WRONG);
  assert.ok(state.ease >= 1.3, `ease must not drop below 1.3, got ${state.ease}`);
});

test("dueDate is a YYYY-MM-DD string", () => {
  const next = grade({ ease: 2.5, intervalDays: 1, totalReviews: 0, correctStreak: 0 }, QUALITY_CORRECT);
  assert.match(next.dueDate, /^\d{4}-\d{2}-\d{2}$/);
});
