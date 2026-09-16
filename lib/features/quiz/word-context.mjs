import { getDb } from "../../db/connection.mjs";

export async function getWordQuizCards({ limit = 10 } = {}) {
  const db = await getDb({ readonly: true });
  const safeLimit = Math.min(50, Math.max(1, Number.isInteger(limit) ? limit : 10));
  return db.prepare(`
    SELECT word, pos, zh, meaning, example, note
    FROM srs_cards
    WHERE source_type = 'vocab'
      AND word IS NOT NULL
      AND trim(word) <> ''
    ORDER BY RANDOM()
    LIMIT ?
  `).all(safeLimit);
}