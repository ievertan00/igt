import { getDb } from "./connection.mjs";

export async function getDueCards({ limit = 10, type = "all" } = {}) {
  const db = await getDb({ readonly: true });
  const typeCondition = type === "vocab"
    ? `c.source_type = 'vocab'`
    : type === "grammar"
    ? `c.source_type = 'input'`
    : `c.source_type IN ('input', 'vocab')`;
  return db.prepare(`
    SELECT c.id, c.source_type, c.source_id, c.prompt, c.answer, c.ease, c.interval_days,
           c.due_date, c.total_reviews, c.correct_streak,
           CASE WHEN c.source_type = 'input'
             THEN (SELECT GROUP_CONCAT(d.error_type, ' · ') FROM diagnoses d WHERE d.input_id = c.source_id)
             ELSE NULL
           END AS hint
    FROM srs_cards c
    WHERE ${typeCondition} AND c.due_date <= date('now')
    ORDER BY c.due_date ASC, c.id ASC
    LIMIT ?
  `).all(Math.max(1, Math.min(limit, 100)));
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

export async function insertGrammarCard(inputId, prompt, answer) {
  const db = await getDb();
  db.prepare(`
    INSERT INTO srs_cards (source_type, source_id, prompt, answer, due_date)
    VALUES ('input', ?, ?, ?, date('now'))
  `).run(inputId, prompt, answer);
}

export async function insertVocabCard(prompt, answer) {
  const db = await getDb();
  db.prepare(`
    INSERT INTO srs_cards (source_type, source_id, prompt, answer, due_date)
    VALUES ('vocab', 0, ?, ?, date('now'))
  `).run(prompt, answer);
}

export async function vocabCardExistsForWord(word) {
  const db = await getDb({ readonly: true });
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM srs_cards WHERE source_type='vocab' AND prompt LIKE ?`
  ).get(`VOCAB|||${word}|||%`);
  return row.n > 0;
}

export async function deleteLegacyVocabCards() {
  const db = await getDb();
  db.prepare(
    `DELETE FROM srs_cards WHERE source_type='vocab' AND (prompt LIKE 'VOCAB|||word2zh|||%' OR prompt LIKE 'VOCAB|||zh2word|||%')`
  ).run();
}
