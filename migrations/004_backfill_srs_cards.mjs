// Seed the SRS deck from existing diagnoses. One card per diagnosis (cloze-style if
// possible, otherwise full-sentence prompt). All cards due today so /review surfaces
// them immediately.
//
// Per T2: only generate substitution-based cloze cards (1-3 changed tokens). For
// non-substitution diffs (deletions, insertions, multi-word rewordings), fall back to
// a full-sentence "rewrite this with the [Error Type] fixed" prompt. Mastery view
// still tracks the underlying error_type either way.

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

export function up(db) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

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
        // Fall back to a full-sentence rewrite prompt
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
