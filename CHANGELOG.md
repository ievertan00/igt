# Changelog

All notable changes to the IGT (Interactive Grammar Tool) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Incremental handbook updates** (`--incremental`/`-i` flag) with MD5-based cache to reduce API calls by 60-80%
- **API quota management** with daily limit tracking, request delays, and progress display
- **Smart retry mechanism** with exponential backoff and automatic API key switching on 429 errors
- **Cache management commands**: `--cache-stats`, `--clear-cache`/`-c`
- **Centralized prompt configuration** in `lib/igt_config.json` with template variable support
- **Detailed documentation**:
  - `docs/incremental-update-guide.md` - Incremental mode usage guide
  - `docs/prompt-config-guide.md` - Prompt configuration guide
  - `docs/prompt-config-summary.md` - Implementation summary
  - `docs/api-quota-management.md` - API quota management guide
  - `docs/callout-format-fix.md` - Callout formatting reference

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
- **Backward compatibility** maintained: falls back to file-based prompts if config prompts are missing

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

## [1.0.0] - 2026-04-08

### Added
- Core grammar checking with three-tier output (Review, Correction, Refine)
- SQLite-based error pattern tracking
- Obsidian-compatible Markdown logging
- Anki flashcard export (`igt-cards.mjs`)
- Error handbook generation (`igt-handbook.mjs`)
- Interactive practice mode (`igt-practice.mjs`)
- Proficiency assessment (`igt-assess.mjs`)
- High-speed Node.js bridge (~1.67s, 83% faster than Gemini CLI)
- Multiple API key support with fallback

[Unreleased]: https://github.com/ievertan00/igt/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ievertan00/igt/releases/tag/v1.0.0
