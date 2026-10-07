# Practice question quality and coverage audit

Audit date: 2026-10-05; remediation date: 2026-10-06  
Source: read-only inspection of the configured `igt_data.db` in this checkout.  
Scope status: prompt/reference pairs reviewed across all 963 rows; row findings and coverage review recorded below. Learning-field and progressive-hint review is targeted, not yet complete for every row. The concrete row findings in this report were repaired in migrations 055 and 056 and exported from the live database. Coverage imbalance is reported, not rebalanced.

## Current bank snapshot

The live database contains 963 active questions: 654 `language-*`, 100 `native-*`, 80 `fill-*`, 69 `pilot-*`, and 60 `depth-*`. This differs from the historical 754-row snapshot in `lib/features/practice/SCHEMA.md`; this audit uses the live database. Remediation updated 91 rows across migrations 055 and 056; it preserved all IDs, active flags, and served counts. The canonical export now matches the live bank.

Structural checks found no blank prompt/answer, exact duplicate Chinese prompt, invalid hint JSON, missing simple/intermediate/complete hint, or empty `practice_fields_json`/`grammar_point` among the 963 rows. Structural completeness does not establish semantic correctness.

## Coverage review

### Context

| Context | Count | Share |
|---|---:|---:|
| work-study | 420 | 43.6% |
| home-routines | 193 | 20.0% |
| travel-accommodation | 97 | 10.1% |
| commuting-transit | 55 | 5.7% |
| appointments-services | 40 | 4.2% |
| supermarkets-shopping | 37 | 3.8% |
| friends-social | 34 | 3.5% |
| cinema-entertainment | 32 | 3.3% |
| restaurants-cafes | 31 | 3.2% |
| health-pharmacy | 24 | 2.5% |

Work and study situations dominate; health/pharmacy and several everyday transactional contexts remain thin. Context labels also sometimes stretch: a sofa stock enquiry sits under `supermarkets-shopping`; a bank statement and a gym membership occur under `appointments-services`; sports and household noise examples are mixed into broad `cinema-entertainment`/`home-routines` contexts. These are taxonomy-fit questions to resolve against the intended definitions, not automatic relabels.

### Difficulty and register

| Dimension | Distribution |
|---|---|
| Difficulty | easy 166 (17.2%); standard 578 (60.0%); challenge 219 (22.7%) |
| Register | informal 167 (17.3%); neutral 518 (53.8%); formal 278 (28.9%) |

Standard is the dominant level. Challenge is concentrated in `work-study` (134 of 219); `home-routines` has 28 challenge questions, while 8 of the 10 contexts have 3–8 challenge questions. Formal register is also concentrated in `work-study` (215/278). These distributions suggest the filters are numerically filled but not evenly representative. Avoid filling cells by template alone; rebalance with distinct, context-authentic communicative situations.

### Learning-target coverage

The bank spans many targets, but frequency is uneven: the most frequent targets have 14–16 rows, while the basic `subject-verb`, `subject-verb-object`, `subject-verb-complement`, two-object, object-complement, existential-there, and dummy-it targets have six each. Several fields look mechanically inferred or overly broad; see row findings. A populated target field is not evidence that the sentence makes that target observable or that the annotation is correct.

## Row-level findings

Severity: **P1** changes meaning, teaches an incorrect construction, or makes the answer unreliable; **P2** is materially awkward, ambiguous, or misaligned; **P3** is a smaller naturalness, precision, or annotation concern. “No issue flagged” is not recorded for individual rows here; only actionable findings are listed.

| ID | Severity | Finding |
|---|---|---|
| `depth-054-023` | P1 | “This procedure requires that workers must wear…” combines `require that` subjunctive with `must`; use “requires workers to wear…” or “requires that workers wear…”. The hint itself teaches both forms as if they combine. `primary_target` is also `be-allowed-to`, unrelated to this sentence. |
| `depth-054-036` | P2 | “He never seems to put on weight” softens “怎么也吃不胖” (cannot seem to gain weight); consider “no matter how much he eats, he never gains weight.” |
| `depth-054-041` | P2 | “I'll keep my phone on” changes the source's current state (“my phone is on”) into a future promise. `primary_target: conditional-past-when` is an inaccurate label for a future time clause. |
| `depth-054-056` | P1 | “Turn the air conditioning up” commonly means increase cooling/output and can make the room colder; the Chinese explicitly asks to raise the temperature because the room is cold. Say “turn the temperature up” or “turn up the thermostat.” The hint repeats the misleading direction. |
| `fill-053-004` | P1 | “The heating system completed its annual inspection” assigns the inspection to the system. It should say the system “was inspected” or “passed its annual inspection.” |
| `fill-053-023` | P2 | The answer drops the currency unit in “thirty off when you spend two hundred,” leaving the offer underspecified. Retain yuan (or the intended currency) on both amounts. |
| `fill-053-026` | P2 | “by the end of work on Friday” is not idiomatic for 下班前; use “by the end of the workday on Friday.” |
| `fill-053-036` | P2 | “Admin says someone can't come to fix it until this afternoon” is awkward and the actor is vague. Prefer “Facilities says they can't send anyone until this afternoon.” |
| `fill-053-053` | P1 | “put together a table” means assemble furniture, not 拼桌. Use “put two tables together for you by the window.” |
| `fill-053-059` | P2 | “a queue for ticket checks” is unnatural. Prefer “a queue to have tickets checked.” |
| `fill-053-078` | P2 | A mountain is normally described as “high,” not “tall”; “doesn't look that high” is more natural. |
| `language-g01.1-c3` | P2 | The relative-clause sequence “which … and which …” is grammatical but cumbersome. Simplify the sentence about the living-room light and repair. |
| `language-g01.3-c2` | P2 | “whether it still stays stable” is redundant/awkward; use “whether it remains stable.” |
| `language-g01.4-c3` | P2 | “lock in the development schedule two weeks earlier” can mean move the schedule earlier, rather than finalize it two weeks ahead. Use “lock in the schedule two weeks in advance.” |
| `language-g01.6-c2` | P1 | “two different voices in the meeting” is a literal rendering of two viewpoints and sounds unnatural; use “two different/opposing views.” |
| `language-g02.1-c2` | P1 | `re-sampled` means taking new samples, while the Chinese says the sample batch was checked again against the latest standard. Use “re-inspected/retested.” |
| `language-g02.3-c3` | P2 | The English makes “stages” the things that slowed delivery; the Chinese asks which stage delays caused the lost delivery window. Recast around delays at particular stages. |
| `language-g02.5-c1` | P2 | “perform the actual operations” is an unnatural calque for 实际操作; use “carry out their tasks in practice” or name the work. |
| `language-g03.2-c2` | P2 | “has hung unresolved” is awkward; use “has remained unresolved.” |
| `language-g03.2-c3` | P2 | “delivery rhythm” is not idiomatic for 交付节奏; use “delivery schedule/cadence.” |
| `language-g03.8-c1` | P2 | “the demo … is being arranged for ten” conflicts with a schedule already confirmed and sounds unnatural; use “is scheduled for ten.” |
| `language-g03.9-c2` | P2 | “delay it into next year” is unidiomatic; use “push it back to next year.” |
| `language-g04.1-c2` | P1 | “finish reading this system” treats a system as a readable text. The Chinese needs to specify system documentation/manual, or the English must name the documentation. |
| `language-g04.3-c1` | P1 | “any operation … must obtain prior written consent” makes the operation obtain consent. The responsible person/operator should obtain approval, and the records should be retained. |
| `language-g04.6-1` | P2 | “get some rest early” is awkward and does not clearly express going to bed earlier; use “get to bed early.” |
| `language-g04.6-c2` | P2 | “building the deliverable part” is not idiomatic; use “build out the parts we can deliver.” |
| `language-g04.8-c1` | P2 | The either/or deduction switches between “there must be” and “someone must have changed”; recast with parallel alternatives. |
| `language-g04.8-c3` | P2 | “the gate … must be having a problem” is unnatural; say the gate “must have malfunctioned” or “must be out of service.” |
| `language-g05.4-c2` | P2 | “could have been affected less” is awkward; use “would have been less affected.” |
| `language-g05.4-c9` | P2 | “the hotel had held the wrong room for us” is unclear for assigning the wrong room; use “had given/assigned us the wrong room.” |
| `language-g05.5-c1` | P1 | “I would not be without savings or a steady income” is a double negative and does not clearly express having neither. Use “I would have neither savings nor a steady source of income.” |
| `language-g05.7-c1` | P2 | “regret not having stuck … and instead agreeing” is clumsy and breaks the parallel pattern; use “regret not sticking … and instead agreeing…” or restructure both gerunds. |
| `language-g06.1-c1` | P3 | “yet … as of now” is redundant. |
| `language-g06.2-c1` | P2 | “latest research has caused this conclusion to be overturned” is unnatural causative wording; say “the latest research has overturned this conclusion.” |
| `language-g06.3-4` | P2 | “within this week” is not idiomatic for 本周内; use “by the end of this week.” |
| `language-g06.3-c2` | P2 | “should be collectable at the service desk” is awkward; use “should be available for collection at the service desk.” |
| `language-g06.4-3` | P2 | “no data has confirmed this” is awkward; use “there are no data/results to confirm this yet.” |
| `language-g07.3-4` | P1 | The prompt only says Xiao Wang returned from studying in the US; the answer adds “is settling in well,” unsupported content. |
| `language-g07.5-c2` | P2 | A one-time future plan is rendered as present-simple procedure (“we lock”); use “we'll lock in the production schedule.” |
| `language-g07.6-c1` | P2 | “the last collaboration saw multiple delays” is a calque; use “there were several delays during our last collaboration.” |
| `language-g07.8-c3` | P1 | “the problems came out earlier instead” is unnatural and fails to express that matching test to production caused the real performance problems to surface sooner. Use “the real performance problems surfaced earlier as a result.” |
| `language-g08.4-c1` | P2 | “decision-making layer” is a calque; use “senior leadership/the decision-makers.” |
| `language-g08.5-c1` | P2 | “whether all the pages were complete” means the pages were finished; the source asks whether every page was present. Use “whether all the pages were there.” |
| `language-g09.1-4` | P2 | “There is a book and a pen” has number-agreement mismatch for a compound plural subject; remediation now uses an existential construction that avoids the compound-subject mismatch. |
| `language-g09.5-c2` | P2 | “turning … into documented form” is awkward; use “documenting every detail mentioned at the meeting.” |
| `language-g09.6-c3` | P2 | “forward the internal coordination group” sounds like forwarding a group as an object; if this means a chat group, say “forward the internal group chat/invitation.” |
| `language-g10.4-c2` | P1 | “Rather than saying X, it is Y” is an ill-formed comparison for 与其说…不如说…; use “It's less that the new version is faster and more that it is much more stable…” |
| `language-g10.4-c3` | P2 | “communication cost” is a calque; use “communication overhead.” |
| `language-g11.1-c2` | P1 | “tickets have reported the same error” gives tickets agency and reverses the intended relation. Use “over 300 support tickets mention the same error.” |
| `language-g11.5-c3` | P1 | “release … to a grey list” mistranslates 灰度名单; use a staged rollout/cohort, e.g. “roll it out to users in batches.” |
| `language-g11.6-c3` | P2 | “not so much the price … as whether the delivery date…” mismatches the comparison structure; use “The client cares less about the price than about whether the delivery date is reliable.” |
| `language-g11.6-c12` | P1 | “they should be kept away from the soil” grammatically refers to the plants, not pets. Clarify that pets should be kept away from recently fertilised soil. |
| `language-g11.6-x1` | P2 | “not very comfortable with speaking” does not clearly express 不太习惯; use “isn't used to speaking in front of a crowd.” |
| `language-g12.1-4` | P1 | The answer drops the comparison with experience and changes “more important” to “matters most.” Preserve both parts of the prompt. |
| `language-g12.3-4` | P1 | “reached a cooperation agreement” overstates 达成合作意向; use “agreed in principle to cooperate” or “reached an agreement in principle.” |
| `language-g12.5-4` | P1 | “I've been to Japan, and he hasn't either” combines an affirmative clause and negative `either` awkwardly; use “I've been to Japan, but he hasn't.” |
| `language-p02-c1` | P2 | “the current proposal framework deviates significantly from our strategic direction” is stiff/abstract; use “does not align with this year's strategic direction.” |
| `language-p03-4` | P2 | `data` appears as both plural (`these data are`) and mass singular (`the current data does`) in adjacent questions. Pick a variety/style rule and apply consistently. |
| `language-p07-c2` | P2 | “send them to you for a look” is casual and vague for review notes; use “send them for you to review.” |
| `language-v01-c2` | P2 | “budget squeezed” followed by “squeeze the cost down” repeats the same metaphor awkwardly; say costs were reduced to a third. |
| `language-v02-c2` | P2 | “finally spelled out” adds a sense of long-awaited resolution that 第一次 does not require; use “for the first time spelled out.” |
| `language-v03-1` | P2 | “borrowed my sister's bicycle from her” is redundant; use “I borrowed my sister's bicycle.” |
| `language-v04-c2` | P2 | “more than doubled in three years” is less precise than the source's comparison with three years ago; use “more than doubled since three years ago.” |
| `language-v06-3` | P2 | “heavier to lift than I expected” is awkward; “heavier than I expected” or “harder to lift than I expected” is natural. |
| `native-027-indirect-question-09` | P2 | “how much farther this trail goes before reaching the waterfall” makes the trail the actor and is awkward; use “how much farther I have to walk to reach the waterfall.” |
| `native-027-mandative-01` | P2 | A coach/training log scenario is tagged `commuting-transit`, a clear context mismatch. |
| `native-027-not-until-07` | P2 | “how important daily watering was” needlessly backshifts a general truth; use “is.” |
| `native-027-perfect-participle-04` | P2 | “I know to label the boxes first” is unnatural for knowing from experience; use “I know you should label the boxes first.” |
| `native-027-perfect-participle-07` | P3 | Uses American `neighbor` while much of the bank uses British `neighbour`; normalize spelling variety across the bank. |
| `native-027-relative-03` | P3 | Uses American `harbor` amid British `harbour`/`centre`/`travelling` conventions; normalize. |
| `native-027-ongoing-07` | P3 | Uses American `neighbors` in the same authored batch as British spellings; normalize variety. |
| `native-027-ongoing-09` | P3 | Uses American `practicing` alongside British `practise/practising` elsewhere; normalize spelling variety. |

## Annotation / teaching-design concerns

- `depth-054-023` has the wrong primary target and a hint that teaches an invalid combination (see above).
- In the inspected early `language-g01` records, several generated annotations contradict the reference sentence: e.g. `language-g01.1-2` marks a one-clause sentence as `compound`; `language-g01.2-1` labels the present-habitual `read` as past simple; `language-g01.3-3` labels an active sentence as passive; `language-g01.4-2` assigns past simple to an imperative; and `language-g01.5-3` assigns past simple to an imperative. These require row-by-row reconciliation of feature JSON and hints, not a blanket inference from reference-answer regexes.
- The same early records contain false/misaligned targets: `language-g01.1-1` has a generic learning rationale that does not explain a concrete learner outcome; `language-g01.3-3` labels a concession sentence's voice passive. These annotations can teach incorrect facts even when the answer itself is fine.
- Native-authored questions generally present a clearer observable construction and more natural scenarios than the large templated `language-g01` foundation set. However, context fit and spelling variety still need a consistent bank-wide rule.
- Hints often expose the target form in the “simple” or “intermediate” stage. Review each hint against its intended progressive scaffold and the reference answer; the structural check only confirmed that three keys exist.

## Audit method and limits

Rows were inspected in the live DB by ID for prompt/reference semantic fit across the original 963 active questions. Metadata and hints were checked for flagged examples, with aggregate structural checks across that bank. Findings above are confirmed issues, not an exhaustive row-by-row ledger of passing criteria. A final pedagogical sign-off still requires a dedicated all-row pass over every target annotation, difficulty/context/register assignment, and progressive hint. Migrations 055 and 056 were applied and the canonical export was regenerated. Migrations 057–059 added 42 inactive, review-pending coverage drafts; these are not included in the original quality audit or active coverage counts. Historical replay is compatible with the current export: migrations 041–056 are fast-forwarded only when the restored bank exactly matches every exported content and activation field; runtime counters are excluded. `npm run verify:practice-bank` passes with 1,005 rows, zero content differences, zero replay changes, integrity `ok`, and no live writes. The proposed context floor and authoring plan is recorded in `practice-coverage-rebalance-proposal-2026-10-06.md`.
