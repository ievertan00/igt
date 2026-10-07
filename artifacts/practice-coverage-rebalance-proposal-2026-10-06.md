# Practice coverage rebalance proposal

Date: 2026-10-06  
Source: active rows in the configured `igt_data.db` after quality repairs 055–056.

## Proposed coverage floor

Use 55 questions as a minimum for each context currently below that count. At the current bank size, 55 is approximately 5% of the final bank after the proposed additions. Preserve the much larger work-study and home-routines collections; the goal is to widen access to everyday contexts rather than force equal-sized categories.

| Context | Current | Proposed minimum | Additions |
|---|---:|---:|---:|
| health-pharmacy | 24 | 55 | 31 |
| restaurants-cafes | 31 | 55 | 24 |
| cinema-entertainment | 32 | 55 | 23 |
| friends-social | 34 | 55 | 21 |
| supermarkets-shopping | 37 | 55 | 18 |
| appointments-services | 40 | 55 | 15 |
| commuting-transit | 54 | 55 | 1 |
| **Total** | **252** | **385** | **133** |

The projected bank size is 1,096. Work-study would fall from 43.7% to about 38.4% of active questions without deleting or relabeling valid questions.

## Authoring and release rules

- Author distinct communicative situations; do not fill counts by changing names or swapping vocabulary in a template.
- Balance difficulty and register within each context, while keeping the intended construction observable in the answer.
- Store sparse learning targets and progressive hints using the current ten-column schema.
- Keep new questions inactive until each prompt, reference answer, context, difficulty, target and hint has a recorded review.
- Publish through a new guarded migration, preserve existing IDs and usage, then export the live bank.

## Draft waves staged for review

Migrations 057–059 add 42 draft questions, six in each of the seven underrepresented contexts. They are present in the authoritative database and export with `active = 0`, `served_count = 0`, and `generated_by = codex-review-draft`; they do not change the active coverage counts. If all 42 are approved and activated, 91 additional questions would remain to reach the proposed floor. Review each prompt, answer, context, difficulty, target and hint before activation.

The current bank has 1,005 rows total: 963 active questions and 42 inactive drafts. The projected 1,096 total assumes all 133 additions are approved and activated.

All 1,005 questions now use the unified opaque ID format. The 42 coverage drafts
occupy `practice-202610-0001` through `practice-202610-0042`; the remaining
questions continue the sequence through `practice-202610-1005`. Migration 061
changed only IDs and preserved every other field. The full mapping is in
`lib/features/practice/practice-question-id-map.json`, and the verification script
enforces the format for every exported question.

## Rebuild verification

`npm run verify:practice-bank` passes: 1,005 questions, zero live/export content differences, zero migration replay changes, integrity `ok`, and no live writes. During a fresh reconstruction, migrations 041–056 are fast-forwarded only when the complete bank matches every current exported content and activation field. Usage counters are excluded and remain runtime data.
