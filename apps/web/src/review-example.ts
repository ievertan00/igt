const irregularForms: Record<string, string[]> = {
  be: ["am", "is", "are", "was", "were", "been", "being"],
  have: ["has", "had"], do: ["does", "did", "done"],
  go: ["goes", "went", "gone"], come: ["came"], get: ["got", "gotten"],
  make: ["made"], take: ["took", "taken"], give: ["gave", "given"],
  write: ["wrote", "written"], read: ["read"], speak: ["spoke", "spoken"],
  see: ["saw", "seen"], know: ["knew", "known"], think: ["thought"],
  say: ["said"], tell: ["told"], buy: ["bought"], bring: ["brought"],
  find: ["found"], leave: ["left"], feel: ["felt"], keep: ["kept"],
  run: ["ran"], begin: ["began", "begun"], choose: ["chose", "chosen"],
  break: ["broke", "broken"], build: ["built"], hold: ["held"],
  child: ["children"], person: ["people"], mouse: ["mice"], foot: ["feet"],
};

function wordForms(word: string) {
  const base = word.toLowerCase();
  if (!/^[a-z]+$/.test(base)) return [word];
  const forms = new Set([base, ...(irregularForms[base] || [])]);
  // Highlight familiar inflections only; this is a display aid, never answer validation.
  forms.add(base + "s");
  if (/(s|x|z|ch|sh|o)$/.test(base)) forms.add(base + "es");
  if (/[^aeiou]y$/.test(base)) {
    forms.add(base.slice(0, -1) + "ies");
    forms.add(base.slice(0, -1) + "ied");
  }
  if (/e$/.test(base)) {
    forms.add(base + "d");
    forms.add(base.slice(0, -1) + "ing");
  } else {
    forms.add(base + "ed");
    forms.add(base + "ing");
  }
  if (/ie$/.test(base)) forms.add(base.slice(0, -2) + "ying");
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(base)) {
    forms.add(base + base.at(-1) + "ed");
    forms.add(base + base.at(-1) + "ing");
  }
  return [...forms];
}

export function reviewExampleParts(text: string, expression: string) {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const words = expression.trim().split(/[\s-]+/).filter(Boolean);
  if (!words.length) return [{ text, highlighted: false }];
  const phrase = words.map(word => `(?:${wordForms(word).map(escape).join("|")})`).join("[\\s-]+");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, "giu");
  const parts: { text: string; highlighted: boolean }[] = [];
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index), highlighted: false });
    parts.push({ text: match[0], highlighted: true });
    offset = match.index + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), highlighted: false });
  return parts;
}
