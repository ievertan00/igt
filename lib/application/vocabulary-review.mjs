import { grade, gradeRating, REVIEW_RATINGS, QUALITY_CORRECT, QUALITY_WRONG } from "../domain/srs.mjs";
import { isVocabularyRecallCorrect } from "../domain/vocabulary-review.mjs";
import { insertPracticeAttempt } from "../features/practice/attempts.mjs";

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

function recallCard(db, cardId, answer) {
  if (!Number.isInteger(cardId) || cardId < 1 || typeof answer !== "string" || answer.length > 1000) {
    throw fail(400, "INVALID_REQUEST", "Provide a vocabulary card and recall answer.");
  }
  const card = db.prepare("SELECT * FROM srs_cards WHERE id = ? AND source_type = 'vocab'").get(cardId);
  if (!card) throw fail(404, "NOT_FOUND", "Vocabulary card not found. Start a new review session.");
  return card;
}

const scheduleState = card => ({ ease: card.ease, intervalDays: card.interval_days,
  totalReviews: card.total_reviews, correctStreak: card.correct_streak });

// Revealing an answer does not count as a scheduled review or write learning evidence.
export function checkVocabularyReview(db, { cardId, answer }) {
  const card = recallCard(db, cardId, answer);
  const now = new Date();
  return {
    correct: isVocabularyRecallCorrect(answer, card.word), judgement: "typed-recall",
    ratings: Object.fromEntries(REVIEW_RATINGS.map(rating => {
      const next = gradeRating(scheduleState(card), rating, now);
      return [rating, { intervalDays: next.intervalDays, dueDate: next.dueDate }];
    })),
    persistence: { saved: false },
  };
}

// Scheduling and recall evidence must either both commit or both roll back.
// A request id is persisted with the evidence so lost responses can be retried.
export function gradeVocabularyReview(db, { cardId, answer, requestId, audioPlayed = false, rating }) {
  if (!Number.isInteger(cardId) || cardId < 1 || typeof answer !== "string" || answer.length > 1000
    || typeof requestId !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(requestId)) {
    throw fail(400, "INVALID_REQUEST", "Provide a vocabulary card, recall answer and review request id.");
  }
  if (rating !== undefined && !REVIEW_RATINGS.includes(rating)) {
    throw fail(400, "INVALID_REQUEST", "rating must be one of again, hard, good, easy");
  }
  return db.transaction(() => {
    const previous = db.prepare(`SELECT feedback FROM practice_attempts
      WHERE activity_type = 'review-vocabulary' AND json_valid(feedback)
      AND json_extract(feedback, '$.reviewId') = ? LIMIT 1`).get(requestId);
    if (previous) {
      const feedback = JSON.parse(previous.feedback);
      if (feedback.cardId !== cardId || feedback.answer !== answer.trim() || (feedback.rating ?? null) !== (rating ?? null)) {
        throw fail(409, "REVIEW_CONFLICT", "This review request was already used for a different answer or rating.");
      }
      return feedback.result;
    }
    const card = recallCard(db, cardId, answer);
    const recall = answer.trim();
    const correct = isVocabularyRecallCorrect(recall, card.word);
    const next = rating ? gradeRating(scheduleState(card), rating)
      : grade(scheduleState(card), correct ? QUALITY_CORRECT : QUALITY_WRONG);
    db.prepare(`UPDATE srs_cards SET ease = ?, interval_days = ?, due_date = ?, last_reviewed = CURRENT_TIMESTAMP,
      total_reviews = ?, correct_streak = ? WHERE id = ?`).run(next.ease, next.intervalDays, next.dueDate, next.totalReviews, next.correctStreak, cardId);
    const result = { correct, rating: rating ?? null, judgement: "typed-recall", next: { intervalDays: next.intervalDays, dueDate: next.dueDate, ease: next.ease }, persistence: { saved: true } };
    insertPracticeAttempt(db, {
      activityType: "review-vocabulary", targetErrorType: "Vocabulary", targetPattern: card.word,
      contextLabel: "review:vocabulary", prompt: card.word, learnerAnswer: recall || "(blank)",
      referenceAnswer: card.word, score: correct ? 100 : 0,
      feedback: { correct, cardId, answer: recall, reviewId: requestId, rating: rating ?? null, audioPlayed: Boolean(audioPlayed), result },
    });
    return result;
  })();
}
