import { getDb } from "./connection.mjs";

export async function insertConsultation({ sessionId, question, responseJson, turnCount }) {
  const db = await getDb();
  const result = db.prepare(`
    INSERT INTO consultations (session_id, question, response_json, turn_count)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, question, responseJson, turnCount);
  return result.lastInsertRowid;
}

export async function getRecentConsultations(limit = 20) {
  const db = await getDb({ readonly: true });
  return db.prepare(`
    SELECT id, session_id, timestamp, question, response_json, turn_count
    FROM consultations
    ORDER BY id DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(limit, 200)));
}

export async function getConsultationById(id) {
  const db = await getDb({ readonly: true });
  return db.prepare(`
    SELECT id, session_id, timestamp, question, response_json, turn_count
    FROM consultations WHERE id = ?
  `).get(id);
}
