# My Learning implementation verification

Date: 2026-10-30

## Delivered

- Overview /stats: shared recorded-activity aggregation, separate counts by activity type, timeline pagination, source-coverage disclosure, and recurring Grammar links.
- Handbook /handbook: chronological saved Grammar checks, search, mistake-type/date filters, no-diagnosed-mistakes filter, saved feedback, and direct evidence-record links.
- Coach /coach: Grammar-only recurring patterns; explanations requested on opening a pattern, with tentative causes, grammar principles, qualifications and saved examples. Validated evidence IDs, evidence-version checks, bounded generation timeout, request merging and content-sensitive cache.
- Old Handbook report-generation flags and Coach plan/task options replaced; /plan removed; /today no longer recreates plans. Stored records, reports, plans, question content and SRS scheduling are preserved.
- English and Chinese README command descriptions updated.

## Checks

- Focused regression run: 48 tests passed, covering new behavior plus learning workflows, saved Ask behavior and vocabulary ratings.
- npm run test:my-learning: 18 passed.
- npm run test:handbook: 34 passed.
- npm run test:coach-cache passed.
- npm run test:review-log-contract passed.
- npm run test:static passed.
- Web typecheck and production build passed.
- Browser acceptance passed for Coach, Overview and Handbook using fixture HTTP services and mocked model responses. Covered on-demand generation, cache reuse, retry, unsupported/stale evidence, selection changes during generation, saved-record links, filters, pagination, back navigation, 320/390/768/1440px layouts and 200% text. Handbook also checked reduced-motion settings.
- Practice-bank verification: 1005 questions, zero content differences, zero migration replay changes, integrity OK, zero live writes.
- Read-only live Overview aggregation: all configured sources were available; 706 dated events at the time of inspection. Counts change with ongoing use. Ten historical writing records had unclassified origins; those remain available to Overview but excluded from Grammar-only Handbook/Coach.

## Limits

- The broader learning suite returned 87 passes and 9 failures in unchanged Practice tests involving historical context labels and migration expectations. See ../my-learning-suite-results.log. Those tests and the question bank were not changed to force a passing result.
- Model generation was verified with deterministic substitutes; a live provider request was not made.
- The optional design engine was unavailable. Local design guidance and browser inspection were used.
- A browser rerun was temporarily blocked by the approval-review service's usage limit; after the user asked to continue, the same approval path succeeded and the browser checks passed.
- Existing user changes to AGENTS.md, DESIGN.md, review-session.ts and unrelated shared styles were preserved. No commit or push was made.

Restart an already-running Local Web Runtime to load the changed API handlers.
