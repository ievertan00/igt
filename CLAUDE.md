# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

IGT (Interactive Grammar Tool) is a cross-platform Node.js CLI that checks English grammar via multiple LLM backends (Gemini, Qwen, Deepseek) and turns every mistake into a learning event. Each correction auto-generates a cloze SRS flashcard. `/review` drills due cards with SM-2 spacing. `/stats` shows mastery progression across 28 error types. The goal: measurable improvement over time, not just one-off feedback.

## Running the Tool

```sh
igt                 # after npm link (any terminal, any platform)
node igt.mjs        # direct invocation
./igt.cmd           # Windows CMD/PowerShell wrapper
sh igt.sh           # macOS/Linux wrapper
```

One-off Node tools (run directly):

```sh
node tools/init-db.mjs                        # Run migrations / initialize DB (first run)
node tools/igt-handbook.mjs --days=7          # Generate personal error handbook
node tools/igt-handbook.mjs --days=7 --incremental  # Only regenerate changed rules
node tools/igt-practice.mjs --count=10        # Practice exercises
node tools/igt-assess.mjs                     # CEFR proficiency assessment
node tools/igt-add.mjs <word>                 # Vocabulary lookup + save to vault
node tools/import-review-to-db.mjs            # Import legacy Markdown logs into DB
node lib/llm-switch.mjs                       # Manage LLM providers from CLI
```

## Architecture

**Two-process design**: `igt.mjs` (Node.js main loop) spawns a persistent `lib/igt-http-server.mjs` Node.js server on port `18964` at startup. All grammar checks are HTTP POST requests to `http://127.0.0.1:18964/grammar`. This eliminates per-request Node.js startup overhead (~83% faster than cold-starting Node).

**Request flow**: `igt.mjs` → HTTP POST `/grammar` → `igt-http-server.mjs` → `LLMProviderManager` → active provider → structured JSON parsed by `lib/parse-diagnosis.mjs` → `saveToDatabase()` (non-blocking) + `buildCloze()` → `{data, perf}` JSON returned to `igt.mjs` → client renders with color.

**Structured output**: Server enforces `responseSchema` (Gemini) or `response_format: json_object` (Qwen/Deepseek) so LLM returns parseable JSON directly. No markdown round-trip. Client receives `{review, correction, refine, diagnoses[], rule, tip}` and owns all rendering.

**Migrations**: `lib/migrations.mjs` runs at server boot. Versioned files in `migrations/` (`.sql` via `db.exec()`, `.mjs` via dynamic `import()` + `up(db)`). `schema_version` table tracks applied migrations. `tools/init-db.mjs` is a thin wrapper for first-run CLI use.

**Session state**: `currentSessionId` and `lastInputAt` are held in server memory (single-user CLI; Node event loop serializes writes). Loaded once at boot from `MAX(timestamp), session_id`. New session row inserted only when gap > 30 min.

**SRS**: `lib/srs.mjs` implements SM-2 (pure functions). `lib/cloze.mjs` extracts fill-in-the-blank cards from (original, correction) pairs — substitutions only (1–3 tokens). Cards stored in `srs_cards` table. `/review/grade` endpoint: exact-match first; LLM call on fall-through. Grading updates ease, interval_days, due_date in one DB write.

**Model routing**: Flash models handle grammar correction (fast, cheap); Pro models handle handbook/practice generation (quality-critical). Both configured per-provider in `lib/igt_config.json`.

**Error classification**: All LLM-returned diagnoses are normalized to 28 canonical error types via `lib/error-types.mjs` (12 Grammar, 4 Vocabulary, 4 Mechanics, 5 Style, 3 Clarity). This MECE taxonomy drives DB storage, SRS card generation, and mastery tracking.

## Configuration

Two-file separation — never put API keys in `igt_config.json`:

- **`.env`** (not git-tracked): `GOOGLE_API_KEYS`, `DASHSCOPE_API_KEYS`, `DEEPSEEK_API_KEYS`, `IGT_LLM_PROVIDER`
- **`lib/igt_config.json`** (git-tracked): model names, paths, all LLM prompts

`lib/config-loader.mjs` merges both at startup. Environment variables override `.env` values. All three LLM prompts (`SystemPrompt`, `HandbookGrammarRulePrompt`, `PracticeExercisePrompt`) live in the `Prompts` section of `igt_config.json` — edit there, not in the `.mjs` files.

Active provider is controlled by `IGT_LLM_PROVIDER` env var (set in `.env`). Switch with `/gemini`, `/qwen`, `/deepseek` inside the REPL, or `node lib/llm-switch.mjs switch <name>` outside.

## Key Implementation Details

- **Input loop** (`igt.mjs`): uses Node.js built-in `readline` module with `terminal: true`. History navigation (Up/Down), cursor movement, and input echo are handled natively. Uses `rl.on('line', onLine)` + manual listener removal (not `rl.question()`) to avoid stale callbacks after Ctrl+C.
- **Ctrl+C handling**: a module-level `sigintHandler` variable is swapped by context — resolves the current `askLine()` Promise with `null` during input, calls `controller.abort()` during HTTP, and is a no-op otherwise. Dispatched via `rl.on('SIGINT', () => sigintHandler())`.
- **Spinner**: `lib/ui.mjs` `Spinner` class — `setInterval` writing ANSI escape codes to stdout. Single-threaded; works because the event loop is free while awaiting HTTP.
- **HTTP cancellation**: `AbortController` passed as `signal` to `http.request`. On abort, the request is destroyed and the Promise rejects with `AbortError`.
- **Port cleanup**: `killPort()` in `igt.mjs` runs `netstat -ano` (Windows) or `lsof` (Unix) to find and kill any process on port 18964 before spawning the server.
- **DB writes are non-blocking**: `saveToDatabase()` called with `setImmediate()` inside `/grammar` handler. Session state (currentSessionId, lastInputAt) is updated synchronously in memory first.
- **Output format**: `renderResponse(data)` in `igt.mjs` consumes the structured JSON object directly. Each field maps to a named color via the `SC` table. No `**Section**` regex parsing.
- **fetchJson()**: shared HTTP helper in `igt.mjs` used by `/review`, `/undo`, `/stats`, `/session/summary`, and `/today` — keeps all client↔server calls consistent.

## Folder Layout

```
igt.mjs        Cross-platform Node.js entry point (main REPL)
igt.cmd        Windows CMD/PowerShell wrapper
igt.sh         macOS/Linux wrapper
lib/           Core runtime (server, providers, SRS, cloze, mastery, config, UI)
migrations/    Versioned DB migration files (001_initial_schema.sql … *.mjs)
tools/         User-facing standalone scripts (handbook, practice, assess, vocab, db)
tests/         Test suite (48 tests, run with npm test)
docs/          Reference documentation
```

## Actions

- Save the project documents in the /docs directory.

## gstack

- Use `/browse` from gstack for all web browsing tasks — never use `mcp__claude-in-chrome__*` tools
- Available gstack skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:

- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
