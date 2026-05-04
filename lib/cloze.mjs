/**
 * Cloze extraction. Given (original, correction), build a fill-in-the-blank prompt
 * by detecting 1-3 single-token substitutions (per T2). Returns null when the diff
 * isn't substitution-only (deletions, insertions, or multi-word rewordings).
 *
 * Mastery view still tracks the underlying error_type either way; we just don't
 * generate cloze cards for non-substitution diffs because the resulting blanks
 * would be ambiguous.
 */

function strip(s) {
  return s.replace(/^[.,!?;:'"()\-]+|[.,!?;:'"()\-]+$/g, "");
}

export function buildCloze(original, correction) {
  if (!original || !correction) return null;
  const ow = original.split(/\s+/);
  const cw = correction.split(/\s+/);
  if (ow.length !== cw.length) return null;

  const subs = [];
  for (let i = 0; i < ow.length; i++) {
    const a = strip(ow[i]).toLowerCase();
    const b = strip(cw[i]).toLowerCase();
    if (a !== b && a.length > 0 && b.length > 0) subs.push({ index: i, was: ow[i], to: cw[i] });
  }
  if (subs.length === 0 || subs.length > 3) return null;

  const blanked = ow.slice();
  for (const s of subs) blanked[s.index] = "____";
  return {
    prompt: blanked.join(" "),
    answer: subs.map(s => strip(s.to)).join(" "),
  };
}
