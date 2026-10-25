# Ask save review

Date: 2026-10-25. Scope: current ClearWrite Web Ask save UI, API, Markdown writer and library reader. No production code or user notes were changed for this review.

## Verified working behavior

- `npm run test:ask-contract` passes: a normal snapshot is written to Markdown, repeated identical snapshots reuse the existing filename, and differing snapshots sharing a title preserve prior content.
- `node --test tests/ask-history.test.mjs tests/ask-render.test.mjs`: 9 tests pass. These cover history/rendering, not all save failure paths.
- The current loaded configuration has AskDir set and AskPath unset; the path-resolution issue below is conditional rather than a confirmed failure in the user's present configuration.

## Findings

1. **[P2] Network failures permanently disable saving that snapshot.** `apps/web/src/Ask.tsx:117` and `:135` both block the uncertain state, and checking/refetching notes never clears or reconciles it. The browser reproduction aborts the write before it reaches the API: the library stays empty, but saving remains disabled even after checking and refreshing it. Recovery should preserve the draft and reconcile or permit a safe retry.

2. **[P2] Save and browse use different folder-resolution rules.** `lib/application/ask.mjs:65` prioritizes AskPath; `lib/application/ask-notes.mjs:3` imports a different resolver that ignores it. With distinct AskPath and AskDir fixture folders, save returns true and creates the file, but the library returns zero notes. Use a single resolver for write, list, read, CLI and file settings.

3. **[P2] Successful saves can make the entire library unreadable.** `lib/application/ask.mjs:62` accepts a snapshot exceeding the reader's 1 MiB limit. `lib/application/ask-notes.mjs:19` then rejects the whole list rather than only the oversized document. The isolated test writes one ordinary note and one large note; the large save returns true, and listing fails with 413. The 10 MiB aggregate cap is also absent from the write path. Align write/read limits and isolate failures per document.

4. **[P2] Duplicate detection stops at the first filename gap.** `lib/features/ask/vault.mjs:63` immediately writes into a free filename without checking later suffixes. Save versions A and B of the same question, delete A, and save B again: both the base filename and `(2).md` now contain B. Search existing candidates for identical content before selecting a free name.

5. **[P2] Local Web saving unnecessarily depends on LLM initialization.** `lib/server/routes/ask.mjs:71` calls getLLMManager even when the request supplies all messages and saveAskMessages needs no model. An injected provider-initialization failure makes the real router return 500 without saving the supplied answer. Initialize the model only for the stateful CLI compaction branch.

## Reproductions

- `node artifacts/ask-save-review/probe.mjs`: isolated filesystem and actual router-handler probes. Temporary files are created under this artifact directory and removed afterward.
- `node artifacts/ask-save-review/browser-probe.mjs`: use IGT_QA_URL and PUPPETEER_EXECUTABLE_PATH environment settings for the running preview and Chrome. Ask/notes/save requests are intercepted; no user notes are written.

Observed probe results: path mismatch returns saved=true with zero visible notes; deleting an earlier filename produces two identical saved versions; an oversized save returns saved=true followed by listing status 413; failed provider initialization returns status 500; the failed browser write leaves the save action disabled before and after library refresh.

## Test limitations

The existing browser smoke substitutes `/ask/save` responses, so passing it does not establish that the real route writes to the same directory the library reads. The contract smoke tests the application writer directly and therefore does not catch the route's provider dependency. No live AI calls, real-vault writes or application database changes were performed during this review.
