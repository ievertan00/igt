# Interactive Grammar Tool (IGT)

> A high-performance CLI grammar validator with a built-in **English Learning Suite** — transform every grammar check into a step toward fluency.

## Overview

IGT leverages the Google Gemini API to provide real-time linguistic audits, corrections, and refinements. Beyond simple grammar checking, it automatically collects your error patterns into a local SQLite database, enabling **personalized learning tools**: Anki flashcards, error handbooks, targeted practice, and proficiency assessments.

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
- **Google AI Studio API Key** — [get one free](https://aistudio.google.com/)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ievertan00/igt.git
cd igt

# 2. Install dependencies
npm install

# 3. Configure
cp igt_config.json.example igt_config.json
# Edit igt_config.json: add your API key and set ReviewPath
```

### First Run

```powershell
./igt.ps1
```

Type a sentence at the `Grammar Input >` prompt. Type `exit` to quit.

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
| `exit` / `quit` | Inside IGT | Exit the tool |

### Standalone Commands

```powershell
# Initialize database (first time only)
node init-db.mjs

# Export flashcards with custom filename
node igt-cards.mjs --export my_cards.csv

# Generate handbook for last 7 days
node igt-handbook.mjs --days=7

# Practice a specific error type
node igt-practice.mjs "Article Usage"

# Generate 10 practice exercises
node igt-practice.mjs --count=10
```

## Configuration

Create or edit `igt_config.json` in the project root:

```json
{
    "ReviewPath": "C:\\Users\\YourName\\Documents\\Review_Log.md",
    "ReportPath": "C:\\Users\\YourName\\Documents\\Reports",
    "Model": "gemini-2.5-flash-lite",
    "SystemPromptPath": "system_prompt.txt",
    "DbPath": "igt_data.db",
    "ApiKey": "YOUR_API_KEY_HERE"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `ReviewPath` | Yes | Full path to the Markdown log file |
| `ReportPath` | No | Directory for handbook/assessment/card exports (defaults to project `docs/`) |
| `Model` | No | Gemini model identifier (default: `gemini-2.5-flash-lite`) |
| `SystemPromptPath` | No | Path to the system prompt file (default: `system_prompt.txt`) |
| `DbPath` | No | SQLite database path (default: `igt_data.db`) |
| `ApiKey` | No | Gemini API key (can also use `GOOGLE_API_KEY` env variable) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Alternative to `ApiKey` in config |
| `GEMINI_SYSTEM_MD` | Set to `false` to disable system prompt overhead |
| `NO_COLOR` | Set to `1` to disable colored output |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User (PowerShell)                        │
│                   igt.ps1 (Main Loop)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ stdin/stdout
┌───────────────────────────▼─────────────────────────────────┐
│                   igt-bridge.mjs                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Gemini API   │  │ Error Parser │  │ SQLite Writer    │  │
│  │ (Async)      │  │ +Classifier  │  │ (Non-blocking)   │  │
│  └──────────────┘  └──────────────┘  └────────┬─────────┘  │
└────────────────────────────────────────────────┼────────────┘
                                                 │
                            ┌────────────────────┼────────────────────┐
                            │                    │                    │
                     ┌──────▼──────┐     ┌───────▼───────┐    ┌──────▼──────┐
                     │ igt-cards   │     │ igt-handbook  │    │ igt-assess  │
                     │ .mjs        │     │ .mjs          │    │ .mjs        │
                     └─────────────┘     └───────────────┘    └─────────────┘
                            │                    │                    │
                     ┌──────▼──────┐     ┌───────▼───────┐    ┌──────▼──────┐
                     │ Anki CSV    │     │ Obsidian MD   │    │ CEFR Report │
                     └─────────────┘     └───────────────┘    └─────────────┘
```

### Key Components

| File | Role |
|------|------|
| `igt.ps1` | Main interactive loop, handles user I/O and command routing |
| `igt-bridge.mjs` | Node.js bridge to Gemini API, parses output, writes to SQLite |
| `error-types.mjs` | MECE error type classification system (13 predefined types) |
| `system_prompt.txt` | Linguistic validator prompt with Diagnosis/Rule/Tip format |
| `igt-cards.mjs` | Anki flashcard generator (CSV export) |
| `igt-handbook.mjs` | Obsidian Dashboard report generator |
| `igt-assess.mjs` | CEFR proficiency assessment engine |
| `igt-practice.mjs` | Interactive practice with auto-grading |
| `init-db.mjs` | Database initialization script |

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

## Contributors

- **Gemini CLI Agent**: Architecture, bridge development, and performance optimization
- **ievertan00**: Project vision, linguistic prompt engineering, and MECE classification design
