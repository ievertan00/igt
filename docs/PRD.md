# IGT Product Requirements Document

**Product:** Interactive Grammar Tool (IGT) — Your English, clearer.  
**Document date:** 2026-11-10  
**Status:** Draft for product review  
**Scope:** Personal English-learning workspace, Local Web Runtime, and CLI companion  
**Baseline:** Repository version 3.7.0; source review, not a runtime certification  
**Owner / approvers:** To be assigned

## 1. Product definition

IGT helps English learners turn everyday communication into a repeatable learning routine. A learner can improve a sentence, express an idea naturally, understand an unfamiliar construction, save useful language, practise producing English, and return for spaced review. Their own writing and learning history inform what to work on next.

The primary experience is a Web application running on the learner's computer. A CLI companion supports terminal-based learning, conversation, listening, and longer text workflows. Both use the same Local Runtime and configured learning assets where supported.

IGT's promise is **clearer communication today, with a personal learning record that remains useful tomorrow**. Success requires more than producing a polished rewrite: learners must understand the feedback, retain ownership of their records, and have a practical route back to independent production.

Local storage does not mean every operation is offline. Online AI providers receive submitted content needed for their tasks. A configured local Ollama model provides an alternative. Optional speech services have their own configuration and availability.

## 2. Problem and opportunity

Learners often alternate between translators, chatbots, dictionaries, flashcards, and handwritten notes. Each solves a momentary problem, but the learning record becomes fragmented. A correction disappears into chat history; a saved word lacks meaningful examples; a high practice score can create false confidence about future use.

IGT addresses five connected problems:

1. **Expression friction:** The learner knows what they mean but cannot confidently phrase it in English.
2. **Unclear feedback:** They receive a rewrite without knowing which changes fix errors and which are optional stylistic improvements.
3. **Weak follow-through:** Useful feedback does not reliably become review or active production.
4. **Unfocused practice:** Generic exercises do not explain how they relate to observed difficulties.
5. **Untrustworthy progress signals:** Activity counts, assisted answers, and isolated successes are presented as if they prove mastery.

The opportunity is a connected personal workspace in which immediate assistance produces reusable evidence and a manageable next step.

## 3. Users and jobs to be done

The following segments are working product hypotheses inferred from the bilingual workflows and existing product. They require user validation; they are not research findings.

| Segment | Situation | Core job | Desired outcome |
| --- | --- | --- | --- |
| Chinese-speaking professional | Writing messages, updates, requests, or work emails | “Help me say this clearly and explain what I can reuse.” | Appropriate English without losing intended meaning |
| Independent adult learner | Studying in short sessions around daily life | “Give me useful practice and help me remember it later.” | A sustainable routine with visible evidence |
| Reflective learner | Repeating similar errors despite consuming content | “Show me my recurring patterns and what to try next.” | Specific priorities grounded in personal examples |
| Terminal-oriented learner | Working primarily in a command-line environment | “Let me learn without leaving my workflow.” | Fast commands with persistent records |

Initial focus is Chinese–English learning for everyday and workplace communication. No CEFR level is assumed or certified. Product language should support learners who need Chinese explanations alongside English examples.

## 4. Goals, exclusions, and principles

### Goals

- Make the first useful feedback session achievable with a configured provider and a local installation.
- Help learners distinguish correctness, naturalness, meaning, and register.
- Connect lookup, feedback, practice, review, and reflection through consistent records.
- Preserve readable learning assets and review scheduling across restarts and updates.
- Recommend next actions proportional to available evidence.
- Keep Web and CLI meanings consistent while allowing different interaction models.

### Outside this release scope

- Hosted accounts, subscriptions, cloud synchronization, or shared learning profiles.
- Teacher administration, classrooms, leaderboards, or social feeds.
- Accredited assessment, CEFR certification, or guaranteed learning outcomes.
- Speech recognition, pronunciation scoring, or automatic evaluation of spoken fluency.
- A general-purpose multilingual course platform or exam preparation curriculum.
- Replacing the existing interface with a new visual identity.
- Expanding legacy Practice modes into the primary product surface.

### Product principles

1. **Preserve intent.** Improved English must not silently change the learner's meaning.
2. **Explain the distinction.** An optional rewrite is not evidence that the original was wrong.
3. **Make records durable.** A generated response and a saved record are separate states.
4. **Respect evidence limits.** Hint-assisted success, self-rated recall, and independent production carry different information.
5. **Keep the next step manageable.** Prioritize a short useful activity over an overwhelming plan.
6. **Make ownership understandable.** Explain what stays local and what is sent to a configured service.

## 5. Baseline and requirement status

This PRD combines a description of the present product with normative requirements for a proposed consolidation release. “Present” means a corresponding implementation was found during source review; it does not mean every acceptance criterion has been verified.

| Capability | Source-observed baseline | Release intent |
| --- | --- | --- |
| Grammar | Web analysis and explicit save to review log; CLI feedback | Clear distinction between analysis, optional refinement, and persistence |
| Express | Web translation workspace; Chinese-to-English and English-to-Chinese API directions | Natural expression with language notes and preserved meaning |
| Vocabulary | Structured lookup, explicit save, Markdown records, SQLite cards | Dependable content synchronization with scheduling preserved |
| Review | Web vocabulary due-card sessions and four recall ratings; additional CLI review paths | Accurate due counts, reliable grading, recoverable sessions |
| Practice | Seeded Chinese-to-English sentence questions, filters, hints, AI evaluation, attempts | Equivalent-answer acceptance and transparent evidence collection |
| Ask | Contextual consultation and save flow with local reference support | Useful explanations with honest source attribution |
| Handbook | Personal error profile and report workflows | Readable patterns and examples with explicit analysis window |
| Coach | Evidence analysis, cached results, recommendations and CLI plan workflows | Priorities and actions with limitations and evidence provenance |
| Overview | Activity, focus, and learning asset visibility | A useful orientation surface; discoverability to be decided |
| Model settings | Provider, credentials, model and endpoint configuration | Clear active-provider state and safe secret handling |
| Conversation / listening / text | CLI workflows; no equivalent dedicated Web pages found | Preserve CLI support; Web parity is deferred |

Priority definitions: **P0** blocks a dependable core release; **P1** improves the connected learning experience; **P2** is deferred discovery or expansion. These are proposed priorities, not commitments or estimates.

## 6. Core learner journeys

### Journey A: Improve a real message

1. Open Grammar and enter a sentence or paragraph.
2. Submit for analysis and see a visible pending state.
3. Read the assessment, correction, optional natural rewrite, and explanations.
4. Save the reviewed version to the learning record.
5. Later find the example in reflection or learning history.

**Success:** The learner can identify what needed correction and can confirm whether the record was saved. A failed save does not remove usable feedback.

### Journey B: Learn an expression and recall it later

1. Look up a word or phrase.
2. Read meaning, pronunciation notation, collocations, usage notes, and examples.
3. Choose to save it; receive an existing-entry message if appropriate.
4. Return to Review, reveal the answer, and rate recall.
5. Resume the session after refresh without counting an uncommitted rating.

**Success:** The Markdown entry and review card represent the same content, and synchronization preserves prior scheduling.

### Journey C: Practise production

1. Choose a small sentence session and optional difficulty, style, and context.
2. Read a Chinese prompt and produce an English answer.
3. Reveal progressive hints only as needed.
4. Receive evaluation that accepts valid alternative wording.
5. Review the reference and explanation, then continue.
6. Find the attempt and hint usage in the learning record.

**Success:** The learner understands both whether the answer communicated correctly and whether it exercised the intended learning target.

### Journey D: Understand a recurring difficulty

1. Review Handbook examples or ask a specific language question.
2. Use follow-up questions to resolve uncertainty.
3. Save a consultation when it is useful.
4. Open Coach to see evidence-backed priorities and a recommended activity.
5. Produce new language and return after a delay for additional observation.

**Success:** Recommendations trace to actual evidence and do not label a correction or completed task as durable mastery.

## 7. Functional requirements

### 7.1 Setup and runtime — P0

**SET-01.** A learner must be able to install dependencies, configure storage and an AI provider, initialize the database, and launch the Web application without starting the CLI REPL.

**SET-02.** Web and CLI must resolve the intended data files consistently, including explicit path overrides and configured data or vault directories. Secrets, local paths, ports, and provider choices belong in private environment configuration.

**SET-03.** Missing credentials, an unavailable local model, inaccessible storage, and a missing runtime must produce actionable messages. Reading already available learning records should not require a successful AI request.

**Acceptance:** Starting either supported entry point uses the configured assets; an invalid configuration identifies the corrective action without exposing credentials. No setup recovery instruction requires deleting a learner's database.

### 7.2 Grammar feedback — P0

**GRA-01.** Accept non-empty English sentences and paragraphs. Reject empty input without a model request. Preserve submitted text as the source for its result and save action, even if the editor subsequently changes.

**GRA-02.** Present the overall assessment, corrected version, optional natural phrasing, and available diagnoses. Explain genuine issues individually when multiple errors exist.

**GRA-03.** Correct input must be allowed to remain correct. Optional improvements in tone or naturalness must be identified as optional rather than fabricated errors.

**GRA-04.** In the Web workflow, analysis and explicit saving must remain separate. Show confirmed success only after persistence succeeds, and provide a retry when it fails. Preserve established CLI save behavior while making it understandable.

**Acceptance:** A correct sentence is not marked wrong solely because a refinement differs. A save uses the analyzed input, not later editor content. A storage failure leaves the feedback visible and does not claim success.

### 7.3 Express — P0

**EXP-01.** Support Chinese-to-English and English-to-Chinese directions with an explicit direction choice in Web.

**EXP-02.** Prioritize intended meaning and natural expression; provide available nuance and usage notes. Distinguish ambiguity from a confident interpretation.

**EXP-03.** Keep source and result recognizable, with a straightforward way to copy useful output. Do not imply that translation itself demonstrates independent production.

**Acceptance:** Each direction returns the expected target language; work requests and everyday expressions retain their essential intent. Unsupported or missing directions return an actionable validation error.

### 7.4 Vocabulary — P0

**VOC-01.** Support words and multiword expressions. Return canonical form, part of speech, pronunciation notation, English and Chinese meanings, synonyms, collocations, distinct examples, and a concise usage note when available.

**VOC-02.** Lookup must not silently enroll every query into review. Saving is a distinct learner action with saved, existing, and failed states.

**VOC-03.** Vocabulary Markdown is the content authority. Runtime startup must synchronize its supported content into rebuildable SQLite vocabulary cards without overwriting review scheduling state.

**VOC-04.** Ambiguous duplicate Markdown entries must not silently overwrite one another. Destructive deletion behavior requires a separate product decision.

**Acceptance:** A saved expression appears in readable Markdown and in review. Editing its definition in Markdown updates card content after synchronization while preserving review counters, intervals, ease, and due date.

### 7.5 Spaced review — P0

**REV-01.** The Web Review workspace must offer due vocabulary cards with answer reveal and Again, Hard, Good, and Easy ratings. Additional CLI review interactions may retain their existing model.

**REV-02.** Explain ratings as learner-reported recall, not objective proof of mastery. Scheduling must use the established SRS rules consistently.

**REV-03.** Advance session progress only after the server confirms the rating. Failed requests leave the current card retryable. Prevent duplicate submission while a rating is pending.

**REV-04.** Preserve supported same-day session progress through refresh. Reconcile a new learning day and changed due-card availability without stale completion claims.

**Acceptance:** A failed grade does not remove the card or increment displayed completion. A completed session shows a useful summary. No due cards produces a valid empty state rather than an error.

### 7.6 Sentence Practice — P0

**PRA-01.** The primary Practice workflow is Chinese-to-English sentence translation from the actual configured question bank. Session size supports 1–10 questions; the learner can filter by easy, standard, or challenge difficulty, style, and supported context.

**PRA-02.** Learner-facing contexts include home routines, restaurants and cafés, shopping, entertainment, social situations, health and pharmacy, work and study, transit, travel and accommodation, and appointments and services. Preserve compatibility with other supported stored contexts.

**PRA-03.** Offer up to three progressive hint levels where available and record the number used. Missing hints must not break a question.

**PRA-04.** Evaluate the answer against the authoritative question identified by its stable ID. Do not trust edited client-supplied references or metadata.

**PRA-05.** Accept semantically correct alternatives. Learning targets guide practice; they are not mandatory wording constraints. Explain target use separately from correctness when relevant.

**PRA-06.** Persist prompt, answer, reference, evaluation, question identity, filters, hint usage, and timing or timestamp information available in the attempt record. Preserve the learner-readable Practice log and clearly distinguish its save status from evaluation success.

**PRA-07.** An empty or undersized filtered set must explain availability. Do not silently change the selected filters, invent replacement questions, or present an old seed as the live bank.

**Acceptance:** Equivalent wording can be accepted without matching the reference construction. A nonexistent question ID is rejected. A Markdown failure after successful attempt storage is reported as a partial save, not a failed evaluation.

### 7.7 Ask — P0

**ASK-01.** Support a language question and contextual follow-ups within a thread.

**ASK-02.** Use configured local reference material when available. Attribute source-backed claims only to material actually retrieved; distinguish explanation from retrieved evidence. Missing references must not produce invented citations.

**ASK-03.** Let the learner explicitly save a useful consultation as readable Markdown. Preserve context in the saved summary while avoiding claims that the full transcript was saved if it was compacted.

**Acceptance:** A follow-up can refer to a previous example. Saving confirms the actual outcome. An unavailable reference source is communicated honestly without fabricating a source.

### 7.8 Handbook and Coach — P1, with P0 evidence safeguards

**REF-01.** Handbook must summarize personal error patterns with supporting examples and a stated analysis window. Available filtering should preserve the selected error category.

**REF-02.** Coach must show sample size, time window, priority rationale, suggested activity, and material limitations. Mechanism explanations are hypotheses unless supported by evidence.

**REF-03.** Distinguish no practice, practice without later observation, recurrence after practice, and no recurrence observed after follow-up. No observed recurrence alone is not proof of mastery.

**REF-04.** Empty or sparse history must produce an insufficient-evidence state and a reasonable way to collect more evidence. Do not manufacture a weakness to fill the page.

**REF-05.** Cached analysis must correspond to its source evidence and window. A refresh action must not create uncontrolled repeated AI requests.

**Acceptance:** One corrected sentence or one successful answer cannot produce a durable-mastery claim. A recommendation identifies the observations behind it. Task completion remains distinct from demonstrated learning.

### 7.9 Overview and continuity — P1

**OVR-01.** Present recent activity, available learning assets, review workload, and a useful next action where the current product supports them.

**OVR-02.** Use explicit time windows and consistent learning-day boundaries for daily counts. Vocabulary-only activity must remain visible as learning activity.

**OVR-03.** Preserve enough context when moving between feedback, explanation, and practice that the learner understands why the next action was suggested. New automatic cross-workspace handoffs require implementation validation; they are not assumed present.

**Acceptance:** Empty history explains how to begin. Missing optional files are described as unavailable assets without implying learning data was deleted.

### 7.10 CLI companion and speech — P0 compatibility, P1 refinement

**CLI-01.** Preserve public workflows for `/word`, `/practice`, `/text`, `/ask`, `/translate`, `/chat`, `/coach`, `/handbook`, `/stats`, and settings/help/exit commands. Keep dispatch, help, and command metadata aligned when the public surface changes.

**CLI-02.** Preserve supported compatibility commands without advertising them as new primary product areas. Sentence Practice remains the principal production entry point and vocabulary review remains under `/word`.

**CLI-03.** Conversation feedback must focus on genuine mistakes in the learner's language while maintaining the exchange. Listening supports playback and self-practice; it must not imply recording or pronunciation assessment.

**CLI-04.** Optional speech failure must leave text workflows usable. Explain whether playback uses a configured TTS service or an available browser fallback.

**Acceptance:** Help reflects actual supported entry points. Unavailable TTS produces a recoverable notice and the learner can continue reading or writing.

### 7.11 Provider settings — P0

**MOD-01.** Support the existing Gemini, Qwen, DeepSeek, and local Ollama integrations. Let users understand which provider and models are active.

**MOD-02.** Validate settings before applying them; mask stored secrets in read responses. An empty credential field must not erase a saved key unless clearing is explicit.

**MOD-03.** Explain that online AI requires connectivity and may incur provider charges. Do not promise provider pricing, quotas, latency, or model availability as IGT guarantees.

**Acceptance:** Invalid selections return actionable errors; settings survive supported restarts; logs and ordinary settings responses do not expose full API keys.

## 8. Learning records and data ownership

| Record | Authority / role | Preservation requirement |
| --- | --- | --- |
| Vocabulary content | Vocabulary Markdown | User edits remain authoritative; supported card content can be rebuilt |
| Vocabulary scheduling | SQLite SRS state | Content sync must preserve intervals, counters, ease, and due dates |
| Practice questions | Actual configured `igt_data.db` | Never replace live content with exports, test databases, or historical copies |
| Practice export | `canonical-questions.json` | Versioned export of live content, not a competing authority |
| Practice attempts | SQLite attempts plus readable Markdown log | Preserve submitted work, evaluation context, and partial-save status |
| Grammar review record | Configured Markdown review log used by current save workflow | Preserve original input, feedback, entry identity, and timestamps |
| Consultations / reports | Configured Markdown notes and exports | Remain readable outside IGT, including Markdown editors and Obsidian |
| Credentials and machine configuration | Private environment configuration | Excluded from committed learning assets and ordinary responses |

Do not assume every learning asset has the same authority or write policy. SQLite also stores operational state and historical records; their presence does not make them replacements for authoritative Markdown content.

Practice counts and historical reports may diverge over time. This PRD deliberately specifies no fixed question count. Any content inventory must be measured against the actual configured database. Before and after Practice content changes, run `npm run verify:practice-bank`; deliberate live edits require the documented export process. Tests must use disposable databases and must not modify the actual bank. Removed historical migrations must not be recreated or replayed.

Migrations and recovery must preserve learner records and provide a recoverable path when an upgrade fails. Define and verify backup/restore instructions before describing the product as safely recoverable.

## 9. Interaction and quality requirements

These are proposed release criteria, not measured current performance.

| Area | Requirement | Validation |
| --- | --- | --- |
| Responsiveness | Show pending feedback promptly; proposed target within 200 ms of action | Browser interaction check on documented test machine |
| Local reads | Proposed p95 below 1 second for due cards and local summaries on an agreed representative dataset | Record dataset, hardware, cold/warm state, and timings |
| AI requests | Show pending, timeout, provider, and retry states; preserve input after failure | Test unavailable, rate-limited, slow, and malformed responses |
| Timeouts | Align client and runtime budgets by task; no indefinite unexplained waiting | Check long-running tasks and late responses |
| Persistence | Never show saved or completed before confirmed persistence | Inject write and grade failures |
| Accessibility | Target WCAG 2.2 AA for affected Web workflows | Keyboard, focus, labels, contrast, status announcements, and zoom checks |
| Responsive layout | Core flows remain usable at 360 px width and desktop widths | Browser review of input, results, navigation, and review controls |
| Interface continuity | Follow existing tokens and shared components; preserve learning logic | Review shared changes on affected sibling pages |
| Offline behavior | Local records remain useful without an online provider; AI depends on configured local service | Disconnect provider access and exercise local reads |
| Privacy | No new remote analytics or content collection by default | Inspect network traffic and event payloads |
| Time consistency | Daily review and activity use an explicit, consistent learning timezone | Test midnight boundaries and non-default timezone |

An end-to-end AI latency objective must be established through provider-specific measurement. Repository anecdotes are not a production service-level guarantee. The deployment scope is a personal local runtime, not an authenticated multiuser internet service.

For future UI work, consult `docs/DESIGN.md` if available and follow existing design tokens. That file was absent during this document's source review; resolving the missing design reference is a documentation task, not permission to introduce a new style.

## 10. Failure and edge-state requirements

| Situation | Expected learner experience |
| --- | --- |
| First launch with no history | Explain how to begin; show no invented priorities or progress |
| Runtime unavailable | Preserve editor content and explain how to restart or reconnect |
| Invalid provider key / quota exhausted | Name the affected provider and available corrective action without exposing secrets |
| Malformed AI output | Explain that a usable response could not be produced; offer retry without claiming evaluation success |
| Analysis succeeds, Markdown save fails | Keep result visible; show unsaved state and retry path |
| Practice attempt stored, Markdown export fails | Distinguish stored attempt from unavailable readable log |
| Duplicate vocabulary | Identify the existing entry; do not reset its review state |
| No matching Practice questions | Explain selected-filter availability and let the learner adjust filters |
| Question removed or deactivated during session | Explain unavailability and offer a new session |
| Refresh or learning-day rollover during review | Reconcile session state with authoritative due-card availability |
| Sparse or stale coaching evidence | Show limitations and identify what additional observation would help |
| TTS unavailable | Retain text and let the learner continue |

## 11. Measurement plan

No usage baseline, conversion rate, or learning-effectiveness result is asserted here. Measurement starts with local aggregates or explicitly consented research. Do not add remote telemetry by interpreting this PRD as permission.

**Proposed primary behavioral metric:** Weekly learners who complete an independent production activity and return on a later day for review or another production activity. This measures continuity, not mastery.

| Metric | Definition | Interpretation |
| --- | --- | --- |
| Activation | First successful feedback result plus one confirmed saved learning record | Learner has experienced immediate and persistent value |
| Time to first value | Time from first launch to first usable feedback; separate setup from subsequent sessions | Reveals setup and provider friction |
| Return-to-learning | Activated learners with a meaningful activity on another day within 7 days | Early routine signal; define cohort exclusions before reporting |
| Review completion | Confirmed grades divided by cards offered in a session | Usability signal; inspect workload and abandonment |
| Persistence reliability | Confirmed successful writes divided by attempted writes, by record type | Trust and data-integrity signal |
| Equivalent-answer fairness | Valid alternative answers accepted in a human-reviewed evaluation sample | Grading-quality guardrail |
| Unsupported correction rate | Correct originals incorrectly treated as errors in a reviewed sample | Grammar-quality guardrail |
| Delayed independent performance | Successful independent attempts after an agreed delay, with hint use and task context separated | Stronger learning evidence; still not certification |
| Evidence traceability | Sampled coaching claims linked to actual supporting records and stated windows | Coaching-quality guardrail |

For an initial internal pilot, evaluate a curated set of at least 50 grammar cases and 50 Practice answers, including correct originals, multiple errors, ambiguous intent, and equivalent translations. Proposed release gates: no known critical meaning reversals, no fabricated source citations, no false-save confirmations, and at least 95% acceptance of human-confirmed valid Practice alternatives in that sample. These are provisional targets; sample results must include denominators and failure examples.

Suggested local event vocabulary, if needed: feedback requested/completed/failed, record save succeeded/failed, lookup saved/existing, review started/grade confirmed/completed, practice answered, consultation saved, coach viewed/refreshed. Events should use minimal metadata and exclude raw writing, prompts, API keys, and private file paths. A reviewer must define deduplication and abandoned-request handling before deriving funnels.

## 12. Delivery sequence and release gates

### Phase 1: Dependable core loop

Scope: Setup, Grammar, Express, Vocabulary, Review, sentence Practice, Ask, provider settings, and existing CLI compatibility. Apply evidence safeguards wherever progress is shown.

Exit criteria:

- End-to-end journeys A–C pass using disposable test assets.
- Learner input and visible results survive recoverable provider and save failures.
- Vocabulary synchronization preserves scheduling.
- No tests or setup routines replace the actual Practice bank.
- Saved, unsaved, partial-save, and completed states match actual outcomes.
- Public CLI help and dispatch remain consistent.

### Phase 2: Connected reflection

Scope: Handbook, Coach, overview discoverability, and contextual next steps.

Exit criteria:

- Recommendations trace to observed records and disclose sparse evidence.
- Practice assistance and independent production remain distinguishable.
- Analysis refresh and caching reflect the selected evidence window.
- A learner can understand and start the recommended next activity in moderated testing.

### Phase 3: Pilot and refinement

Scope: Observe setup, comprehension, short-session use, and return behavior with consenting target learners. Determine whether friction comes from installation, provider quality, navigation, workload, or explanation clarity before expanding features.

No delivery dates are committed. Ownership, capacity, and verified gaps must be established before estimation. Cloud sync, speech assessment, additional primary Practice modes, and full Web/CLI parity remain separate decisions.

## 13. Acceptance and verification strategy

Source review is the baseline for this document. Implementation releases must select checks appropriate to the changed areas rather than treat this list as proof already obtained.

| Area | Existing verification entry points |
| --- | --- |
| Learning behavior and evidence | `npm run test:learning`; focused `node --test tests/<file>.test.mjs` |
| Web typing and production bundle | `npm run web:typecheck`; `npm run web:build` |
| Local Runtime and startup | `npm run test:runtime`; `npm run test:web-dev`; `npm run test:static` |
| Web journeys and contracts | `npm run test:web`; `npm run test:contracts`; `npm run test:ask-contract` |
| Learning records | `npm run test:vocabulary-sync`; `npm run test:review-log-contract`; `npm run test:practice-log` |
| Practice | `npm run test:practice-web`; `npm run verify:practice-bank`; focused Practice tests |
| Configuration and recovery | `npm run test:config-paths`; `npm run test:migration-backup` |
| Coach and resources | `npm run test:coach-cache`; `npm run verify-learning-resources` |

Also perform browser checks of affected journeys, keyboard interactions, narrow layouts, and persistence failure states. Use a human-reviewed language sample for semantic quality: automated contract tests cannot establish correctness of all AI feedback.

## 14. Risks and mitigations

| Risk | Product consequence | Mitigation |
| --- | --- | --- |
| Model changes or inconsistent grading | Learners lose trust in corrections | Maintain reviewed examples, test alternatives, separate style from correctness |
| Fragmented storage semantics | Saved material or schedules appear lost | Document authority per record and verify partial failures and restore paths |
| Local-first language overstates privacy | Learners misunderstand online-provider transmission | Explain storage and processing boundaries in setup and settings |
| Installation and provider setup friction | Learners abandon before useful feedback | Test first-run setup separately from normal sessions and prioritize actionable errors |
| Review workload becomes excessive | Learners stop returning | Favor bounded sessions and honest due counts; avoid punitive completion language |
| Activity metrics resemble mastery scores | Misleading confidence | Separate engagement, recall ratings, assisted practice, and delayed independent evidence |
| Historical Practice reports drive decisions | Live content is overwritten or misrepresented | Verify actual database; treat exports and archives according to their documented roles |
| Web and CLI diverge | Records and expectations become inconsistent | Preserve shared semantics and verify each affected entry point |

## 15. Decisions requiring product review

| Decision | Proposed direction | Needed evidence / owner |
| --- | --- | --- |
| Primary starting workspace | Keep Grammar as current default; validate overview discoverability | Product owner and first-session observation |
| Supported learner range | Focus on adult Chinese-speaking learners; avoid unvalidated level labels | Interviews and representative task testing |
| Grammar retention policy by surface | Preserve Web explicit save; document CLI behavior before harmonization | Workflow audit and learner preference |
| Vocabulary deletion / renaming | Preserve scheduling and avoid implicit destructive reconciliation | Data lifecycle design and migration review |
| Learning-day timezone | Use a consistent configured timezone across Web and runtime | Cross-surface boundary tests |
| Content sizing and language limits | Set explicit limits after testing representative short and long inputs | Provider cost, latency, and usability measurements |
| Delayed retest interval | Define by learning goal and evidence needs rather than a universal mastery threshold | Learning-design review |
| Analytics | Start local; require explicit consent for external research collection | Privacy and product review |
| Distribution | Keep local installation baseline; investigate packaging only if setup is a major barrier | Pilot setup completion and support burden |
| Release ownership and schedule | Assign owners and estimate verified gaps after PRD review | Maintainer / product owner |

## 16. Repository references

- [Product overview and setup](../README.md)
- [Project conventions and data safeguards](../AGENTS.md)
- [Web workspaces and interactions](../apps/web/src/App.tsx)
- [Web client capabilities and request behavior](../apps/web/src/api/client.ts)
- [Web review session behavior](../apps/web/src/review-session.ts)
- [Public CLI metadata](../lib/cli/commands/registry.mjs), [help](../lib/cli/commands/help.mjs), and [dispatch](../lib/cli/commands/dispatch.mjs)
- [Grammar analysis and save behavior](../lib/application/grammar.mjs)
- [Vocabulary saving](../lib/application/word.mjs) and [content synchronization](../lib/application/vocabulary.mjs)
- [SRS scheduling and recall ratings](../lib/domain/srs.mjs)
- [Practice storage authority and conventions](../lib/features/practice/SCHEMA.md)
- [Practice selection and evaluation](../lib/server/routes/practice.mjs)
- [Coaching evidence states](../lib/features/learning-diagnosis/coach.mjs) and [analysis caching](../lib/application/coach.mjs)
- [Private configuration template](../.env.example)
- [Available verification commands](../package.json)

If older documentation conflicts with current source, verify the active implementation. If Practice documentation conflicts with the actual configured database, the database remains the content authority.
