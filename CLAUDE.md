# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

IGT (Interactive Grammar Tool) is a cross-platform Node.js CLI that provides real-time English grammar checking via multiple LLM backends (Gemini, Qwen, Deepseek). It automatically logs errors to a local SQLite database and offers personalized learning tools (handbook, practice exercises, CEFR assessment).

## Running the Tool

```sh
igt                 # after npm link (any terminal, any platform)
node igt.mjs        # direct invocation
./igt.cmd           # Windows CMD/PowerShell wrapper
sh igt.sh           # macOS/Linux wrapper
```

One-off Node tools (run directly):

```sh
node tools/init-db.mjs                        # Initialize SQLite DB (first run)
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

**Request flow**: `igt.mjs` → HTTP POST `/grammar` → `igt-http-server.mjs` → `llm-init.mjs` → `LLMProviderManager` → active provider (`llm-gemini.mjs` / `llm-qwen.mjs` / `llm-deepseek.mjs`) → response parsed + saved to SQLite (`igt_data.db`) → JSON returned to `igt.mjs`.

**Model routing**: Flash models handle grammar correction (fast, cheap); Pro models handle handbook/practice generation (quality-critical). Both configured per-provider in `lib/igt_config.json`.

**Error classification**: All LLM-returned diagnoses are normalized to 28 canonical error types via `lib/error-types.mjs` (12 Grammar, 4 Vocabulary, 4 Mechanics, 5 Style, 3 Clarity). This MECE taxonomy drives all DB storage and analytics.

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
- **DB writes are non-blocking**: `saveToDatabase()` is called without `await` inside the `/grammar` handler.
- **Output format**: `renderResponse()` in `igt.mjs` parses `**Section**` headers from the LLM response and color-codes each section using ANSI codes from `lib/ui.mjs`.

## Folder Layout

```
igt.mjs     Cross-platform Node.js entry point (main REPL)
igt.cmd     Windows CMD/PowerShell wrapper
igt.sh      macOS/Linux wrapper
lib/        Core runtime (server, providers, config, error types, UI)
tools/      User-facing standalone scripts (handbook, practice, assess, vocab, db)
tests/      Test and profiling scripts (not run in production)
docs/       Reference documentation; docs/archive/ holds design plans and specs
```

## Actions

- Save the project documents in the /docs directory.
