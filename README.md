# Interactive Grammar Tool (IGT)

A cross-platform CLI that checks your English grammar and turns every mistake into a learning event. Each correction is stored in a local SQLite database; the SRS deck, error handbook, practice exercises, and CEFR assessment all grow from that record. The loop: write → get corrected → review the card tomorrow → repeat until the error type reaches "mastered".

```
qwen-turbo ❯ She don't like the weather today.

Review
One error — subject-verb agreement.

Correction
She doesn't like the weather today.

Refine
She isn't fond of today's weather.

Diagnosis
- Subject-Verb Agreement (Minor): "don't" should be "doesn't" for third-person singular.

Rule
- Third-person singular subjects (he/she/it) require "doesn't", not "don't".

Tip
- When you see "she/he/it", the verb always gets an -s or -es in the present tense.

  1521ms llm  ·  1524ms total
```

## Features

|                        |                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Cross-platform**     | Runs on Windows (CMD/PowerShell), macOS, and Linux via a single Node.js entry point                                      |
| **Multi-LLM**          | Switch between Google Gemini, Alibaba Qwen, and Deepseek instantly — no restart needed                                   |
| **Fast**               | Persistent HTTP server eliminates Node.js startup overhead; typical response under 2s                                    |
| **Anti-hallucination** | Strict prompt rules prevent phantom error detection; corrections are verbatim if the input is already correct            |
| **Error taxonomy**     | All diagnoses normalized to 28 canonical types across 5 categories (Grammar, Vocabulary, Mechanics, Style, Clarity)     |
| **Auto-logging**       | Every check is saved to SQLite and appended to a Markdown review log (Obsidian-compatible)                               |
| **SRS flashcard deck** | Every error auto-generates a cloze flashcard; `/review` drills due cards with SM-2 spacing                               |
| **Mastery tracking**   | Error types bucketed frequent → occasional → rare → mastered based on 30-day occurrence counts                           |
| **Analytics**          | `/stats` shows error rate by sentence length, CEFR trajectory, and mastery breakdown                                     |
| **Learning suite**     | Personal error handbook, targeted practice exercises, and CEFR assessment — all driven by your actual error history      |

## Prerequisites

- **Node.js** v18+
- API key from at least one provider:
  - [Google Gemini](https://aistudio.google.com/) (free tier available)
  - [Alibaba Qwen / DashScope](https://dashscope.console.aliyun.com/apiKey)
  - [Deepseek](https://platform.deepseek.com/api_keys)

## Installation

```sh
git clone https://github.com/ievertan00/igt.git
cd igt
npm install
cp .env.example .env
# Edit .env and add your API keys
node tools/init-db.mjs   # initialize the SQLite database (first run only)
npm link                 # register the global `igt` command (run once)
igt
```

After `npm link`, the `igt` command is available from any directory in any terminal — CMD, PowerShell, bash, zsh.

If you prefer not to link globally, run directly:

```sh
node igt.mjs        # any platform
./igt.cmd           # Windows CMD / PowerShell wrapper
sh igt.sh           # macOS / Linux wrapper
```

## Configuration

IGT separates private and shared configuration:

| File                  | Tracked by git | Purpose                                  |
| --------------------- | -------------- | ---------------------------------------- |
| `.env`                | No             | API keys, personal file paths            |
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
IGT_REVIEW_PATH=/path/to/Review_Log.md
IGT_REPORT_PATH=docs
IGT_VAULT_DIR=/path/to/Obsidian/MyVault
```

**`lib/igt_config.json`** (excerpt)

```json
{
  "LLMProvider": "gemini",
  "GeminiFlashModel": "gemini-2.5-flash",
  "GeminiProModel":   "gemini-2.5-pro",
  "QwenFlashModel":   "qwen-turbo",
  "QwenProModel":     "qwen3.6-max-preview",
  "DeepseekFlashModel": "deepseek-chat",
  "DeepseekProModel":   "deepseek-reasoner"
}
```

Flash models handle grammar correction (speed-optimized); Pro models handle handbook and practice generation (quality-optimized). The `IGT_LLM_PROVIDER` value in `.env` overrides `LLMProvider` in `igt_config.json`.

All three LLM prompts (`SystemPrompt`, `HandbookGrammarRulePrompt`, `PracticeExercisePrompt`) live in the `Prompts` section of `igt_config.json` — edit them there rather than in the source files.

## Commands

Start IGT with `igt`. All commands use a `/` prefix at the input prompt.

| Command           | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| `/review`         | SRS review session — drills all cards due today with SM-2 grading   |
| `/today`          | Adaptive daily plan: SRS count + cloze drill + practice focus area  |
| `/stats`          | Analytics dashboard: errors by sentence length, mastery, CEFR trend |
| `/handbook`       | Generate your personal error handbook                               |
| `/practice`       | Start a practice session targeting your top error types             |
| `/practice B2 10` | Practice at CEFR level B2, 10 questions                             |
| `/assess`         | Estimate your current CEFR proficiency level                        |
| `/undo [N]`       | Delete the last N inputs and their diagnoses/cards (default 1)      |
| `/add <word>`     | Add a word to your Obsidian vocabulary note                         |
| `/vocab`          | Review saved vocabulary (quiz mode); `/vocab --list` to browse      |
| `/gemini`         | Switch to Gemini                                                    |
| `/qwen`           | Switch to Qwen                                                      |
| `/deepseek`       | Switch to Deepseek                                                  |
| `/llm status`     | Show current provider, configured keys, and model names             |
| `/help`           | Show command reference                                              |
| `exit`            | Quit IGT (shows session summary first)                              |

**Input behavior**: Ctrl+C clears the current input and returns to the prompt (does not exit). Use `"""` to enter multiline mode.

## Learning Suite

### SRS Flashcard Review (`/review`)

Every grammar check automatically generates a cloze flashcard: the corrected sentence with the changed word(s) blanked out. `/review` drills all cards due today. Grading is exact-match first; if your answer differs, a single LLM call decides whether it's semantically equivalent. SM-2 spacing determines when each card resurfaces — correct answers extend the interval, wrong answers reset it to 1 day.

### Daily Plan (`/today`)

Shows how many SRS cards are due, the recommended cloze drill count, a free-practice suggestion, and the error type to focus on today (most frequent in the last 30 days). Offers to launch `/review` immediately.

### Analytics (`/stats`)

- **Errors by sentence length** — whether complexity is driving your mistakes
- **CEFR trajectory** — your assessed level over time
- **Mastery breakdown** — every error type bucketed into frequent / occasional / rare / mastered based on 30-day counts

### Error Handbook (`/handbook`)

Analyses your error history and generates a structured Markdown report — one section per error type — covering your specific recurring patterns, root cause hypothesis, before/after examples, and a mnemonic. Formatted for Obsidian (collapsible callouts, tables).

Use `--incremental` on subsequent runs to skip unchanged sections (60–80% fewer API calls):

```sh
node tools/igt-handbook.mjs --days=30
node tools/igt-handbook.mjs --days=30 --incremental   # fast re-run
node tools/igt-handbook.mjs --cache-stats             # see what's cached
node tools/igt-handbook.mjs --days=30 --clear-cache   # force full rebuild
```

### Practice (`/practice`)

Generates exercises that target your top 3 recurring error types plus 2 recent ones. Mix of multiple-choice and fill-in-the-blank. Difficulty matches your CEFR level.

```sh
node tools/igt-practice.mjs                  # uses your error history
node tools/igt-practice.mjs "Article Usage"  # target a specific type
node tools/igt-practice.mjs --count=10       # set question count
```

### Assessment (`/assess`)

Estimates your current CEFR level (A1–C2) from your error history — frequency, severity, distribution, and improvement trend. Each assessment is stored with the input window it was scored against, so the trajectory is reproducible.

## Architecture

`igt.mjs` (Node.js main loop) starts a persistent HTTP server (`lib/igt-http-server.mjs`) on port `18964` at launch. Each grammar check is an HTTP POST to `http://127.0.0.1:18964/grammar`. The server returns structured JSON; the client owns rendering.

```
igt.mjs  ──POST /grammar──►  igt-http-server.mjs
                                    │
                          runMigrations() at boot
                          LLMProviderManager
                          ┌─────┬──────┬──────────┐
                       Gemini  Qwen  Deepseek   (flash for grammar,
                                                  pro for handbook/practice)
                                    │
                          parseDiagnosis() → SQLite (non-blocking)
                          buildCloze()    → srs_cards insert
                                    │
                          {data, perf} ◄── igt.mjs renders with color
```

**Key files**

| File                            | Role                                                      |
| ------------------------------- | --------------------------------------------------------- |
| `igt.mjs`                       | Interactive loop, color rendering, command routing        |
| `lib/igt-http-server.mjs`       | HTTP server, all endpoints, session state, DB writes      |
| `lib/migrations.mjs`            | Versioned migration runner (schema_version table)         |
| `migrations/`                   | Numbered `.sql` and `.mjs` migration files                |
| `lib/parse-diagnosis.mjs`       | Thin JSON parser for structured LLM output                |
| `lib/srs.mjs`                   | SM-2 spaced-repetition scheduler (pure functions)         |
| `lib/cloze.mjs`                 | Cloze card extraction from (original, correction) pairs   |
| `lib/mastery.mjs`               | 30-day mastery bucketing query                            |
| `lib/llm-provider.mjs`          | Provider abstraction, model routing, key rotation         |
| `lib/llm-gemini.mjs`            | Gemini API (schema-enforced JSON output)                  |
| `lib/llm-qwen.mjs`              | Qwen (DashScope) API                                      |
| `lib/llm-deepseek.mjs`          | Deepseek API                                              |
| `lib/config-loader.mjs`         | Merges `.env` + `igt_config.json` at startup              |
| `lib/error-types.mjs`           | 28-type MECE error taxonomy                               |
| `lib/ui.mjs`                    | ANSI colors, spinner, bar chart, text wrapping            |
| `tools/igt-handbook.mjs`        | Handbook generator with incremental cache                 |
| `tools/igt-practice.mjs`        | Practice exercise generator and grader                    |
| `tools/igt-assess.mjs`          | CEFR assessment engine + assessments DB write             |
| `tools/init-db.mjs`             | Thin wrapper around migration runner (first-run setup)    |
| `tools/import-review-to-db.mjs` | Import legacy Markdown logs into SQLite                   |

## Performance

|                       | Wall-clock time |
| --------------------- | --------------- |
| Gemini CLI (baseline) | ~9.91s          |
| IGT                   | ~1.67s          |

The 83% improvement comes entirely from eliminating per-request Node.js startup by keeping the HTTP server alive. The API call itself (~1,500ms) is the dominant cost and is network-bound.

## License

MIT
