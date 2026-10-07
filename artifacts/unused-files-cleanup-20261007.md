# Unused frontend and backend source cleanup

Date: 2026-10-07

## Removed source files

| File | Evidence |
| --- | --- |
| `apps/web/src/styles.css` | `main.tsx` imports only `visual-system.css`; no current build or runtime imports the legacy stylesheet. |
| `lib/features/practice/additional-challenge-seeds.mjs` | Its two exported compatibility arrays have no callers in current runtime, tools, scripts, tests, or migrations. Canonical data and historical ID groups remain intact. |
| `lib/features/quiz/word-context.mjs` | No import or call sites for `getWordQuizCards`; current CLI and HTTP registration have no Word Quiz entrypoint. |
| `lib/features/quiz/word-prompts.mjs` | No callers for its schemas, prompts, or parser. |
| `lib/features/quiz/context.mjs` | Referenced only by the obsolete `quiz-context.test.mjs`; no current runtime caller. |
| `lib/features/quiz/history.mjs` | Referenced only by a legacy duplicate-question unit case; current bank Practice uses its own question selection and attempt persistence. |
| `lib/features/quiz/practice-prompts.mjs` | Referenced only by the obsolete `practice-contexts.test.mjs`; current Practice generation selects from the seeded sentence bank. |

## Associated cleanup

- Removed `tests/quiz-context.test.mjs` and `tests/practice-contexts.test.mjs`, which tested removed runtime paths exclusively.
- Removed the obsolete history-module import and its duplicate-question unit case from `tests/translation-route.test.mjs`; translation, structured output, parser and feedback cases remain.
- Updated the active stylesheet header and both local design references to identify `visual-system.css` as the current stylesheet.
- Annotated the old Word Quiz integration plan with current route/module status.
- Preserved other uncommitted changes.

Exact recovery copies, including the original mixed test file and the dirty legacy stylesheet, are in `artifacts/unused-files-backup-20261007/`. Copied files were hash-checked before deletion.

## Audit method and limits

Scanned current imports and re-exports, literal dynamic imports and require calls, and stylesheet imports. Traversal roots included the CLI, Local Runtime, React/Vite entrypoints, migrations, standalone scripts and tools. Cross-checked orphan files and exported symbol names against current source, all tests, tools, scripts, migrations and local documentation. Explicitly checked directory-driven migration loading and TypeScript configuration.

Graphify's installed launcher failed with `uv trampoline failed to canonicalize script path`; the old graph was not used as deletion evidence. Current source inspection supplied the evidence.

After removal, the remaining import-graph candidates under `apps/` and `lib/` are `apps/web/index.html` (Vite root entry) and `apps/web/src/vite-env.d.ts` (TypeScript include). Both are required and retained. Standalone maintenance commands and historical demo/reference material were retained; lack of an import alone does not make these entrypoints unused. This is a source-file cleanup, not an unused-export or database-schema rewrite.

## Validation

- Web build: passed; generated asset hashes unchanged by this cleanup.
- Web typecheck: passed.
- Static-serving smoke: passed.
- Practice-bank verification before and after cleanup: 1,005 questions, content differences 0, migration replay changes 0, integrity ok, live writes 0.
- Learning suite baseline with the initial deleted files restored: 88/97 passed, 9 failed.
- Learning suite after all source/test cleanup: 87/96 passed, 9 failed. The one fewer test is the removed obsolete history-module unit case. Failure names are identical to baseline (difference count 0).
- The existing failures concern Practice context/fixture compatibility in the current dirty checkout; this cleanup added no failures. Full learning-suite green status is not claimed.
- Logs: `unused-cleanup-baseline-tests.log`, `unused-cleanup-final-tests.log`.
- Whitespace/diff checks: passed.
