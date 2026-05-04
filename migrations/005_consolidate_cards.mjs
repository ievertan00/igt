// Consolidate per-diagnosis cards into one card per input sentence.
// Old source_type 'cloze' and 'diagnosis' cards (one per error type) are replaced
// by a single source_type='input' card whose prompt is the original sentence and
// answer is the full correction. When multiple old cards exist for the same input,
// the one with the best SRS progress (ease + streak) is used as the seed state.

export function up(db) {
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
