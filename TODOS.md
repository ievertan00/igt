# IGT TODOS

## P2

### Rewrite-style card type for Style/Clarity errors

**What:** New `card_type='rewrite'` in `srs_cards` that shows the original sentence and asks for a full corrected sentence; LLM-graded only (no exact-match shortcut).
**Why:** Phase 1's cloze extraction covers ~12 of 28 error types (substitutions only). Style, Clarity, and Sentence-Structure errors get tracked in mastery view but never actively drilled. Without rewrite cards, mastery is observational only — you see counts trend but never practice the rewrite.
**Pros:** Closes the coverage gap; covers all 28 error types eventually; pairs naturally with the existing diagnoses corpus (no new data collection).
**Cons:** Per-review LLM cost on every card (no exact-match shortcut); higher complexity in `lib/srs.mjs` grading; risk of building a chore instead of a learning tool.
**Context:** Implement in `lib/cloze.mjs` (or rename to `lib/cards.mjs`) as a second extraction path. Source: `diagnoses` rows where `diffWords()` returned null AND `diffPhrases()` returned multi-pair output OR the diagnosis error_type is in {Style, Clarity, Sentence Structure}. Card prompt: "Rewrite this sentence to fix [error_type] error: <original>". Answer: `inputs.correction`. Grading: always LLM (one Gemini Flash call, "Are these two sentences semantically equivalent? yes/no").
**Effort:** S-M (~3h human / ~15min CC)
**Depends on:** Phase 1 cloze cards in production for 4+ weeks. Decide based on whether the gap actually hurts during use.

### Materialize mastery_view if /stats slow

**What:** If `/stats` or `/today` ever feels slow (>200ms perceived latency), add a `mastery_snapshots` table refreshed on each `saveToDatabase` write.
**Why:** Phase 1.3's mastery query is computed-on-demand. At current scale (36 diagnoses) it's free. At ~5,000 diagnoses (achievable in 6 months of daily use) it's still <50ms thanks to `idx_diagnoses_error_type`. This TODO is the perf placeholder so future-you measures before optimizing.
**Pros:** Documents the deferral with a clear trigger criterion ("if >200ms"); prevents premature optimization.
**Cons:** Could rot if never revisited.
**Context:** Trigger: profile mastery query in `tools/igt-analytics.mjs` and any `/today` invocation. If consistent >200ms, add `CREATE TABLE mastery_snapshots (error_type TEXT PRIMARY KEY, last_30d INTEGER, mastery_level TEXT, updated_at TIMESTAMP)`. Refresh on each `saveToDatabase` write via `INSERT OR REPLACE`.
**Effort:** S (~2h human / ~10min CC) when triggered.
**Depends on:** Real measurement showing the query is slow. Don't build speculatively.

### igt-practice.mjs JSON sanitizer

**What:** Remove the self-canceling escape/unescape loop (lines 303-311) and replace with a single `JSON.parse()` call.
**Why:** The current sanitizer escapes quotes then immediately unescapes them — net noop. It's working by accident. After Phase 0.3 (structured JSON output), the LLM returns clean JSON, making the sanitizer both unnecessary and misleading.
**Pros:** Removes dead code; aligns with Phase 0.3's structured output approach.
**Cons:** None after Phase 0.3 ships.
**Context:** `tools/igt-practice.mjs` lines 303-311. Only safe to remove after Phase 0.3 is verified working with all 3 LLM providers.
**Effort:** S (~30min human / ~5min CC)
**Depends on:** Phase 0.3 (structured LLM output) verified and stable.

## RESOLVED (folded into v3.5 plan, 2026-05-03)

- ~~API key validation at startup~~ → Phase 0.2
- ~~View A COALESCE for error-free hours~~ → Phase 2.1 (SQL written into the view)
- ~~Backfill historical session_ids~~ → Phase 0 via `tools/backfill-sessions.mjs` (T5 pattern)
