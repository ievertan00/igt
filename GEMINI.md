# GEMINI.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

IGT (Interactive Grammar Tool) is a Windows PowerShell CLI that provides real-time English grammar checking via multiple LLM backends (Gemini, Qwen, Deepseek). It automatically logs errors to a local SQLite database and offers personalized learning tools (handbook, practice exercises, CEFR assessment).

## Running the Tool

```powershell
./igt.ps1           # Start interactive grammar checker
./igt.cmd           # Wrapper to launch from cmd.exe
```

One-off Node tools (run directly, not through igt.ps1):

```bash
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

**Two-process design**: `igt.ps1` (PowerShell main loop) spawns a persistent `lib/igt-http-server.mjs` Node.js server on port `18964` at startup. All grammar checks are HTTP POST requests to `http://127.0.0.1:18964/grammar`. This eliminates per-request Node.js startup overhead (~83% faster than cold-starting Node).

**Request flow**: `igt.ps1` → HTTP POST `/grammar` → `igt-http-server.mjs` → `llm-init.mjs` → `LLMProviderManager` → active provider (`llm-gemini.mjs` / `llm-qwen.mjs` / `llm-deepseek.mjs`) → response parsed + saved to SQLite (`igt_data.db`) → JSON returned to PowerShell.

**Model routing**: Flash models handle grammar correction (fast, cheap); Pro models handle handbook/practice generation (quality-critical). Both configured per-provider in `lib/igt_config.json`.

**Error classification**: All LLM-returned diagnoses are normalized to 20 canonical error types via `lib/error-types.mjs`. This MECE taxonomy drives all DB storage and analytics.

## Configuration

Two-file separation — never put API keys in `igt_config.json`:

- **`.env`** (not git-tracked): `GOOGLE_API_KEYS`, `DASHSCOPE_API_KEYS`, `DEEPSEEK_API_KEYS`, `IGT_LLM_PROVIDER`
- **`lib/igt_config.json`** (git-tracked): model names, paths, all LLM prompts

`lib/config-loader.mjs` merges both at startup. Environment variables override `.env` values. All three LLM prompts (`SystemPrompt`, `HandbookGrammarRulePrompt`, `PracticeExercisePrompt`) live in the `Prompts` section of `igt_config.json` — edit there, not in the `.mjs` files.

Active provider is controlled by `IGT_LLM_PROVIDER` env var (set in `.env`). Switch with `/gemini`, `/qwen`, `/deepseek` inside the REPL, or `node lib/llm-switch.mjs switch <name>` outside.

## Key Implementation Details

- **PowerShell input loop** (`Read-LineWithHistory` in `igt.ps1`): uses raw `[System.Console]::ReadKey` with `TreatControlCAsInput = $true` so Ctrl+C is intercepted without cmd.exe "Terminate batch job?" prompt.
- **Spinner**: runs in a separate PowerShell runspace (`[runspacefactory]::CreateRunspace`) — the main thread polls for Ctrl+C while waiting for HTTP response.
- **HTTP call**: also runs in a background runspace; main thread polls `$shared.Done` every 50ms, checking for Ctrl+C to cancel.
- **DB writes are non-blocking**: `saveToDatabase()` is called without `await` inside the `/grammar` handler.
- **Output format**: `Write-ColoredResponse` in `igt.ps1` parses `**Section**:` headers from the LLM response and color-codes each section. Diagnosis lines are further colored by severity (Major=Red, Moderate=Yellow, Minor=DarkYellow).

## Folder Layout

```
lib/        Core runtime (server, providers, config, error types)
tools/      User-facing standalone scripts (handbook, practice, assess, vocab, db)
tests/      Test and profiling scripts (not run in production)
docs/       Reference documentation; docs/archive/ holds design plans and specs
```
