# Interactive Grammar Tool (IGT)

A command-line English grammar checker that turns every mistake into a learning event. Type a sentence, get an instant correction with explanation, and automatically build a flashcard deck that drills you on your personal error patterns.

```
gemini-2.5-flash ❯ She don't like the weather today.

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

---

## Table of Contents

- [Before You Start](#before-you-start)
- [Installation (Step by Step)](#installation-step-by-step)
- [Database Initialization & Migrations](#database-initialization--migrations)
- [Setting Up Your AI Provider](#setting-up-your-ai-provider)
  - [Option A — Online AI (Gemini, Qwen, Deepseek)](#option-a--online-ai-gemini-qwen-deepseek)
  - [Option B — Local AI with Ollama (No API Key)](#option-b--local-ai-with-ollama-no-api-key)
- [Features](#features)
- [Commands](#commands)
- [Configuration Reference](#configuration-reference)
- [Architecture](#architecture)
- [License](#license)

---

## Before You Start

You need two things installed on your computer before you can run IGT.

### 1. Node.js

Node.js is a program that runs JavaScript code outside a web browser. IGT is built with it.

- Go to **https://nodejs.org** and download the **LTS** version (the left button).
- Run the installer and accept the defaults.
- When finished, open a terminal (Command Prompt or PowerShell on Windows, Terminal on Mac/Linux) and verify it worked:

  ```
  node --version
  ```

  You should see something like `v22.0.0`. Any version 18 or higher is fine.

### 2. Git

Git is a tool for downloading and managing code from the internet.

- Go to **https://git-scm.com/downloads** and download the installer for your system.
- Run it with the default settings.
- Verify:

  ```
  git --version
  ```

  You should see something like `git version 2.44.0`.

---

## Installation (Step by Step)

Open a terminal and follow these steps exactly, one at a time.

**Step 1 — Download the code**

```sh
git clone https://github.com/ievertan00/igt.git
```

This creates a folder called `igt` in your current directory.

**Step 2 — Enter the folder**

```sh
cd igt
```

**Step 3 — Install dependencies**

```sh
npm install
```

This downloads the libraries IGT needs (into a `node_modules` folder). It may take a minute.

**Step 4 — Create your configuration file**

```sh
# On Windows (PowerShell):
Copy-Item .env.example .env

# On Mac/Linux:
cp .env.example .env
```

This creates your private `.env` file where you will add your API key.

**Step 5 — Add your API key**

Open the `.env` file in any text editor (Notepad, VS Code, etc.) and fill in at least one API key. See [Setting Up Your AI Provider](#setting-up-your-ai-provider) for where to get keys.

**Step 6 — Set up the database**

```sh
node scripts/init-db.mjs
```

This creates the local SQLite database that stores your grammar history, flashcards, and progress.

**Step 7 — Register the global command (optional but recommended)**

```sh
npm link
```

After this, you can type `igt` from any folder in any terminal to launch the tool. You only need to run this once.

**Step 8 — Launch IGT**

```sh
igt
```

Or, if you skipped Step 7:

```sh
node igt.mjs
```

You should see a prompt like `gemini-2.5-flash ❯`. Start typing a sentence.

---

## Database Initialization & Migrations

IGT uses a local SQLite database (`igt_data.db`) to store your learning progress. The database is managed through a migration system to ensure it stays up-to-date as new features are added.

### First-Time Setup

On your very first run, you MUST initialize the database:

```sh
node scripts/init-db.mjs
```

This will:
1. Create the database file if it doesn't exist.
2. Apply the core schema (tables for sessions, inputs, diagnoses, etc.).
3. Seed the initial status messages (Tips, Facts, Quotes).

### Automatic Updates

Every time you launch IGT, the server automatically checks for any missing migrations and applies them. You generally don't need to run `init-db.mjs` again unless you are troubleshooting or have manually deleted your database file.

### Troubleshooting

- **"Database is locked"**: This usually happens if multiple instances of IGT are running or if another tool is accessing the `.db` file. Close all instances and try again.
- **Migration errors**: If a migration fails, IGT will log the error to `igt_db_error.log`. You can safely delete the `.db` file and run `node scripts/init-db.mjs` to start fresh (note: this will erase your history).

---

## Setting Up Your AI Provider

IGT can use either online AI services (which require a free API key) or a local AI model running on your own computer (no key needed).

---

### Option A — Online AI (Gemini, Qwen, Deepseek)

All three services offer free tiers. Pick one to start.

#### Google Gemini (recommended for beginners — most generous free tier)

1. Go to **https://aistudio.google.com/apikey** and sign in with a Google account.
2. Click **Create API key**.
3. Copy the key (it starts with `AIza…`).
4. Open your `.env` file and paste it:

   ```env
   GOOGLE_API_KEYS=AIzaSyYourKeyHere
   IGT_LLM_PROVIDER=gemini
   ```

5. Save the file. Launch `igt`.

> You can add multiple Gemini keys separated by commas (`key1,key2`) — IGT rotates through them automatically if one hits its rate limit.

---

#### Alibaba Qwen (DashScope)

1. Go to **https://dashscope.console.aliyun.com/apiKey** and create an account.
2. Create an API key and copy it.
3. Open `.env` and paste it:

   ```env
   DASHSCOPE_API_KEYS=sk-YourKeyHere
   IGT_LLM_PROVIDER=qwen
   ```

4. Save and launch `igt`.

---

#### Deepseek

1. Go to **https://platform.deepseek.com/api_keys** and create an account.
2. Create an API key and copy it.
3. Open `.env` and paste it:

   ```env
   DEEPSEEK_API_KEYS=sk-YourKeyHere
   IGT_LLM_PROVIDER=deepseek
   ```

4. Save and launch `igt`.

---

#### Switching providers while running

You can switch without restarting. At the `❯` prompt:

```
/gemini      → switch to Gemini
/qwen        → switch to Qwen
/deepseek    → switch to Deepseek
/ollama      → switch to local Ollama
/llm status  → show which provider is active and which keys are configured
```

---

### Option B — Local AI with Ollama (No API Key)

Ollama runs an AI model entirely on your computer. No internet connection is needed for grammar checks, and there are no usage limits or fees. The tradeoff is that it requires a reasonably modern computer and takes a few minutes to set up.

**System requirements:** 8 GB RAM minimum; 16 GB recommended for good quality. A dedicated GPU speeds things up significantly but is not required.

#### Step 1 — Install Ollama

Go to **https://ollama.com/download** and install it for your system. On Windows, run the `.exe` installer. On Mac, drag the app to Applications. On Linux, run the shell script shown on the site.

Verify it's installed:

```sh
ollama --version
```

#### Step 2 — Download a model

IGT defaults to **Phi-4** (Microsoft, 14B parameters — good quality, fits in 8 GB RAM):

```sh
ollama pull phi4
```

This downloads about 9 GB. It only needs to happen once.

To use a smaller/faster model instead, pull it and update `OllamaModel` in `igt_config.json`:

```sh
ollama pull llama3.2      # 3B, faster, slightly lower quality
ollama pull mistral       # 7B, good balance
```

#### Step 3 — Configure IGT to use Ollama

Open your `.env` file and set:

```env
IGT_LLM_PROVIDER=ollama
```

No API key is needed for Ollama.

#### Step 4 — Start Ollama and launch IGT

Ollama usually starts automatically at login. If it isn't running, start it:

```sh
ollama serve
```

Then in a new terminal window:

```sh
igt
```

The prompt will show `phi4 ❯` (or whichever model you set). The first request may take 10–20 seconds while the model loads into memory; subsequent requests are faster.

---

## Features

### Grammar Checking

Type any English sentence at the prompt and press Enter. IGT sends it to the AI and returns a structured analysis:

```
gemini-2.5-flash ❯ I have went to the store yesterday.

Review
One error — verb tense.

Correction
I went to the store yesterday.

Refine
I stopped by the store yesterday.

Diagnosis
- Verb Tense (Moderate): "have went" is incorrect. Use simple past "went" with "yesterday".

Rule
- Simple past ("went") is used for completed actions with a specific past time reference.
  Present perfect ("have gone") is used without a specific time or for recent events.

Tip
- Time words like "yesterday", "last week", "in 2020" always pair with simple past.
```

If your sentence has no errors, IGT confirms it and explains why it's correct — it won't invent problems.

Every check is saved to your local database and automatically generates a flashcard.

### Translation (`/translate` or auto-detect)

Translate Chinese text to English naturally. IGT automatically detects Chinese input at the main prompt and routes it to the translation engine, complete with nuance notes and idioms. Or, use `/translate <text>` (alias: `/tr <text>`).

### Grammar Consultation (`/ask`)

Ask multi-turn questions about English grammar. IGT queries its local reference database (`grammar_ref.db`) via native function-calling to provide grounded, reliable answers with source citations.

```
❯ /ask when do I use present perfect instead of simple past?
```

### Status Bar & Tips

After every check, the status bar displays a random message from a collection of 300+ items, including:
- **Tips**: Learn hidden features like `/undo` or `/refine`.
- **Grammar Facts**: Interesting trivia about English history and rules.
- **Quotes**: Inspiring words from linguists and authors.

### Multiline Input

For paragraphs or longer passages, enter multiline mode with `"""`:

```
❯ """
Type your text here.
Press """ on a new line to submit.
"""
```

### SRS Flashcard Review (`/review`)

Every error you make generates a flashcard:

```
❯ /review

Card 1 of 8
She _____ like the weather today.
(Subject-Verb Agreement)

Your answer: doesn't

✓ Correct  →  next review in 4 days
```

The SM-2 algorithm schedules each card: answer correctly and the interval grows (1 day → 4 days → 10 days…); miss it and it resets to tomorrow. Over time you stop seeing cards for errors you've mastered.

Grading is exact-match first. If your answer differs in phrasing but is semantically correct, a quick AI call decides whether to accept it.

### Daily Plan (`/today`)

Shows a summary of what to do today:

```
❯ /today

Today's Plan
  SRS cards due:     12
  Suggested drills:   5 exercises
  Focus area:        Verb Tense  (most frequent in last 30 days)

Launch /review now? [y/n]
```

### Analytics (`/stats`)

The stats dashboard provides a comprehensive view of your learning journey:

```
❯ /stats

  [ Effort Trend: Last 7 Days ]

  10 ┤      █
   8 ┤      █
   6 ┤  █   █   █
   4 ┤  █   █   █   █
   2 ┤  █   █   █   █   █
     └─11──12──13──14──15─

  Weekly:   24 inputs (+15%) vs last week. Great progress! Your consistency is paying off.
  Monthly:  82 inputs (+8%) vs last month. Solid stability. Keep up the rhythm.

  [ CEFR Trajectory: Monthly ]
  2026-03  ███ B1
  2026-04  ██████ B2
  2026-05  █████████ C1

  [ Top 3 Priorities ]
  1. Verb Tense (64 hits)
     Fix: /practice --type "Verb Tense"
  2. Article Usage (28 hits)
     Fix: /practice --type "Article Usage"
  3. Preposition Usage (19 hits)
     Fix: /practice --type "Preposition Usage"

  [ Vault Snapshot ]
  Vocab:    142 words (+12 this week)
  Practice: 88% avg (last 5 sessions)
```

- **Effort Trend**: A visual 7-day chart of your input volume.
- **Mastery Breakdown**: Identifies your most frequent error types (Top 3 Priorities).
- **CEFR Trajectory**: Tracks your proficiency level progression over months.
- **Vault Snapshot**: Real-time stats parsed from your vocabulary and practice logs.

### Error Handbook (`/handbook`)

The handbook turns your accumulated error history into a personalized reference document. Instead of generic grammar rules, it analyzes your actual mistakes, identifies your specific recurring sub-pattern (your "linguistic fingerprint"), and explains the root cause in terms of what you personally do wrong.

Run it from the command line:

```sh
node tools/igt-handbook.mjs --days=30
```

**Terminal output while running:**

```
🤖 Generating overall summary with GEMINI...
🤖 Generating 6 grammar rules with GEMINI (gemini-2.5-pro)...
✅ Generated Verb Tense
✅ Generated Article Usage
✅ Generated Subject-Verb Agreement
✅ Generated Preposition Usage
✅ Generated Word Choice
✅ Generated Punctuation

📄 Report saved: docs/handbook_2026-05-07.md
```

**What the generated file looks like:**

The output is a Markdown file structured for Obsidian (collapsible callouts, tables). Here is what a realistic excerpt looks like:

---

```markdown
# 📘 Personal English Error Handbook

> [!INFO] Generated with: GEMINI (gemini-2.5-pro) on 2026-05-07

> [!ABSTRACT] 📊 Performance Summary
> - **Period**: Last 30 days
> - **Inputs Analyzed**: 283
> - **Total Diagnoses**: 156
> - **Unique Error Types**: 6
> - **Critical Priority**: Verb Tense

## 📝 Executive Linguistic Summary

### 📝 Linguistic Profile
Your writing demonstrates solid B1–B2 command of vocabulary and sentence structure.
The dominant pattern across your 283 inputs is tense confusion at clause boundaries —
particularly mixing simple past and present perfect in the same sentence. Mechanics
errors (spelling, punctuation) are rare, suggesting strong written foundations.

### 🚀 Key Strengths & Bottlenecks
- **Strength**: Article usage has improved markedly — only 3 occurrences in the last
  two weeks, down from 14 the month before.
- **Bottleneck**: Verb tense accounts for 41% of all diagnoses. The sub-pattern is
  specific: you use present perfect ("have gone", "have seen") with explicit past-time
  adverbs ("yesterday", "last week") that require simple past.

### 🎯 Strategic Goals
1. Drill the present-perfect vs. simple-past contrast with time-adverb triggers for
   the next 2 weeks; use the /review deck daily.
2. Target Preposition Usage in /practice sessions — fixed verb–preposition pairs
   (arrive at, good at, depend on) account for your 9 remaining preposition errors.
3. Run /assess again in 3 weeks to confirm the B2 trajectory.

> [!TIP] Coach's Note
> One targeted drill per day on the present perfect / simple past contrast will
> resolve 40% of your remaining error load.

## 🎯 Error Frequency Ranking

| Error Type              | Freq | Severity    |
| :---------------------- | :--- | :---------- |
| Verb Tense              | 64   | 🔴 Major    |
| Article Usage           | 28   | 🟡 Moderate |
| Preposition Usage       | 19   | 🟡 Moderate |
| Subject-Verb Agreement  | 14   | 🟢 Minor    |
| Word Choice             | 11   | 🟢 Minor    |
| Punctuation             |  9   | 🟢 Minor    |

## 📈 Weekly Trend

| Week    | Errors              |
| :------ | :------------------ |
| 2026-17 | ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 14  |
| 2026-18 | ▓▓▓▓▓▓▓▓▓▓▓ 11      |
| 2026-19 | ▓▓▓▓▓▓▓▓ 8          |
| 2026-20 | ▓▓▓▓▓ 5             |

> [!SUCCESS] ✅ Good news! Your errors decreased by 28.6% in recent weeks.

## 🔍 Detailed Error Analysis

> [!CAUTION]- 🔴 Verb Tense (64 Occurrences)
>
> ### 📝 Example 1
>
> > [!FAILURE] Original (❌)
> > `I have seen him yesterday at the office.`
>
> > [!SUCCESS] Corrected (✅)
> > `I saw him yesterday at the office.`
>
> > [!TIP] Natural Phrasing (✨)
> > `I ran into him at the office yesterday.`
>
> > [!INFO] Logic & Rules
> > **Why**: "Yesterday" is a specific past-time marker; present perfect cannot
> >   be used with it. Simple past ("saw") is required.
> > **Rule**: Present perfect = no specific time anchor. Simple past = specific
> >   time anchor (yesterday, last week, in 2020).
> > **Pro Tip**: If you can answer "when exactly?", use simple past.
>
> ---
>
> ### 📝 Example 2
>
> > [!FAILURE] Original (❌)
> > `She has graduated last June and found a job immediately.`
>
> > [!SUCCESS] Corrected (✅)
> > `She graduated last June and found a job immediately.`
>
> > [!TIP] Natural Phrasing (✨)
> > `She graduated last June and landed a job right away.`
>
> > [!INFO] Logic & Rules
> > **Why**: "Last June" is a specific past time — present perfect is invalid here.
> > **Rule**: Both verbs in a compound predicate must share the same tense.

## 📚 Grammar Rules Reference (AI-Powered)

### Grammar

> [!NOTE]- 🔴 Verb Tense
>
> #### Overview
> English tense encodes not just time but the speaker's relationship to the event.
> Present perfect signals relevance to the present moment; simple past closes the
> event as finished history. The two are not interchangeable.
>
> #### Detected Habit
> *"The Yesterday Trap"* — you consistently reach for present perfect when narrating
> recent past events, then attach a specific time adverb that contradicts it.
>
> #### Root Cause
> In Mandarin, aspect markers (了, 过) indicate completion without tense distinction,
> so the present-perfect / simple-past contrast has no direct L1 equivalent —
> learners default to the "more complete-sounding" form.
>
> #### Before / After
> | ❌ User wrote                        | ✅ Should be                    | Why                     |
> | :---------------------------------   | :------------------------------ | :---------------------- |
> | I have seen him yesterday.           | I saw him yesterday.            | specific time = simple past |
> | She has graduated last June.         | She graduated last June.        | "last June" anchors the past |
> | We have finished the report at 5 PM. | We finished the report at 5 PM. | clock time = simple past |
>
> #### The Rule
> - Use **simple past** whenever a specific time expression is present
>   (yesterday, last week, in 2020, at 3 PM, when I was young).
> - Use **present perfect** when no time is specified and the focus is on
>   the current result or relevance (I've lost my keys — they're still missing).
> - Never combine present perfect with a specific past-time adverb.
> - In compound predicates ("she graduated and found"), both verbs must match.
>
> #### Mnemonic
> *"Specific time? Simple past every time."*
>
> > [!TIP] Key Takeaway
> > If you can answer "when exactly?", the answer is always simple past —
> > no exceptions.
```

---

**CLI options:**

```sh
node tools/igt-handbook.mjs --days=30            # last 30 days (default)
node tools/igt-handbook.mjs --days=7             # focus on this week only
node tools/igt-handbook.mjs --days=0             # all time
node tools/igt-handbook.mjs --days=30 --incremental   # skip unchanged sections
node tools/igt-handbook.mjs --cache-stats        # show what's cached
node tools/igt-handbook.mjs --days=30 --clear-cache   # force full rebuild
```

`--incremental` computes an MD5 of your example data for each error type. If the examples haven't changed since the last run, the cached LLM output is reused — typically saving 60–80% of API calls when you regenerate weekly.

The output file is saved to `IGT_REPORT_PATH` (set in `.env`). The filename includes the date: `handbook_2026-05-07.md`. Opening it in Obsidian renders the collapsible callouts, tables, and tip boxes interactively.

### Practice Exercises (`/practice`)

Generates exercises that target your most frequent error types. Mix of multiple-choice and fill-in-the-blank, calibrated to your CEFR level.

```
❯ /practice

Exercise 1 of 10  [Verb Tense]
By the time she arrived, we _____ dinner.
  A) finish       B) have finished
  C) had finished D) were finishing

Your answer: C

✓ Correct — "had finished" (past perfect) is needed because the finishing happened
  before another past event ("arrived").
```

**Targeted Practice:**
You can target specific weaknesses using the `--type` flag:

```
❯ /practice --type "Verb Tense"
```

Specify level and count directly:

```
❯ /practice B2 10
```

Or from the command line:

```sh
node tools/igt-practice.mjs --count=15
node tools/igt-practice.mjs --type "Article Usage"   # target a specific error type
```

### CEFR Assessment (`/assess`)

Estimates your current English level (A1–C2) from your error history — frequency, severity, distribution, and improvement trend. Each result is stored with the data window it was scored against so you can track your trajectory over time.

### Vocabulary Lookup (`/add`)

```
❯ /add ephemeral

ephemeral  /ɪˈfem(ə)r(ə)l/  adjective
Meaning: lasting for a very short time
Example: "the ephemeral pleasures of youth"
Synonyms: transitory, transient, fleeting, short-lived

Saved to vocabulary vault ✓
```

Review saved words with `/vocab`.

### Undo (`/undo`)

Made a typo and don't want it in your flashcard deck? Undo your last input:

```
❯ /undo
Delete last 1 input and all associated cards? [y/n] y
✓ Removed.
```

Use `/undo 3` to remove the last 3 inputs.

---

## Commands

Start IGT with `igt`. All commands use a `/` prefix.

| Command             | Description                                                          |
| ------------------- | -------------------------------------------------------------------- |
| `/review`           | SRS review session — drills all flashcards due today                 |
| `/today`            | Daily plan: cards due, suggested drills, focus error type            |
| `/stats`            | Analytics: error rate by sentence length, mastery breakdown, CEFR   |
| `/handbook`         | Generate your personal error handbook (runs as background task)      |
| `/practice`         | Practice session targeting your top error types                      |
| `/practice B2 10`   | Practice at CEFR level B2, 10 questions                              |
| `/assess`           | Estimate your current CEFR proficiency level                         |
| `/ask <question>`   | Ask a grammar question with local database citations                 |
| `/translate <text>` | Translate Chinese text to English (alias: `/tr`)                     |
| `/undo [N]`         | Delete the last N inputs and their flashcards (default: 1)           |
| `/add <word>`       | Look up a word and save it to your vocabulary vault                  |
| `/vocab`            | Quiz yourself on saved vocabulary; `/vocab --list` to browse         |
| `/gemini`           | Switch to Google Gemini                                              |
| `/qwen`             | Switch to Alibaba Qwen                                               |
| `/deepseek`         | Switch to Deepseek                                                   |
| `/ollama`           | Switch to local Ollama model                                         |
| `/llm status`       | Show active provider, configured keys, and model names               |
| `/help`             | Show command reference                                               |
| `exit`              | Quit (shows session summary first)                                   |

**Keyboard shortcuts:**

- `↑` / `↓` — browse input history
- `Ctrl+C` — clear current input and return to prompt (does not exit)
- `"""` — enter multiline input mode

---

## Configuration Reference

IGT uses two configuration files:

| File                  | Tracked by git | Purpose                               |
| --------------------- | -------------- | ------------------------------------- |
| `.env`                | No             | API keys, file paths, themes (private) |
| `igt_config.json`     | Yes            | Model names, prompts (shared)         |

### `.env` (full reference)

```env
# --- AI Provider Keys ---
GOOGLE_API_KEYS=key1,key2        # comma-separated; IGT rotates on rate-limit
DASHSCOPE_API_KEYS=your-key      # Qwen / Alibaba DashScope
DEEPSEEK_API_KEYS=your-key       # Deepseek
IGT_LLM_PROVIDER=gemini          # gemini | qwen | deepseek | ollama

# --- File Paths & Settings ---
IGT_DB_PATH=igt_data.db          # SQLite database (auto-created on first run)
IGT_LOG_PATH=igt_db_error.log    # background error log
IGT_GRAMMAR_REF_DB_PATH=grammar_ref.db # Grammar reference database for /ask
IGT_THEME=default                # CLI color theme
IGT_REVIEW_PATH=                 # optional: path to a Markdown corrections log
IGT_REPORT_PATH=                 # folder for handbook/assessment exports

# --- Obsidian Integration (optional) ---
IGT_VAULT_DIR=                   # root of your Obsidian vault
IGT_VOCABULARY_FILE=             # vocabulary note path within vault
IGT_PRACTICE_FILE=               # practice log path within vault
IGT_ASK_FILE=                    # ask consultation log path within vault
```

### `igt_config.json` (excerpt)

```json
{
  "LLMProvider": "gemini",
  "GeminiFlashModel": "gemini-2.5-flash",
  "GeminiProModel":   "gemini-2.5-pro",
  "QwenFlashModel":   "qwen-turbo",
  "QwenProModel":     "qwen3.6-max-preview",
  "DeepseekFlashModel": "deepseek-chat",
  "DeepseekProModel":   "deepseek-reasoner",
  "OllamaBaseUrl":    "http://localhost:11434/v1",
  "OllamaModel":      "phi4"
}
```

Flash models handle grammar correction (speed-optimized); Pro models handle handbook and practice generation (quality-optimized). To change which Ollama model IGT uses, update `OllamaModel` — run `ollama list` to see what you have installed.

All LLM prompts live in the `Prompts` section of `igt_config.json`. You can edit them to tune IGT's behavior without touching source files.

---

## Architecture

`igt.mjs` (interactive loop) spawns a persistent HTTP server (`lib/server/index.mjs`) on port `18964` at launch. Each grammar check is an HTTP POST to `http://127.0.0.1:18964/grammar`. The server returns structured JSON; the client owns rendering.

```
igt.mjs  ──POST /grammar──►  lib/server/index.mjs
                                    │
                          runMigrations() at boot
                          LLMProviderManager
                          ┌──────┬──────┬──────────┬────────┐
                       Gemini  Qwen  Deepseek  Ollama   ← flash model for grammar
                                                          pro model for handbook
                                    │
                          parseDiagnosis() → SQLite (non-blocking)
                                    │
                          {data, perf} ◄── igt.mjs renders with color
```

The codebase is organized into domain-driven modules under `lib/`:
- `lib/cli/` — CLI-specific logic, UI rendering, and command routing.
- `lib/domain/` — Core business logic (SRS, mastery, parsing).
- `lib/features/` — Feature-specific logic (e.g., handbook generation).
- `lib/server/` — HTTP server, routing, and LLM provider logic.
- `lib/shared/` — Shared utilities like configuration loaders.

The persistent server eliminates per-request Node.js startup overhead — typical grammar check time is ~1.5s vs ~9.9s with a cold-start approach (83% faster).

---

## License

MIT
