# Changelog

All notable changes to the IGT (Interactive Grammar Tool) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Task-Based Model Routing** - Different models for different tasks to optimize cost and quality
  - Flash models for grammar correction (fast, cost-effective)
  - Pro models for handbook generation and practice exercises (highest quality)
  - Automatic model selection based on task type
- **Multi-LLM Provider Support** - Switch between Google Gemini, Alibaba Qwen, and Deepseek at any time
  - Unified LLM provider abstraction layer (`lib/llm-provider.mjs`)
  - Individual provider implementations: `lib/llm-gemini.mjs`, `lib/llm-qwen.mjs`, `lib/llm-deepseek.mjs`
  - Instant provider switching without restarting IGT via `llm switch <provider>`
  - Automatic failover across multiple API keys per provider
- **Separated Configuration Architecture** - Enhanced security through config separation
  - `.env` file for private data (API keys) - not tracked by git
  - `.env.example` template for safe sharing with team members
  - `lib/igt_config.json` for shared settings (paths, models, prompts)
  - Config loader module (`lib/config-loader.mjs`) for merging .env and config.json
  - Automatic migration from old monolithic config format
- **LLM Provider Management CLI**
  - Interactive setup wizard (`llm setup`) for configuring API keys
  - Provider status display (`llm status`) showing configured keys and models
  - Quick switching commands (`llm switch gemini|qwen|deepseek`)
  - Provider listing (`llm list`, `llm current`)
- **Comprehensive Documentation Suite**
  - `docs/multi-llm-support.md` - Complete multi-LLM setup and usage guide
  - `docs/config-separation.md` - Configuration architecture and security best practices
  - `QUICKSTART_LLM.md` - Quick start guide for LLM configuration
  - `MIGRATION_GUIDE.md` - Migration guide from old configuration format
- **Enhanced Security Model**
  - API keys moved from version-controlled config.json to .env
  - .env file automatically excluded from git via .gitignore
  - Safe collaboration workflow - share config.json without exposing keys
  - Support for multiple API keys per provider (comma-separated in .env)

### Changed
- **Standardized config field naming** across all providers
  - `FlashModel`/`ProModel` → `GeminiFlashModel`/`GeminiProModel` (matches Qwen/Deepseek pattern)
- **Refactored all LLM integrations** to use unified provider interface
  - `lib/igt-bridge.mjs` - Main grammar checker now uses LLM manager
  - `tools/igt-handbook.mjs` - Error handbook generator uses LLM manager
  - `tools/igt-practice.mjs` - Practice exercise generator uses LLM manager
- **Configuration structure reorganized**
  - Removed `ApiKeys`, `QwenApiKeys`, `DeepseekApiKeys` from `igt_config.json`
  - API keys now loaded from .env via config-loader
  - Added `LLMProvider` field for default provider selection
  - Per-provider model configuration (`Model`, `QwenModel`, `DeepseekModel`)
- **LLM switcher enhanced** to persist provider choice in .env file
- **README.md completely rewritten** with multi-LLM features and separated configuration guide
- **PowerShell script updated** with LLM management commands
- **Backward compatibility maintained** for old config format during transition period

### Removed
- Direct `GoogleGenerativeAI` imports from individual tool files
- Hard-coded API key storage in `igt_config.json`
- Gemini-only architecture, replaced with pluggable provider system

### Fixed
- Configuration security vulnerability - API keys no longer committed to git
- Provider switching now works without application restart
- API key management unified across all LLM providers

### Performance
- LLM provider switching: <100ms (instant, no restart required)
- Config loading: ~5ms (merged from two files)
- Zero performance impact on grammar checking - maintains <2s loop times
- All providers maintain same performance characteristics

---

## [2.0.0] - 2026-04-12

### Added
- **Incremental handbook updates** (`--incremental`/`-i` flag) with MD5-based cache to reduce API calls by 60-80%
- **API quota management** with daily limit tracking, request delays, and progress display
- **Smart retry mechanism** with exponential backoff and automatic API key switching on 429 errors
- **Cache management commands**: `--cache-stats`, `--clear-cache`/`-c`
- **Centralized prompt configuration** in `lib/igt_config.json` with template variable support (`{{errorType}}`, `{{examplesText}}`, `{{count}}`, `{{errorList}}`)

### Changed
- **Consolidated all LLM prompts** from separate `.txt` files into `lib/igt_config.json`
  - `SystemPrompt` - Main grammar checking
  - `HandbookGrammarRulePrompt` - Grammar rule generation
  - `PracticeExercisePrompt` - Practice exercise generation
- **Handbook callout formatting** fixed for proper Obsidian collapsible callout rendering
  - Standardized empty line handling (`> ` prefix)
  - Proper escaping of pipe characters in tables
  - Consistent nested callout formatting
- **API key rotation** now includes 3 retry attempts per key with exponential backoff before switching

### Removed
- `prompts/practice_prompt.txt` - Migrated to config file

### Fixed
- Grammar Rules Reference callout content breaking out of collapsible blocks
- Nested callouts in Detailed Error Analysis losing proper `> ` prefix
- Double spacing issues in callout content
- Pipe characters in markdown tables breaking callout syntax
- Rate limit 429 errors not triggering proper retry behavior

### Performance
- Reduced API calls for daily handbook generation from 10-15 to 2-5 (with incremental mode)
- Added 2-second request delays between API calls to prevent rate limiting
- MD5 hash-based cache detection for unchanged error rules

---

## [1.5.0] - 2026-04-11

### Added
- **English Learning Suite** with SQLite-based error pattern tracking
  - Error handbook generation (`tools/igt-handbook.mjs`)
  - Interactive practice mode with auto-grading (`tools/igt-practice.mjs`)
  - Proficiency assessment with CEFR level estimation (`tools/igt-assess.mjs`)
- **SQLite database integration** using `better-sqlite3`
  - Sessions, inputs, diagnoses, and advice tables
  - Indexed queries for performance
  - WAL mode for concurrent reads
- **MECE error classification system** (`lib/error-types.mjs`)
  - 22 predefined error types across 5 categories
  - Automatic error type path resolution

### Changed
- **Project structure reorganized** into logical directories:
  - `lib/` - Core libraries and utilities
  - `tools/` - Standalone tool scripts
  - `prompts/` - LLM prompt templates
  - `docs/` - Documentation files

---

## [1.0.0] - 2026-04-08

### Added
- **Core grammar checking** with three-tier feedback (Review → Correction → Refine)
- **High-speed Node.js bridge** achieving ~1.67s loop time (83.1% faster than Gemini CLI's ~9.91s)
- **Google Gemini API integration** via `@google/generative-ai` SDK
- **Multiple API key support** with automatic fallback
- **PowerShell interactive loop** (`igt.ps1`) with colored output
- **Obsidian-compatible Markdown logging** for review history
- **System prompt customization** via external `system_prompt.txt` file

### Fixed
- Multi-line output preservation in PowerShell loop
- Absolute path resolution for robust cross-platform execution
- Config file loading with fallback mechanisms

### Performance
- Implemented high-speed Node.js bridge to achieve <2s loop time
- Latency breakdown: Config loading ~3ms, API call ~1500ms, DB write ~5ms (async), Logging ~10ms

### Security
- Added `igt_config.json` to `.gitignore` to prevent accidental API key commits

---

## [0.1.0] - 2026-04-08

### Added
- Initial project scaffolding
- Basic grammar checking concept validation

[Unreleased]: https://github.com/ievertan00/igt/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/ievertan00/igt/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/ievertan00/igt/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/ievertan00/igt/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/ievertan00/igt/releases/tag/v0.1.0

