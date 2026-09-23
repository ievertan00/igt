import assert from "node:assert/strict";
import { parseReviewLog } from "../lib/db/review-log.mjs";

const entries = parseReviewLog(`### [2026-09-23T00:00:00.000Z]
**Entry ID**: review-v2
**Format**: 2
**User Input**: I suggested him to join.
**Output**:
**Correction**
I suggested that he join.
**Future Field**
Preserve this content.
---
`);
assert.equal(entries.length, 1);
assert.equal(entries[0].formatSupported, false);
assert.match(entries[0].warnings[0], /Unknown Review log Format 2/);
assert.match(entries[0].rawBlock, /Future Field/);
assert.equal(entries[0].diagnoses.length, 0);
console.log("review log contract smoke ok");
