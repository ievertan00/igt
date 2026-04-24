# Interactive Grammar Tool (IGT)

A Windows CLI grammar checker powered by multiple LLM backends that doubles as a personal English learning system. Every correction is logged to a local SQLite database, building a record of your error patterns that drives targeted practice, error handbooks, and CEFR proficiency assessment.

```
[gemini-2.5-flash] > She don't like the weather today.
Processing... Done (1521ms)

**Review**: One error — subject-verb agreement (Minor overall).
**Correction**: She doesn't like the weather today.
**Refine**: She isn't fond of today's weather.
**Diagnosis**: Subject-Verb Agreement (Minor): "don't" should be "doesn't" for third-person singular.
**Rule**: Third-person singular subjects (he/she/it) require "doesn't", not "don't".
**Tip**: When you see "she/he/it", the verb always gets an -s or -es in the present tense.
```

## Features

|                        |                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Multi-LLM**          | Switch between Google Gemini, Alibaba Qwen, and Deepseek instantly — no restart needed                                  |
| **Fast**               | Persistent HTTP server eliminates Node.js startup overhead; typical response under 2s                                   |
| **Anti-hallucination** | Strict prompt rules prevent phantom error detection; corrections are verbatim if the input is already correct           |
| **Error taxonomy**     | All diagnoses are normalized to 20 canonical types across 5 categories (Grammar, Vocabulary, Mechanics, Style, Clarity) |
| **Auto-logging**       | Every check is saved to SQLite and appended to a Markdown review log (Obsidian-compatible)                              |
| **Learning suite**     | Personal error handbook, targeted practice exercises, and CEFR proficiency assessment built from your error history     |

## Prerequisites

- **Node.js** v18+
- **PowerShell** (Windows)
- API key from at least one provider:
  - [Google Gemini](https://aistudio.google.com/) (free tier available)
  - [Alibaba Qwen / DashScope](https://dashscope.console.aliyun.com/apiKey)
  - [Deepseek](https://platform.deepseek.com/api_keys)

## Installation

```powershell
git clone https://github.com/ievertan00/igt.git
cd igt
npm install
cp .env.example .env
# Edit .env and add your API keys
node tools/init-db.mjs   # initialize the SQLite database (first run only)
./igt.ps1
```

## Configuration

IGT separates private and shared configuration:

| File                  | Tracked by git | Purpose                              |
| --------------------- | -------------- | ------------------------------------ |
| `.env`                | No             | API keys, personal file paths        |
| `lib/igt_config.json` | Yes            | Model names, prompts, non-private config |

**`.env`**

```env
GOOGLE_API_KEYS=key1,key2        # comma-separated for automatic rotation
DASHSCOPE_API_KEYS=your-key
DEEPSEEK_API_KEYS=your-key
IGT_LLM_PROVIDER=gemini          # gemini | qwen | deepseek

# Local paths
IGT_DB_PATH=igt_data.db
IGT_LOG_PATH=igt_db_error.log
IGT_REVIEW_PATH=C:\Users\You\Documents\Review_Log.md
IGT_REPORT_PATH=docs
IGT_VAULT_DIR=D:\Obsidian\MyVault
```

**`lib/igt_config.json`** (excerpt)

```json
{
  "LLMProvider": "gemini",
  "GeminiFlashModel": "gemini-3.1-flash-lite",
  "GeminiProModel":   "gemini-3.1-flash",
  "QwenFlashModel":   "qwen-turbo",
  "QwenProModel":     "qwen3.6-max-preview",
  "DeepseekFlashModel": "deepseek-chat",
  "DeepseekProModel":   "deepseek-reasoner"
}
```

Flash models handle grammar correction (speed-optimized); Pro models handle handbook and practice generation (quality-optimized). The `IGT_LLM_PROVIDER` value in `.env` overrides `LLMProvider` in `igt_config.json`.

All three LLM prompts (`SystemPrompt`, `HandbookGrammarRulePrompt`, `PracticeExercisePrompt`) live in the `Prompts` section of `igt_config.json` — edit them there rather than in the source files.

## Commands

Start IGT with `./igt.ps1`. All commands use a `/` prefix at the input prompt.

| Command           | Description                                                    |
| ----------------- | -------------------------------------------------------------- |
| `/handbook`       | Generate your personal error handbook                          |
| `/practice`       | Start a practice session targeting your top error types        |
| `/practice B2 10` | Practice at CEFR level B2, 10 questions                        |
| `/assess`         | Estimate your current CEFR proficiency level                   |
| `/add <word>`     | Add a word to your Obsidian vocabulary note                    |
| `/vocab`          | Review saved vocabulary (quiz mode); `/vocab --list` to browse |
| `/gemini`         | Switch to Gemini                                               |
| `/qwen`           | Switch to Qwen                                                 |
| `/deepseek`       | Switch to Deepseek                                             |
| `/llm status`     | Show current provider, configured keys, and model names        |
| `/llm setup`      | Interactive wizard to configure API keys                       |
| `/help`           | Show command reference                                         |
| `exit`            | Quit IGT                                                       |

**Input behavior**: Ctrl+C clears the current input and returns to the prompt. Long inputs wrap across multiple terminal rows automatically. Use `"""` to enter multiline mode.

## Learning Suite

### Error Handbook (`/handbook`)

Analyses your error history and generates a structured Markdown report — one section per error type — covering your specific recurring patterns, root cause hypothesis, before/after examples, and a mnemonic. The report is formatted for Obsidian (collapsible callouts, tables).

Use `--incremental` on subsequent runs to skip unchanged sections (60–80% fewer API calls):

```powershell
node tools/igt-handbook.mjs --days=30
node tools/igt-handbook.mjs --days=30 --incremental   # fast re-run
node tools/igt-handbook.mjs --cache-stats             # see what's cached
node tools/igt-handbook.mjs --days=30 --clear-cache   # force full rebuild
```

### Practice (`/practice`)

Generates exercises that target your top 3 recurring error types plus 2 recent ones. Mix of multiple-choice and fill-in-the-blank. Difficulty matches your CEFR level. Wrong-answer options are plausible mistakes, not obvious distractors.

```powershell
node tools/igt-practice.mjs                  # uses your error history
node tools/igt-practice.mjs "Article Usage"  # target a specific type
node tools/igt-practice.mjs --count=10       # set question count
```

### Assessment (`/assess`)

Estimates your current CEFR level (A1–C2) from your error history — frequency, severity, error type distribution, and improvement trend over time.

## Architecture

`igt.ps1` (PowerShell main loop) starts a persistent Node.js HTTP server (`lib/igt-http-server.mjs`) on port `18964` at launch. Each grammar check is an HTTP POST to `http://127.0.0.1:18964/grammar` — this avoids per-request Node.js startup cost.

```
igt.ps1  ──POST /grammar──►  igt-http-server.mjs
                                    │
                          LLMProviderManager
                          ┌─────┬──────┬──────────┐
                       Gemini  Qwen  Deepseek   (flash for grammar,
                                                  pro for handbook/practice)
                                    │
                          Error parser + SQLite writer (async)
                                    │
                          JSON response ◄── igt.ps1 renders with color
```

**Key files**

| File                            | Role                                               |
| ------------------------------- | -------------------------------------------------- |
| `igt.ps1`                       | Interactive loop, color rendering, command routing |
| `lib/igt-http-server.mjs`       | HTTP server, request handling, orchestration       |
| `lib/llm-provider.mjs`          | Provider abstraction, model routing, key rotation  |
| `lib/llm-gemini.mjs`            | Gemini API implementation                          |
| `lib/llm-qwen.mjs`              | Qwen (DashScope) API implementation                |
| `lib/llm-deepseek.mjs`          | Deepseek API implementation                        |
| `lib/config-loader.mjs`         | Merges `.env` + `igt_config.json` at startup       |
| `lib/error-types.mjs`           | 20-type MECE error taxonomy                        |
| `tools/igt-handbook.mjs`        | Handbook generator with incremental cache          |
| `tools/igt-practice.mjs`        | Practice exercise generator and grader             |
| `tools/igt-assess.mjs`          | CEFR assessment engine                             |
| `tools/init-db.mjs`             | Database initializer                               |
| `tools/import-review-to-db.mjs` | Import legacy Markdown logs into SQLite            |

## Performance

|                       | Wall-clock time |
| --------------------- | --------------- |
| Gemini CLI (baseline) | ~9.91s          |
| IGT                   | ~1.67s          |

The 83% improvement comes entirely from eliminating per-request Node.js startup by keeping the HTTP server alive. The API call itself (~1,500ms) is the dominant cost and is network-bound.

## License

MIT
