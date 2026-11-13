// Only learner-facing text is renderable. Unknown objects must never become a JSON dump.
export const asText = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('\n');
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value !== 'string') return '';
  const text = displayString(value);
  if (opaqueId(text) || text === '[object Object]') return '';
  if (/^[\[{]/.test(text)) {
    try { const parsed: unknown = JSON.parse(text); if (parsed && typeof parsed === 'object') return Array.isArray(parsed) ? asText(parsed) : ''; } catch { /* Ordinary learner prose. */ }
  }
  return text;
};
export const object = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') { try { return object(JSON.parse(value)); } catch { return {}; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
};
// Record keys, fingerprints and vault ids are machine references: learners must never read them as content.
const opaqueId = (value: string) => {
  const bare = value.includes(':') ? value.slice(value.indexOf(':') + 1) : value;
  return /^(sha256:)?[0-9a-f]{16,}$/i.test(bare) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-\d+)?$/i.test(bare) || /^(review|practice-log)-[0-9a-f]{16,}$/i.test(bare);
};
const displayString = (value: string) => value
  .replace(/<!--[\s\S]*?-->/g, '')
  .split('\n')
  .filter(line => !/^\s*\*\*(Entry ID|Fingerprint|Duplicate of|ID)\*\*\s*:/i.test(line))
  .join('\n')
  .trim();
export const markdownBody = (value: string) => displayString(value.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, ''));

