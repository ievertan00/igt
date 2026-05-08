# Changelog

All notable changes to the IGT (Interactive Grammar Tool) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.6.0] - 2026-05-08

### Added

- **Status Bar Messages** — interactive CLI status bar now displays 300+ rotating "Tips", "Grammar Facts", and "Quotes" after each grammar check; stored in the database and updated via migrations
- **Database Initial Guidance** — added dedicated logic and documentation for first-time database setup and migration troubleshooting

### Changed

- **Migration System Overhaul** — squashed 9 individual migration files into 3 logical groups (`001_core_schema.sql`, `002_data_backfills.mjs`, `003_status_messages.sql`) for a cleaner project structure and faster initial setup
- **Schema/Data Separation** — strictly separated DDL (table/index creation) into `001_core_schema.sql` and DML (data insertion) into `003_status_messages.sql`
- **Ollama support** — enhanced `ollama` provider (`lib/llm-ollama.mjs`) runs any model via the OpenAI-compatible Ollama API; default model is `phi4` (Phi-4 14B); no API key required
- **Provider diagnostics** — vocabulary lookup now shows which provider and model is active and reports connection errors immediately

### Fixed

- **Double-enter after subprocess** — terminal input isolation prevents spurious newline injection after running handbook/practice generators
- **Qwen in TUN/VPN environments** — complete DNS and routing bypass for DashScope endpoints when a TUN adapter is active; forced direct TCP connection to the international API endpoint (`dashscope.aliyuncs.com`)

---

## [3.5.0] - 2026-05-04

### Added

- **SRS flashcard deck** — every grammar check auto-generates a cloze card via `lib/cloze.mjs`; substitution-only extraction (1–3 changed tokens) per SM-2 best practices
- **`/review` command** — drills all cards due today with SM-2 spacing (`lib/srs.mjs`); exact-match grading first, synchronous LLM fall-through on mismatch; progress bar and session summary
- **`/today` command** — adaptive daily plan: SRS count + cloze drill count + free-practice suggestion; targets the most frequent error type; offers to launch `/review` immediately
- **`/stats` command** — analytics dashboard with errors-by-sentence-length bar chart, CEFR trajectory, and mastery breakdown (frequent / occasional / rare / mastered)
- **`/undo [N]` command** — hard-deletes the last N inputs and cascades to diagnoses, advice, vocab, and srs_cards in one transaction; shows a preview and confirms before deleting
- **Session summary** — displayed on exit: sentences checked, errors/sentence vs 7-day average, top error type, SRS cards added, cards due tomorrow
- **Mastery tracking** (`lib/mastery.mjs`) — 30-day bucketing query; surfaced in `/assess` report and terminal output, and in `/stats`
- **Migrations runner** (`lib/migrations.mjs`) — versioned `.sql` + `.mjs` migrations in `migrations/`; `schema_version` table; runs automatically at server boot; replay-safe (restore-from-backup applies missing migrations)
- **`srs_cards` table** (migration 002) — SM-2 fields: ease, interval_days, due_date, total_reviews, correct_streak
- **Backfill migrations** — 003 assigns session_ids to all historical NULL-session inputs (grouped by 30-min gap); 004 seeds the SRS deck from existing diagnoses (224 cards from the existing 283 inputs)
- **`assessments` table** — persists each `/assess` run with the input window scored against (inputs_window_start/end/count) for reproducibility
- **`lib/parse-diagnosis.mjs`** — extracted from server; testable; exported `GRAMMAR_RESPONSE_SCHEMA` constant
- **`lib/srs.mjs`** — pure SM-2 functions; `grade(card, quality)` returns next ease, interval, dueDate
- **`lib/cloze.mjs`** — `buildCloze(original, correction)` returns `{prompt, answer}` or null
- **`lib/mastery.mjs`** — `getMastery(db)` and `bucketLabel(count)` exports
- **`renderBarChart()`** in `lib/ui.mjs` — ASCII bar chart with `maxWidth` cap and configurable color
- **48 tests across 9 files** via `npm test` (node --test)
- **`/review/due`**, **`/review/grade`**, **`/undo`**, **`/stats`**, **`/session/summary`**, **`/inputs/last`** server endpoints

### Changed

- **Structured JSON output** — server enforces `responseSchema` (Gemini) or `response_format: json_object` (Qwen/Deepseek); returns `{data, perf}` instead of `{content, perf}`; client renders structured fields directly — no markdown round-trip
- **`parseDiagnosis()`** collapsed from ~90-line 4-fallback chain to ~30 lines: single `JSON.parse`, WARNING log + raw dump on failure
- **Session write** — in-memory `currentSessionId` + `lastInputAt` (A3b); DB queried once at boot; new session row only on >30-min gap; `sessions.total_inputs` kept fresh per write
- **`tools/init-db.mjs`** — now a thin wrapper around `runMigrations()`; all `CREATE TABLE` statements moved to `migrations/001_initial_schema.sql`
- **Config consolidation** — hand-rolled `loadEnv()`/`loadConfig()` removed from `igt.mjs`; unified on `configLoader.load()`
- **Key exhaustion error** — "All N keys exhausted. Last error: …" message (previously silent last-error throw)
- **`/assess`** — now writes an `assessments` row and shows mastery bucketing in the terminal summary
- **`lib/ui.mjs`** — `renderBarChart()` added; `maxWidth` option limits bar chart to 72 chars to avoid full-terminal fills

### Removed

- **`igt.ps1`** — deleted (superseded by `igt.mjs` since v3.0.0)
- **`lib/igt-bridge.mjs`** — deleted (legacy standalone script, orphaned since v3.0.0)
- **`streamGeminiResponse()`** — streaming endpoint removed; all providers use the same non-streaming JSON path
- **`/grammar/stream` endpoint** — removed
- **`formatDisplayContent()`**, **`extractSections()`**, **`cleanString()`** — deleted (~160 lines); rendering moved to client
- **`igt_db_error.log`** untracked; `*.log` added to `.gitignore`
- **Errors by hour of day** chart removed from `/stats` (not actionable)

---

## [3.0.0] - 2026-05-02

### Added

- **Cross-platform support** — IGT now runs on Windows, macOS, and Linux without any platform-specific dependencies
- **`igt.mjs`** — new Node.js entry point replacing `igt.ps1`; uses built-in `readline` module for input handling, history navigation, and Ctrl+C interception
- **`igt.sh`** — Unix/macOS launcher
- **Global `igt` command** via `npm link` (`bin` field added to `package.json`); works in CMD, PowerShell, bash, and zsh from any directory
- **Cross-platform port cleanup** — `killPort()` uses `netstat -ano` on Windows and `lsof` on Unix/macOS to free port 18964 before server start
- **Cancellable HTTP requests** — `AbortController` + `signal` on `http.request` replaces the PowerShell background-runspace polling pattern
- **Visible server errors** — server stderr piped and shown only on startup failure

### Changed

- Entry point changed from `igt.ps1` (PowerShell) to `igt.mjs` (Node.js); all `lib/` and `tools/` files unchanged
- `igt.cmd` updated from `powershell -File igt.ps1` to `node igt.mjs`
- Ctrl+C handling reimplemented via a swappable `sigintHandler` dispatched through `rl.on('SIGINT')`: clears input during prompt, aborts HTTP during grammar check, no-op otherwise
- Spinner now uses the existing `lib/ui.mjs` `Spinner` class instead of a PowerShell background runspace

### Removed

- **PowerShell dependency** — `igt.ps1` retained for reference but no longer the active entry point

---

## [2.1.0] - 2026-04-29

### Added

- **Task-based model routing** — flash models for grammar correction; pro models for handbook and practice generation
- **Multi-LLM provider support** — switch between Google Gemini, Alibaba Qwen, and Deepseek without restarting
  - Unified provider abstraction (`lib/llm-provider.mjs`)
  - Provider implementations: `lib/llm-gemini.mjs`, `lib/llm-qwen.mjs`, `lib/llm-deepseek.mjs`
  - Automatic failover across multiple API keys per provider
- **Separated configuration architecture** — `.env` for API keys, `lib/igt_config.json` for shared settings
  - `lib/config-loader.mjs` merges both at startup
  - `.env.example` template included
- **LLM provider management CLI** (`lib/llm-switch.mjs`) — `setup`, `status`, `switch`, `list`, `current`

### Changed

- Config field naming standardized: `FlashModel`/`ProModel` → `GeminiFlashModel`/`GeminiProModel`
- All LLM integrations refactored to use the unified provider interface
- LLM prompts consolidated into `lib/igt_config.json` under `Prompts` section

### Fixed

- **Long sentence wrapping** — cursor clamping at terminal bottom row when input exceeded window height
- **UTF-8 rendering** — special characters from LLM responses misinterpreted as "â" on Windows

---

## [2.0.0] - 2026-04-12

### Added

- **Incremental handbook updates** (`--incremental`) with MD5-based cache reducing API calls by 60–80%
- **API quota management** with daily limit tracking, request delays, and progress display
- **Smart retry** with exponential backoff and automatic key switching on 429 errors
- **Cache management**: `--cache-stats`, `--clear-cache`
- **Centralized prompt configuration** in `lib/igt_config.json` with template variable support

### Changed

- Handbook callout formatting fixed for Obsidian collapsible rendering
- API key rotation includes 3 retry attempts per key before switching

### Fixed

- Grammar Rules callout content breaking out of collapsible blocks
- Pipe characters in tables breaking callout syntax
- 429 errors not triggering retry behavior

---

## [1.5.0] - 2026-04-11

### Added

- **English Learning Suite** with SQLite-based error tracking
  - Error handbook generation (`tools/igt-handbook.mjs`)
  - Interactive practice with auto-grading (`tools/igt-practice.mjs`)
  - CEFR proficiency assessment (`tools/igt-assess.mjs`)
- **SQLite integration** via `better-sqlite3` (WAL mode, indexed queries)
- **MECE error taxonomy** (`lib/error-types.mjs`) — 20 types across 5 categories

### Changed

- Project structure reorganized into `lib/`, `tools/`, `docs/`

---

## [1.0.0] - 2026-04-08

### Added

- **Core grammar checking** with three-tier feedback (Review → Correction → Refine)
- **Persistent HTTP server** achieving ~1.67s loop time (83% faster than Gemini CLI's ~9.91s)
- **Google Gemini API integration** via `@google/generative-ai` SDK
- **Multiple API key support** with automatic fallback
- **PowerShell interactive loop** (`igt.ps1`) with colored output
- **Obsidian-compatible Markdown logging**

---

## [0.1.0] - 2026-04-08

### Added

- Initial project scaffolding and concept validation

[Unreleased]: https://github.com/ievertan00/igt/compare/v3.5.0...HEAD
[3.5.0]: https://github.com/ievertan00/igt/compare/v3.0.0...v3.5.0
[3.0.0]: https://github.com/ievertan00/igt/compare/v2.1.0...v3.0.0
[2.1.0]: https://github.com/ievertan00/igt/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/ievertan00/igt/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/ievertan00/igt/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/ievertan00/igt/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/ievertan00/igt/releases/tag/v0.1.0
