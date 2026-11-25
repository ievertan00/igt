// SM-2 scheduler: interval progression, ease floor, wrong-recall reset.
import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, EASE_MIN, EASE_DEFAULT, QUALITY_CORRECT, QUALITY_WRONG } from "../lib/domain/srs.mjs";
import { beijingDate } from "../lib/shared/timezone.mjs";

const newCard = () => ({ ease: EASE_DEFAULT, intervalDays: 1, totalReviews: 0, correctStreak: 0 });

test("first correct → interval 1d", () => {
  const r = grade(newCard(), QUALITY_CORRECT);
  assert.equal(r.intervalDays, 1);
  assert.equal(r.totalReviews, 1);
  assert.equal(r.correctStreak, 1);
});

test("second correct → interval 6d", () => {
  const r = grade({ ...newCard(), totalReviews: 1 }, QUALITY_CORRECT);
  assert.equal(r.intervalDays, 6);
});

test("third correct multiplies by ease", () => {
  const start = { ease: 2.5, intervalDays: 6, totalReviews: 2, correctStreak: 2 };
  const r = grade(start, QUALITY_CORRECT);
  assert.equal(r.intervalDays, 15); // round(6 * 2.5)
});

test("interval grows exponentially toward graduation", () => {
  let card = newCard();
  for (let i = 0; i < 8; i++) card = grade(card, QUALITY_CORRECT);
  // After 8 correct, interval should be well past 60 days
  assert.ok(card.intervalDays > 60, `expected >60d, got ${card.intervalDays}d`);
});

test("wrong answer resets interval to 1 and lowers ease", () => {
  const start = { ease: 2.5, intervalDays: 30, totalReviews: 5, correctStreak: 5 };
  const r = grade(start, QUALITY_WRONG);
  assert.equal(r.intervalDays, 1);
  assert.equal(r.correctStreak, 0);
  assert.ok(r.ease < 2.5);
});

test("ease cannot go below 1.3 floor", () => {
  let card = { ease: 1.4, intervalDays: 10, totalReviews: 5, correctStreak: 5 };
  for (let i = 0; i < 10; i++) card = grade(card, QUALITY_WRONG);
  assert.equal(card.ease, EASE_MIN);
});

test("dueDate is today + intervalDays in YYYY-MM-DD", () => {
  const r = grade(newCard(), QUALITY_CORRECT);
  const expected = new Date();
  expected.setUTCHours(0, 0, 0, 0);
  expected.setUTCDate(expected.getUTCDate() + 1);
  assert.equal(r.dueDate, beijingDate(expected));
});
