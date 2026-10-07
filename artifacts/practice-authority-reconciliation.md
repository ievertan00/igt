# Practice authority reconciliation — 2026-10-04

The actual project `igt_data.db` is authoritative. The content export in
`lib/features/practice/canonical-questions.json` is derived from it, never a
replacement for newer live edits. The bank contains 754 questions.

Resolved the former 503/754 rebuild mismatch by adding migration 038. Legacy
seed modules now read the same export. Removed generated-ID collisions, the 80
unapproved top-up drafts, and the retired situation template generator from
current source. Historical insert commands import only the matching exported
subset and fail on text, metadata or provenance conflicts.

Migration 038 was applied to the actual database. SHA-256 comparisons of all
rows in the seven non-ledger data tables before/after confirmed no changes:
question content, serving counters, activation, attempts, vocabulary and other
learning state were preserved. Only the migration ledger gained entry 038.
Historical 025–035 ledger entries are retained as history; their numbers must
not be reused or their old expansion replayed.

The stale 738-row database copy was moved to `artifacts/archived-databases` and
clearly marked as a recovery backup. In-memory verification databases are closed
and discarded. Old Practice planning documents and graphify reports are marked
historical; AGENTS.md points future work to the authority contract.

Checks: `npm run test:learning` passed all 86 tests. `npm run verify:practice-bank` reports 754 rows, zero content differences,
zero migration replay changes, integrity ok. Practice tests cover conflict
rollback and preserving serving/activation state. Desktop/mobile Practice smoke
passed after retrying the Windows sandbox's spawn EPERM outside the sandbox;
an unrelated status-message proxy was unavailable during that mocked UI test.

For deliberate live edits: export, review the diff, publish a new unused migration
if needed, and rerun verification. Never delete live rows to make an old fixture
or old report match.
