# Practice compatibility payload removal — 2026-10-04

The configured actual `igt_data.db` remains the content authority.
Migration 039 removed the top-level `_legacy` JSON property from 654 questions;
the bank still contains 754 questions, with zero remaining payloads.
Before/after comparison verified that all other question fields, counters,
activation state and all seven other data tables were unchanged.

The authoritative JSON export was refreshed. Current decoding, style filtering,
evaluation and historical imports no longer read deleted annotations.
Historical migration adapters use current dimensions and an ID-only membership
file; they do not retain the deleted compatibility notes. Migration 036 no longer
creates the property. The shared evaluation prompt still accepts equivalent English.

A recovery-only SQLite backup is in `.cache/practice-before-remove-legacy.db`;
it contains the pre-cleanup state and must not be used as a content authority.
Older archived databases and historical attempt records were not rewritten.

Verification: `npm run verify:practice-bank` checks authoritative export equality,
fresh migration equality, absence of the retired property, idempotence and integrity.
The learning workflow suite passed 88 tests. Browser smoke was not rerun for this
cleanup. Restoration also handles databases stopping at 036/037 with old payloads,
removing the payload transactionally before comparing against the cleaned export.
