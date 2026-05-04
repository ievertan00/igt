// Backfill session_id for any inputs row written before Phase 0.4. Groups consecutive
// rows whose timestamps are within SESSION_GAP_MS into one synthetic session, in order.

const SESSION_GAP_MS = 30 * 60 * 1000;

function tsToMs(s) {
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function up(db) {
  const orphans = db.prepare(`
    SELECT id, timestamp FROM inputs
    WHERE session_id IS NULL
    ORDER BY id ASC
  `).all();

  if (orphans.length === 0) return;

  const insertSession = db.prepare(`
    INSERT INTO sessions (start_time, end_time, total_inputs) VALUES (?, ?, ?)
  `);
  const updateInput = db.prepare(`UPDATE inputs SET session_id = ? WHERE id = ?`);

  const tx = db.transaction(() => {
    let currentId = null;
    let lastMs = null;
    let firstIsoOfSession = null;
    let countInSession = 0;

    const closeSession = (lastIso) => {
      if (currentId !== null) {
        db.prepare(`UPDATE sessions SET end_time = ?, total_inputs = ? WHERE id = ?`)
          .run(lastIso, countInSession, currentId);
      }
    };

    for (const row of orphans) {
      const ms = tsToMs(row.timestamp);
      const iso = ms ? new Date(ms).toISOString() : new Date().toISOString();

      if (currentId === null || lastMs === null || (ms !== null && (ms - lastMs) > SESSION_GAP_MS)) {
        closeSession(firstIsoOfSession || iso);
        const res = insertSession.run(iso, iso, 0);
        currentId = res.lastInsertRowid;
        firstIsoOfSession = iso;
        countInSession = 0;
      }

      updateInput.run(currentId, row.id);
      lastMs = ms;
      countInSession += 1;

      // keep the rolling end_time fresh
      db.prepare(`UPDATE sessions SET end_time = ?, total_inputs = ? WHERE id = ?`)
        .run(iso, countInSession, currentId);
    }
  });

  tx();
}
