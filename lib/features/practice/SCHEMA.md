# Practice question storage

## Content authority and reconstruction

The actual configured project `igt_data.db` is the authority for Practice content.
`canonical-questions.json` is its versioned export; it must never override a newer
live edit. As of the 2026-10-04 reconciliation, the export and a fresh migration
rebuild both contain 754 questions with identical content, hints, metadata and
provenance. Runtime `served_count` and attempt history are intentionally not seeds.

- `npm run verify:practice-bank` reads the actual database, compares every content
  field against the export and an in-memory rebuild, and checks migration replay.
- `npm run export:practice-bank` explicitly refreshes the export from actual live
  content; review the resulting diff and add a new migration when publishing it.
- Migration 038 restores absent exported IDs and fills historical unknown
  provenance. It refuses conflicting existing text or metadata; existing counters,
  activation state, custom rows and attempts remain untouched.
- Migration 040 applies 63 ID-specific semantic context corrections reviewed on
  2026-10-04 and implemented on 2026-10-05. It verifies prompt/reference hashes
  and expected old labels before updating only `context`; 225 unresolved audit
  rows retain their labels. Replay changes zero rows. For pre-038 databases, 038
  applies this explicit delta before comparing content with the updated export.
  Other feature arrays, including the older coarse `situation`, were not edited
  by this context-only repair and must not override the primary context filter.
- Historical migration numbers 025–035 remain in the live application ledger.
  Their files are absent; do not invent replacements with those numbers or replay
  their old 1,600-question expansion. Use a new unused migration number.
- Legacy seed modules are compatibility views of the export, not authoring stores.
  The extra challenge view contains the authoritative 90 + 10 additions. The
  situation module now provides only vocabulary, with no template generator.
- In-memory test databases are disposable and closed after tests. The old 738-row
  copy is archived under `artifacts/archived-databases`; it is not another authority.

## Storage shape

Migration 036 rebuilds `practice_questions` with these columns, in order:

`id`, `prompt_zh`, `reference_answer`, `difficulty`, `context`,
`practice_fields_json`, `hint_json`, `generated_by`, `served_count`, `active`.

## Question ID convention

Every current question ID uses the opaque format `practice-YYYYMM-NNNN`, for
example `practice-202610-0001`. `YYYYMM` is the ID batch month and `NNNN` is a
four-digit sequence unique within that batch. Do not encode context, grammar,
difficulty, provenance, or wording in an ID; those properties can change while
the identity stays stable. Reserve the next unused sequence in the batch and
reject duplicates.

Migration 061 assigned this format to all 1,005 current rows. It preserves every
other field, including `served_count` and `active`. The complete old-to-new mapping
is stored in `practice-question-id-map.json`; it also lets historical seed groups
and compatibility views resolve their original IDs. Migrations 001–060 retain
old IDs as historical input and are not rewritten. New migrations must use the
standard format directly.

`practice_fields_json` is a sparse JSON object describing intended learning targets.
Each dimension holds an array of strings so one sentence can practise several
clause types, tenses, or constructions. Omit unknown or irrelevant dimensions;
an empty object is valid. These are learning opportunities, not mandatory wording
requirements for evaluating an equivalent translation.

Supported conventions include `sentence_structure`, `clause_type`,
`conjunction_type`, `tense_aspect`, `voice`, `mood`, `non_finite`, and
`grammar_point`. Additional dimensions are allowed, including the existing
`purpose`, `meaning_relationship`, `register`, `tone`, `situation`, and `genre`.

Example for “If I had known, I would have helped”:

```json
{
  "sentence_structure": ["complex"],
  "clause_type": ["conditional"],
  "conjunction_type": ["subordinating"],
  "tense_aspect": ["past perfect", "modal perfect"],
  "mood": ["counterfactual"],
  "grammar_point": ["third conditional"],
  "register": ["neutral"]
}
```

`hint_json` retains progressive `simple`, `intermediate`, and `complete` hints;
missing hints are allowed. `generated_by` records known provenance and defaults
to `unknown`; migration does not invent an author or provider.

Migration 039 removes the retired `_legacy` property from existing rows.
All 754 authoritative questions now contain only current learning dimensions.
The decoder derives focus from `grammar_point` and category metadata from the
dimension arrays. Deleted focus IDs, variants and private compatibility notes
are not restored or copied into another content field. Historical seed grouping
uses `historical-seed-ids.json`, which contains IDs only, with no teaching content.
Existing focuses become `grammar_point` entries; migration does not guess
additional grammar annotations.

Style filtering uses the first `register` entry (`informal` maps to `casual`;
`neutral` and `formal` map directly). Without register, a row appears only when
style is `all`.

Historical migrations retain their old schema and compatibility seed format;
036 converts existing rows, 037 restores the 100 native questions, and 038 fills
the previously missing exported rows. Conversion no longer creates the retired
payload; 039 cleans databases that already contain it. Runtime startup applies pending migrations.
The schema replacement is transactional and preserves IDs, question content,
counters, activation state, and any existing `Generated_by`.
