# Interactive Grammar Tool (IGT)

> A high-performance CLI grammar validator with **multi-LLM support** and a built-in **English Learning Suite** — transform every grammar check into a step toward fluency.

## Overview

IGT leverages **multiple LLM providers** (Google Gemini, Alibaba Qwen, Deepseek) to provide real-time linguistic audits, corrections, and refinements. Beyond simple grammar checking, it automatically collects your error patterns into a local SQLite database, enabling **personalized learning tools**: Anki flashcards, error handbooks, targeted practice, and proficiency assessments.

**✨ NEW: Multi-LLM Support & Secure Configuration** — Switch between LLMs instantly, with API keys safely stored in `.env` (not in git). See [Quick Start](#quick-start) below.

```
Grammar Input > She don't like the weather today.
Processing... Done (1670ms)

**Review**:
- Incorrect. Subject-verb agreement error.

**Correction**:
- She doesn't like the weather today.

**Refine**:
- She isn't fond of today's weather.

**Diagnosis**:
- Subject-Verb Agreement (Minor)

**Rule**:
- Third person singular requires "doesn't", not "don't".

**Tip**:
- "She don't" is common in informal speech but incorrect in standard English.
```

## Features

### Core Grammar Checking

| Feature | Description |
|---------|-------------|
| **High Speed** | Optimized Node.js bridge achieves **<2s** loop times (83% faster than Gemini CLI) |
| **Three-Tier Feedback** | Review → Correction → Refine |
| **Persistent Logging** | Auto-logs all interactions to Markdown (Obsidian-compatible) |
| **Customizable Prompts** | Externalize system prompts via `system_prompt.txt` |

### English Learning Suite

| Feature | Command | Description |
|---------|---------|-------------|
| **Auto Data Collection** | *(automatic)* | Every grammar check is logged to SQLite with structured error types |
| **Anki Flashcards** | `cards` | Export errors as spaced-repetition study cards |
| **Error Handbook** | `handbook` | Generate an Obsidian Dashboard report of your weak points |
| **Practice Mode** | `practice` | Interactive exercises with auto-grading, targeting your top errors |
| **Proficiency Assessment** | `assess` | Estimate your CEFR level and track progress over time |

### Error Classification (MECE)

All errors are mapped to a predefined taxonomy of **13 types** across 5 categories:

```
Grammar ──┬── Article Usage
          ├── Verb Tense
          ├── Subject-Verb Agreement
          ├── Preposition Usage
          └── (4 more...)

Vocabulary ──── Word Choice
             ├── Idiomatic Expression
             └── Redundancy

Mechanics ──┬── Spelling
            ├── Punctuation
            └── Capitalization

Style ──────┬── Phrasing
            ├── Conciseness
            └── Tone & Register

Clarity ────┬── Sentence Fragment
            ├── Incomplete Thought
            └── Ambiguity
```

## Quick Start

### Prerequisites

- **Node.js** v24+ (includes `npm`)
- **PowerShell** (Windows) or any terminal
- **API Key** from one or more providers:
  - **Google Gemini**: [Get free key](https://aistudio.google.com/)
  - **Alibaba Qwen**: [Get DashScope key](https://dashscope.console.aliyun.com/apiKey)
  - **Deepseek**: [Get API key](https://platform.deepseek.com/api_keys)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ievertan00/igt.git
cd igt

# 2. Install dependencies
npm install

# 3. Configure (separated for security)
cp .env.example .env
# Edit .env: add your API keys (safe, not tracked by git)
```

### First Run

```powershell
./igt.ps1
```

Type a sentence at the `Grammar Input >` prompt. Type `exit` to quit.

**Or use interactive setup:**
```
llm setup  # Guides you through API key configuration
```

## Usage

### Interactive Mode

```
Grammar Input > He go to the store yesterday.
Processing... Done (1523ms)

**Review**: The original sentence requires corrections. Verb tense error detected.
**Correction**: He went to the store yesterday.
**Refine**: He visited the store yesterday.
**Diagnosis**: Verb Tense (Minor)
**Rule**: "Yesterday" indicates past time, requiring past tense "went".
**Tip**: Time markers (yesterday, last week, ago) signal which tense to use.

[Logged to: D:\Path\To\Your\Review_Log.md]

Grammar Input > cards
[Exporting Anki cards...]
✅ Exported 46 cards to: D:\Path\To\Your\igt_cards_2026-04-11.csv

Grammar Input > assess
[Generating proficiency assessment...]
🎯 Estimated CEFR Level: C1 - Effective Operational Proficiency
```

### Available Commands

| Command | Context | Description |
|---------|---------|-------------|
| `cards` | Inside IGT | Export Anki-compatible flashcards |
| `handbook` | Inside IGT | Generate personal error handbook (Obsidian Dashboard format) |
| `practice` | Inside IGT | Start interactive practice exercises |
| `assess` | Inside IGT | View proficiency assessment and CEFR estimate |
| `llm` | Inside IGT | Manage LLM providers (list, switch, status, setup) |
| `exit` / `quit` | Inside IGT | Exit the tool |

**LLM Management:**
```
llm list              # View all available LLM providers
llm current           # Show current provider
llm switch qwen       # Switch to Qwen (instant, no restart needed)
llm switch deepseek   # Switch to Deepseek
llm status            # Show detailed provider status & API key count
llm setup             # Interactive API key setup wizard
```

### Standalone Commands

```powershell
# Initialize database (first time only)
node tools/init-db.mjs

# Export flashcards with custom filename
node tools/igt-cards.mjs --export my_cards.csv

# Generate handbook for last 7 days (full regeneration)
node tools/igt-handbook.mjs --days=7

# Generate handbook with incremental updates (only changed rules)
node tools/igt-handbook.mjs --days=7 --incremental

# View cache statistics
node tools/igt-handbook.mjs --cache-stats

# Clear LLM rule cache
node tools/igt-handbook.mjs --clear-cache

# Practice a specific error type
node tools/igt-practice.mjs "Article Usage"

# Generate 10 practice exercises
node tools/igt-practice.mjs --count=10
```

### Incremental Update Mode

The `--incremental` (or `-i`) flag enables smart caching for LLM-generated grammar rules:

- **Skip unchanged rules**: Only regenerates rules when user examples have changed
- **Faster execution**: Reduces API calls and generation time by 60-80%
- **Automatic caching**: Rules are cached with content-based hashing
- **Cache management**: Use `--cache-stats` to view stats, `--clear-cache` to reset

```powershell
# First run: generates all rules (takes ~30-60s)
node tools/igt-handbook.mjs --days=30

# Subsequent runs: only updates changed rules (takes ~5-10s)
node tools/igt-handbook.mjs --days=30 --incremental

# Check what's cached
node tools/igt-handbook.mjs --cache-stats

# Force full regeneration
node tools/igt-handbook.mjs --days=30 --clear-cache
```

## Configuration

IGT uses **separated configuration** for better security:

- **`.env`** - Private data (API keys) - **Not tracked by git**
- **`lib/igt_config.json`** - Shared settings (paths, models, prompts) - **Safe to commit**

### Quick Setup

1. **Copy the template:**
   ```powershell
   cp .env.example .env
   ```

2. **Edit `.env` and add your API keys:**
   ```powershell
   notepad .env
   ```

3. **Or use interactive setup:**
   ```
   llm setup
   ```

### Configuration Files

**`.env` (Private):**
```env
GOOGLE_API_KEYS=key1,key2,key3
DASHSCOPE_API_KEYS=your-qwen-key
DEEPSEEK_API_KEYS=your-deepseek-key
IGT_LLM_PROVIDER=gemini
```

**`lib/igt_config.json` (Shared):**
```json
{
    "ReviewPath": "C:\\Users\\YourName\\Documents\\Review_Log.md",
    "ReportPath": "C:\\Users\\YourName\\Documents\\Reports",
    "LLMProvider": "gemini",
    "GeminiFlashModel": "gemini-2.5-flash",
    "GeminiProModel": "gemini-3.0-pro",
    "QwenFlashModel": "qwen3.5-flash",
    "QwenProModel": "qwen3-max",
    "DeepseekFlashModel": "deepseek-chat",
    "DeepseekProModel": "deepseek-reasoner",
    "DbPath": "igt_data.db"
}
```

**Task-Based Model Routing:**
- ⚡ **Flash models** — Grammar correction (fast, cost-effective)
- 🏆 **Pro models** — Handbook generation & Practice exercises (highest quality)

| Field | File | Description |
|-------|------|-------------|
| `ReviewPath` | config.json | Full path to the Markdown log file |
| `ReportPath` | config.json | Directory for handbook/assessment/card exports |
| `LLMProvider` | config.json/.env | Current provider (env takes priority) |
| `GeminiFlashModel` | config.json | Gemini flash model for grammar correction |
| `GeminiProModel` | config.json | Gemini pro model for handbook/practice |
| `QwenFlashModel` | config.json | Qwen flash model for grammar correction |
| `QwenProModel` | config.json | Qwen pro model for handbook/practice |
| `DeepseekFlashModel` | config.json | Deepseek flash model for grammar correction |
| `DeepseekProModel` | config.json | Deepseek pro model for handbook/practice |
| `DbPath` | config.json | SQLite database path |
| `GOOGLE_API_KEYS` | .env | Gemini API keys (comma-separated) |
| `DASHSCOPE_API_KEYS` | .env | Qwen API keys |
| `DEEPSEEK_API_KEYS` | .env | Deepseek API keys |

### Prompts Configuration

All LLM prompts are now centralized in the `Prompts` section of `lib/igt_config.json`:

```json
{
    "Prompts": {
        "SystemPrompt": "Act as an expert Linguistic Validator...",
        "HandbookGrammarRulePrompt": "You are an expert English grammar tutor...",
        "PracticeExercisePrompt": "Generate {{count}} grammar practice exercises..."
    }
}
```

This allows you to easily customize:
- **SystemPrompt**: Main grammar checking behavior
- **HandbookGrammarRulePrompt**: How grammar rules are explained in handbooks
- **PracticeExercisePrompt**: How practice exercises are generated

See [docs/prompt-config-guide.md](docs/prompt-config-guide.md) for detailed instructions.

### Environment Variables

**Private (in `.env` file):**
| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEYS` | Gemini API keys (comma-separated for multiple keys) |
| `DASHSCOPE_API_KEYS` | Qwen API keys (comma-separated) |
| `DEEPSEEK_API_KEYS` | Deepseek API keys (comma-separated) |
| `IGT_LLM_PROVIDER` | Default provider: `gemini`, `qwen`, or `deepseek` |

**Shared (can also set in system environment):**
| Variable | Description |
|----------|-------------|
| `GEMINI_SYSTEM_MD` | Set to `false` to disable system prompt overhead |
| `NO_COLOR` | Set to `1` to disable colored output |

**Note:** Environment variables take priority over `.env` file values.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User (PowerShell)                        │
│                   igt.ps1 (Main Loop)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ stdin/stdout
┌───────────────────────────▼─────────────────────────────────┐
│                   igt-bridge.mjs                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          LLM Provider Manager                        │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │         Task-Aware Model Router              │   │  │
│  │  │  Grammar → Flash ⚡  |  Handbook/Practice → Pro 🏆 │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │  ┌──────────┐  ┌────────┐  ┌──────────┐            │  │
│  │  │ Gemini   │  │  Qwen  │  │ Deepseek │            │  │
│  │  └──────────┘  └────────┘  └──────────┘            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Error Parser │  │ SQLite Writer│  │  Multi-LLM Router│  │
│  │ +Classifier  │  │ (Non-blocking)│  │                  │  │
│  └──────────────┘  └────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Learning Tools                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐     │
│  │ igt-cards   │  │ igt-handbook │  │ igt-practice  │     │
│  │ .mjs        │  │ .mjs (Pro 🏆)│  │ .mjs (Pro 🏆) │     │
│  └─────────────┘  └──────────────┘  └───────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| File | Role |
|------|------|
| `igt.ps1` | Main interactive loop, handles user I/O and command routing |
| `lib/igt-bridge.mjs` | Node.js bridge to LLM APIs, parses output, writes to SQLite |
| `lib/llm-provider.mjs` | Core LLM provider manager (switching, routing) |
| `lib/llm-gemini.mjs` | Google Gemini API implementation |
| `lib/llm-qwen.mjs` | Alibaba Qwen (DashScope) API implementation |
| `lib/llm-deepseek.mjs` | Deepseek API implementation |
| `lib/config-loader.mjs` | Configuration loader (merges .env + config.json) |
| `lib/llm-switch.mjs` | CLI tool for managing LLM providers |
| `lib/error-types.mjs` | MECE error type classification system |
| `tools/igt-cards.mjs` | Anki flashcard generator (CSV export) |
| `tools/igt-handbook.mjs` | Obsidian Dashboard report generator |
| `tools/igt-assess.mjs` | CEFR proficiency assessment engine |
| `tools/igt-practice.mjs` | Interactive practice with auto-grading |
| `tools/init-db.mjs` | Database initialization script |
| `tools/import-review-to-db.mjs` | Import legacy Markdown logs into SQLite |

## Performance Benchmarks

| Method | Wall Clock Time | Improvement |
|--------|----------------|-------------|
| Gemini CLI | ~9.91s | Baseline |
| **IGT Bridge** | **~1.67s** | **83.1% faster** |

Latency breakdown:
- Config & Prompt Loading: ~3ms
- Prompt Construction: ~1ms
- Gemini API Call: ~1,500ms (network-bound)
- Database Write: ~5ms (async, non-blocking)
- Logging: ~10ms

## License

MIT

## Documentation

- **[QUICKSTART_LLM.md](QUICKSTART_LLM.md)** - Quick start for multi-LLM setup
- **[docs/multi-llm-support.md](docs/multi-llm-support.md)** - Complete multi-LLM guide
- **[docs/config-separation.md](docs/config-separation.md)** - Configuration architecture
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Migration from old configuration
- **[CHANGELOG.md](CHANGELOG.md)** - Version history

## Contributors

- **Gemini CLI Agent**: Architecture, bridge development, and performance optimization
- **ievertan00**: Project vision, linguistic prompt engineering, and MECE classification design
