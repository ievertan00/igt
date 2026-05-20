import assert from 'node:assert';
import { parseVocab, parsePractice } from '../lib/domain/vault-parser.mjs';

// Mock data
const vocabContent = `
### word1
*Added: 2026-05-01*
### word2
*Added: 2026-05-10*
`;

const practiceContent = `
## 2026-05-10 10:00 — C1 — 8/10 (80%)
## 2026-05-09 10:00 — B2 — 6/10 (60%)
`;

console.log("Running vault parser tests...");

// Test with fixed reference date
const referenceDate = new Date('2026-05-11');
const vocab = parseVocab(vocabContent, referenceDate);
assert.strictEqual(vocab.total, 2);
assert.strictEqual(vocab.addedThisWeek, 1);

const practice = parsePractice(practiceContent);
assert.strictEqual(practice.avgScore, 70);

// Edge case: empty content
const emptyVocab = parseVocab("");
assert.strictEqual(emptyVocab.total, 0);
assert.strictEqual(emptyVocab.addedThisWeek, 0);

console.log("✅ Vault parser tests passed!");
