/** Highlight added or replaced words while leaving the full correction selectable. */
export function CorrectionText({ original, correction }: { original: string; correction: string }) {
  const before = original.match(/\S+/g) || [];
  const after = correction.match(/\S+/g) || [];
  // Keep unusually long submissions inexpensive to render.
  if (before.length > 400 || after.length > 400) return <>{correction}</>;
  const lengths = Array.from({ length: before.length + 1 }, () => new Uint16Array(after.length + 1));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i][j] = before[i] === after[j]
        ? lengths[i + 1][j + 1] + 1
        : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const unchanged = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) { unchanged.add(j); i++; j++; }
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  let word = 0;
  return <>{correction.split(/(\s+)/).map((part, index) => {
    if (!part.trim()) return part;
    return unchanged.has(word++) ? part : <mark key={index}>{part}</mark>;
  })}</>;
}
