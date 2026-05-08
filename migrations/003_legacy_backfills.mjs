/**
 * Data migrations and backfills (Squashed 003-005).
 * 1. Backfills session_id for orphan inputs.
 * 2. Seeds SRS cards from existing diagnoses.
 * 3. Consolidates per-diagnosis cards into per-input cards.
 */

// --- 1. Backfill Sessions Logic ---
const SESSION_GAP_MS = 30 * 60 * 1000;
function tsToMs(s) {
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function backfillSessions(db) {
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

      db.prepare(`UPDATE sessions SET end_time = ?, total_inputs = ? WHERE id = ?`)
        .run(iso, countInSession, currentId);
    }
  });
  tx();
}

// --- 2. Seed SRS Cards Logic ---
function strip(s) {
  return s.replace(/^[.,!?;:'"()\-]+|[.,!?;:'"()\-]+$/g, "");
}

function diffTokens(orig, corr) {
  const ow = orig.split(/\s+/);
  const cw = corr.split(/\s+/);
  if (ow.length !== cw.length) return null;
  const subs = [];
  for (let i = 0; i < ow.length; i++) {
    const a = strip(ow[i]).toLowerCase();
    const b = strip(cw[i]).toLowerCase();
    if (a !== b && a.length > 0 && b.length > 0) subs.push({ index: i, was: ow[i], to: cw[i] });
  }
  if (subs.length === 0 || subs.length > 3) return null;
  return { tokens: ow, subs };
}

function buildCloze(original, correction) {
  const diff = diffTokens(original, correction);
  if (!diff) return null;
  const blanked = diff.tokens.slice();
  for (const s of diff.subs) blanked[s.index] = "____";
  return {
    prompt: blanked.join(" "),
    answer: diff.subs.map(s => strip(s.to)).join(" "),
  };
}

function seedSRSCards(db) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT d.id AS diag_id, d.error_type, i.original_text, i.correction
    FROM diagnoses d
    JOIN inputs i ON i.id = d.input_id
    WHERE i.correction IS NOT NULL
      AND TRIM(i.correction) <> ''
      AND TRIM(i.original_text) <> TRIM(i.correction)
      AND NOT EXISTS (
        SELECT 1 FROM srs_cards c
        WHERE c.source_type = 'diagnosis' AND c.source_id = d.id
      )
  `).all();

  if (rows.length === 0) return;

  const insertCard = db.prepare(`
    INSERT INTO srs_cards (source_type, source_id, prompt, answer, due_date)
    VALUES ('diagnosis', ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const r of rows) {
      const cloze = buildCloze(r.original_text.trim(), r.correction.trim());
      if (cloze) {
        insertCard.run(r.diag_id, `[${r.error_type}] ${cloze.prompt}`, cloze.answer, today);
      } else {
        insertCard.run(
          r.diag_id,
          `Rewrite with the [${r.error_type}] error fixed: ${r.original_text.trim()}`,
          r.correction.trim(),
          today
        );
      }
    }
  });
  tx();
}

// --- 3. Consolidate Cards Logic ---
function consolidateCards(db) {
  const rows = db.prepare(`
    SELECT c.id, c.ease, c.interval_days, c.due_date, c.total_reviews, c.correct_streak,
           d.input_id
    FROM srs_cards c
    JOIN diagnoses d ON c.source_id = d.id
    WHERE c.source_type IN ('cloze', 'diagnosis')
  `).all();

  const best = new Map();
  for (const card of rows) {
    const prev = best.get(card.input_id);
    const score = card.ease + card.correct_streak * 0.1;
    if (!prev || score > prev._score) {
      best.set(card.input_id, { ...card, _score: score });
    }
  }

  if (best.size === 0) {
    db.prepare(`DELETE FROM srs_cards WHERE source_type IN ('cloze', 'diagnosis')`).run();
    return;
  }

  const ids = [...best.keys()];
  const inputs = db.prepare(
    `SELECT id, original_text, correction FROM inputs WHERE id IN (${ids.map(() => "?").join(",")})`
  ).all(...ids);
  const inputMap = new Map(inputs.map((r) => [r.id, r]));

  db.transaction(() => {
    db.prepare(`DELETE FROM srs_cards WHERE source_type IN ('cloze', 'diagnosis')`).run();

    const insert = db.prepare(`
      INSERT INTO srs_cards (source_type, source_id, prompt, answer, ease, interval_days, due_date, total_reviews, correct_streak)
      VALUES ('input', ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [inputId, card] of best) {
      const inp = inputMap.get(inputId);
      if (!inp || !inp.correction || inp.original_text.trim() === inp.correction.trim()) continue;
      insert.run(
        inputId,
        inp.original_text.trim(),
        inp.correction.trim(),
        card.ease,
        card.interval_days,
        card.due_date,
        card.total_reviews,
        card.correct_streak
      );
    }
  })();
}

export async function up(db) {
  backfillSessions(db);
  seedSRSCards(db);
  consolidateCards(db);
}
