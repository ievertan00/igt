/**
 * SM-2 spaced-repetition scheduler. Pure functions over card state.
 * Quality scale: 0-5 (3-5 = correct, 0-2 = wrong).
 *
 * No `graduated` column (per A12). SM-2's exponential interval growth handles
 * long-term spacing on its own (60d → 150d → 360d → 900d ...). A wrong recall
 * at any point resets interval to 1d. /review just queries `WHERE due_date <= today`.
 */

export const EASE_MIN = 1.3;
export const EASE_DEFAULT = 2.5;

/**
 * Apply SM-2 to a card given a recall quality.
 * @param {{ ease:number, intervalDays:number, totalReviews:number, correctStreak:number }} card
 * @param {number} quality   0-5 (3-5 correct, 0-2 wrong)
 * @returns {{ ease:number, intervalDays:number, totalReviews:number, correctStreak:number, dueDate:string }}
 */
export function grade(card, quality) {
  const q = Math.max(0, Math.min(5, quality | 0));
  const correct = q >= 3;

  let ease = card.ease ?? EASE_DEFAULT;
  let intervalDays = card.intervalDays ?? 1;
  let totalReviews = (card.totalReviews ?? 0) + 1;
  let correctStreak = correct ? (card.correctStreak ?? 0) + 1 : 0;

  if (correct) {
    if (totalReviews === 1) intervalDays = 1;
    else if (totalReviews === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(intervalDays * ease));
    // SM-2 ease update
    ease = Math.max(EASE_MIN, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  } else {
    intervalDays = 1;
    ease = Math.max(EASE_MIN, ease - 0.2);
  }

  const due = new Date();
  due.setUTCHours(0, 0, 0, 0);
  due.setUTCDate(due.getUTCDate() + intervalDays);
  const dueDate = due.toISOString().slice(0, 10);

  return { ease, intervalDays, totalReviews, correctStreak, dueDate };
}

/**
 * Convenience: quality 5 (perfect) for "correct" answers, quality 2 ("hard miss")
 * for "wrong" — used by /review where we only have a binary signal from grading.
 */
export const QUALITY_CORRECT = 5;
export const QUALITY_WRONG = 2;
