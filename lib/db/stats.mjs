import fs from "node:fs";
import configLoader from "../shared/config-loader.mjs";
import { getDb } from "./connection.mjs";
import { parseVocab } from "../domain/vault-parser.mjs";
import { getReviewStats, getReviewLearningData } from "./review-stats.mjs";

export async function getStats() {
  const db = await getDb({ readonly: true });
  const review = getReviewStats(0);
  const dueRows = db.prepare(`
    SELECT source_type, COUNT(*) AS count FROM srs_cards
    WHERE source_type = 'vocab' AND due_date <= date('now', 'localtime')
    GROUP BY source_type
  `).all();
  const dueCounts = { grammar: 0, vocab: 0 };
  for (const row of dueRows) if (row.source_type === "vocab") dueCounts.vocab = row.count;
  return { ...review, dueCounts };
}

export async function getTodayEffort() {
  const db = await getDb({ readonly: true });
  const config = configLoader.load();
  const review = getReviewStats(0);
  const vocabReviewed = db.prepare(`
    SELECT COUNT(*) AS count FROM srs_cards
    WHERE source_type = 'vocab' AND date(last_reviewed, 'localtime') = date('now', 'localtime')
  `).get().count;
  let vocabAddedToday = 0;
  try {
    if (config.VocabularyPath && fs.existsSync(config.VocabularyPath)) {
      vocabAddedToday = parseVocab(fs.readFileSync(config.VocabularyPath, "utf8")).addedToday;
    }
  } catch {}
  return {
    inputs_today: review.inputsToday,
    errors_today: review.errorsToday,
    topErrors: review.topErrorsToday,
    grammar_reviewed: 0,
    vocab_reviewed: vocabReviewed,
    vocab_added_today: vocabAddedToday,
  };
}

export { getReviewLearningData };
