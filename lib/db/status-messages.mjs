import { getDb } from "./connection.mjs";

export async function getRandomMessage() {
  const db = await getDb();
  const row = db.prepare(`
    SELECT * FROM status_messages
    ORDER BY last_shown_at ASC, RANDOM()
    LIMIT 1
  `).get();
  if (row) {
    db.prepare(`UPDATE status_messages SET last_shown_at = CURRENT_TIMESTAMP WHERE id = ?`).run(row.id);
  }
  return row || { content: "Keep practicing!", type: "tip" };
}
