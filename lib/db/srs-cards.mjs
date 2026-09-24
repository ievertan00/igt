import { getDb } from "./connection.mjs";

export async function getDueCards({ limit = 10, type = "all" } = {}) {
  const db = await getDb({ readonly: true });
  const cards = db.prepare(`
    SELECT c.id, c.source_type, c.source_id, c.prompt, c.answer, c.ease, c.interval_days,
           c.due_date, c.total_reviews, c.correct_streak,
           c.word, c.pos, c.zh, c.meaning, c.example, c.note, c.vocab_details,
           NULL AS hint,
           NULL AS explanation
    FROM srs_cards c
    WHERE c.source_type = 'vocab' AND c.due_date <= date('now', 'localtime')
    ORDER BY c.due_date ASC, c.id ASC
    LIMIT ?
  `).all(Math.max(1, Math.min(limit, 100)));
  return cards.map((card) => {
    try { return { ...card, vocab_details: card.vocab_details ? JSON.parse(card.vocab_details) : null }; }
    catch { return { ...card, vocab_details: null }; }
  });
}

export async function getCardById(cardId) {
  const db = await getDb();
  return db.prepare(`SELECT * FROM srs_cards WHERE id = ?`).get(cardId);
}

export async function updateAfterGrading(cardId, next) {
  const db = await getDb();
  db.prepare(`
    UPDATE srs_cards
    SET ease = ?, interval_days = ?, due_date = ?, last_reviewed = CURRENT_TIMESTAMP,
        total_reviews = ?, correct_streak = ?
    WHERE id = ?
  `).run(next.ease, next.intervalDays, next.dueDate, next.totalReviews, next.correctStreak, cardId);
}

export async function deleteCard(cardId) {
  const db = await getDb();
  return db.prepare(`DELETE FROM srs_cards WHERE id = ?`).run(cardId).changes;
}

export async function insertVocabCard({ word, pos = "", zh = "", meaning = "", example = "", note = "", vocabDetails = null }) {
  const db = await getDb();
  db.prepare(`
    INSERT INTO srs_cards
      (source_type, source_id, prompt, answer, due_date, word, pos, zh, meaning, example, note, vocab_details)
    VALUES ('vocab', NULL, ?, ?, date('now', 'localtime'), ?, ?, ?, ?, ?, ?, ?)
  `).run(word, word, word, pos, zh, meaning, example, note, vocabDetails ? JSON.stringify(vocabDetails) : null);
}

export async function vocabCardExistsForWord(word) {
  const db = await getDb({ readonly: true });
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM srs_cards WHERE source_type = 'vocab' AND word = ?`
  ).get(word);
  return row.n > 0;
}
