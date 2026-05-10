import { getDb } from "./connection.mjs";

const SESSION_GAP_MS = 30 * 60 * 1000;
let currentSessionId = null;
let lastInputAt = null;
let sessionBootstrapped = false;

function parseSqliteTs(s) {
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export async function getOrStartSession() {
  const db = await getDb();
  if (!sessionBootstrapped) {
    const last = db.prepare(`
      SELECT timestamp, session_id FROM inputs
      WHERE session_id IS NOT NULL
      ORDER BY id DESC LIMIT 1
    `).get();
    if (last) {
      currentSessionId = last.session_id;
      lastInputAt = parseSqliteTs(last.timestamp);
    }
    sessionBootstrapped = true;
  }
  const now = Date.now();
  if (currentSessionId === null || lastInputAt === null || (now - lastInputAt) > SESSION_GAP_MS) {
    const startIso = new Date(now).toISOString();
    const result = db.prepare(`
      INSERT INTO sessions (start_time, end_time, total_inputs) VALUES (?, ?, 0)
    `).run(startIso, startIso);
    currentSessionId = result.lastInsertRowid;
  }
  lastInputAt = now;
  return currentSessionId;
}

export function resetSessionState() {
  currentSessionId = null;
  lastInputAt = null;
  sessionBootstrapped = false;
}

export function getCurrentSessionId() {
  return currentSessionId;
}

export async function insertInput(sessionId, originalText, correction, refine) {
  const db = await getDb();
  const result = db.prepare(`
    INSERT INTO inputs (session_id, original_text, correction, refine)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, originalText, correction, refine);
  db.prepare(`
    UPDATE sessions SET end_time = ?, total_inputs = total_inputs + 1 WHERE id = ?
  `).run(new Date().toISOString(), sessionId);
  return result.lastInsertRowid;
}

export async function getLastN(n) {
  const db = await getDb({ readonly: true });
  return db.prepare(`
    SELECT id, timestamp, original_text FROM inputs ORDER BY id DESC LIMIT ?
  `).all(Math.max(1, Math.min(n, 50)));
}

export async function undoLastN(n) {
  const db = await getDb();
  const ids = db.prepare(`SELECT id FROM inputs ORDER BY id DESC LIMIT ?`).all(n).map(r => r.id);
  if (ids.length === 0) {
    return { deleted_inputs: 0, deleted_diagnoses: 0, deleted_advice: 0, deleted_cards: 0, input_ids: [] };
  }
  const placeholders = ids.map(() => "?").join(",");
  const tx = db.transaction(() => {
    const diagIds = db.prepare(`SELECT id FROM diagnoses WHERE input_id IN (${placeholders})`).all(...ids).map(r => r.id);
    const cardsDeleted = diagIds.length === 0 ? 0 : db.prepare(
      `DELETE FROM srs_cards WHERE source_type IN ('cloze','diagnosis') AND source_id IN (${diagIds.map(()=>"?").join(",")})`
    ).run(...diagIds).changes;
    const adviceDeleted = db.prepare(`DELETE FROM advice WHERE input_id IN (${placeholders})`).run(...ids).changes;
    const diagDeleted = db.prepare(`DELETE FROM diagnoses WHERE input_id IN (${placeholders})`).run(...ids).changes;
    const inputsDeleted = db.prepare(`DELETE FROM inputs WHERE id IN (${placeholders})`).run(...ids).changes;
    return { cardsDeleted, adviceDeleted, diagDeleted, inputsDeleted };
  });
  const r = tx();
  return {
    deleted_inputs: r.inputsDeleted,
    deleted_diagnoses: r.diagDeleted,
    deleted_advice: r.adviceDeleted,
    deleted_cards: r.cardsDeleted,
    input_ids: ids,
  };
}

export async function getSessionSummary(sessionId) {
  const db = await getDb({ readonly: true });
  const sess = db.prepare(`SELECT total_inputs FROM sessions WHERE id = ?`).get(sessionId);
  const errCount = db.prepare(`SELECT COUNT(*) c FROM diagnoses d JOIN inputs i ON i.id = d.input_id WHERE i.session_id = ?`).get(sessionId);
  const topErr = db.prepare(`SELECT error_type, COUNT(*) c FROM diagnoses d JOIN inputs i ON i.id = d.input_id WHERE i.session_id = ? GROUP BY error_type ORDER BY c DESC LIMIT 1`).get(sessionId);
  const cardsAdded = db.prepare(`SELECT COUNT(*) c FROM srs_cards WHERE source_id IN (SELECT d.id FROM diagnoses d JOIN inputs i ON i.id = d.input_id WHERE i.session_id = ?)`).get(sessionId);
  const cardsDueTomorrow = db.prepare(`SELECT COUNT(*) c FROM srs_cards WHERE due_date = date('now', '+1 day')`).get();
  const avg7day = db.prepare(`SELECT CAST(COUNT(d.id) AS REAL) / MAX(1, COUNT(DISTINCT i.id)) avg FROM inputs i LEFT JOIN diagnoses d ON d.input_id = i.id WHERE i.timestamp > datetime('now', '-7 days')`).get();
  return {
    session_id: sessionId,
    total_inputs: sess?.total_inputs || 0,
    total_errors: errCount?.c || 0,
    top_error: topErr?.error_type || null,
    cards_added: cardsAdded?.c || 0,
    cards_due_tomorrow: cardsDueTomorrow?.c || 0,
    avg_errors_7day: avg7day?.avg || 0,
  };
}
