# Changelog

All notable changes to the IGT (Interactive Grammar Tool) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/ievertan00/igt/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/ievertan00/igt/compare/v2.1.0...v3.0.0
[2.1.0]: https://github.com/ievertan00/igt/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/ievertan00/igt/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/ievertan00/igt/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/ievertan00/igt/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/ievertan00/igt/releases/tag/v0.1.0
