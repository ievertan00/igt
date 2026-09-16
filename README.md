# Interactive Grammar Tool (IGT)

A command-line English learning companion for everyday life and work communication. Check your writing, understand corrections, build vocabulary, listen and repeat, practise conversations, and revisit what you have learned through spaced review.

![Grammar check screenshot](assets/1.jpg)

---

## Table of Contents

- [A Connected Learning Routine](#a-connected-learning-routine)
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

## A connected learning routine

Use `/help` to browse commands by learning activity, or `/today` to see your review counts and choose a short session.

1. **Learn an expression:** `/add follow up`. Read its meaning, collocations, and examples; choose whether to save it.
2. **Listen and repeat:** `/listen` plays the latest English expression and, after a vocabulary lookup, its first available example. Repeat aloud, then make your own sentence. Use `/listen <English text>` for a specific phrase and `/listen --stop` to stop playback.
3. **Use it:** type a daily update or work message, such as “I will follow up with the client tomorrow.” Use `/explain` to understand any correction, or translate a Chinese expression and replay the English.
4. **Converse:** open `/chat` and describe a situation: “Help me practise asking a colleague for clarification.” Inside chat, `/voice on`, `/voice off`, `/voice status`, `/listen`, and `/exit` are local controls.
5. **Recall it later:** `/word 5` reviews vocabulary, `/review 5` reviews grammar, and `/quiz 3` gives fresh Chinese-to-English practice based on recorded mistakes.

`/listen` also remembers the latest correction, the English side of a translation, quiz feedback, a chat reply, or a revealed review answer. It works on demand even when automatic chat voice is off. Playback uses your existing TTS configuration. Listening and repeating are self-practice; IGT does not record or assess pronunciation.

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

IGT ships with two local model families you can switch between at any time — **Gemma 4** (Google) and **Phi-4** (Microsoft, 14B parameters — good quality, fits in 8 GB RAM). Pull whichever you want to use:

```sh
ollama pull gemma4:12b    # default family
ollama pull phi4          # alternative family
```

Each download is several GB and only needs to happen once. Inside IGT, switch families live with `/gemma` and `/phi`. To point a family at a different model, edit its `Ollama*Model` field in `igt_config.json` (run `ollama list` to see what you have installed).

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

The prompt will show the active model (e.g. `gemma4:12b ❯`). The first request may take 10–20 seconds while the model loads into memory; subsequent requests are faster.

---

## Features

### Grammar Checking

Type any English sentence at the prompt and press Enter. IGT sends it to the AI and returns a structured analysis — correction, a more natural rewrite, diagnosis by error type, rule, and tip. Complex sentences with multiple errors are handled in a single pass, each diagnosed separately.

![Single error example](assets/01_grammar_check.png)

![Multiple errors example](assets/02_multiple_errors.png)

If your sentence has no errors, IGT confirms it and explains why it's correct — it won't invent problems.

Every check is saved to your local database and automatically generates a flashcard.

### Translation (`/translate` or auto-detect)

Translate Chinese text to English naturally. IGT automatically detects Chinese input at the main prompt and routes it to the translation engine, complete with nuance notes and idioms. Or, use `/translate <text>` (alias: `/tr <text>`).

![Translation screenshot](assets/06_translate.png)

### Grammar Consultation (`/ask`)

Ask multi-turn questions about English grammar. IGT queries its local reference database (`grammar_ref.db`) via native function-calling to provide grounded, reliable answers with source citations. Follow-ups in the same thread carry context.

![/ask screenshot](assets/08_ask.png)

When you exit the session, IGT prompts you to save. Choosing yes compacts the full thread into a single polished response and appends it as a dated entry to `03_Consultations.md` in your vault — readable in Obsidian, Typora, or any Markdown editor.

![Ask log screenshot](assets/09_ask_log.png)

### Conversation Practice (`/chat`)

Practice English by just talking. `/chat` opens a free-flowing conversation partner that chats naturally about whatever you bring up and keeps the exchange going with follow-up questions — it won't turn every reply into a lecture. After each of your messages it quietly checks *only* what you wrote for genuine mistakes and lists gentle corrections (original → natural version → a short friendly note), leaving your conversation uninterrupted.

Optionally, replies can be spoken aloud. Toggle voice on/off with `/voice`. Spoken output needs a local text-to-speech server — see the TTS notes under [Configuration Reference](#configuration-reference).

### Explain a Correction (`/explain`)

Just got a correction you don't fully understand? Run `/explain` (alias `/e`) and IGT opens an `/ask` thread pre-loaded with your last sentence, its correction, and the diagnosed errors — so you can dig into *why* without retyping anything. Add a specific question (`/explain why is "the" wrong here?`) or run it bare for a general walkthrough.

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

Every error you make generates a flashcard. The SM-2 algorithm schedules each card: answer correctly and the interval grows (1 day → 4 days → 10 days…); miss it and it resets to tomorrow. The answer is revealed with **diff highlighting** — changed words shown in green so you see exactly what was wrong. Over time you stop seeing cards for errors you've mastered.

![/review screenshot](assets/04_review.png)

Grading is exact-match first. If your answer differs in phrasing but is semantically correct, a quick AI call decides whether to accept it.

### Daily Plan (`/today`)

Shows today’s checked sentences, words added, and grammar/vocabulary cards reviewed—even on a vocabulary-only day. It lists exact due counts for both decks and suggests listening, writing, and conversation activities for everyday life and work.

When cards are due, choose `g` for five grammar cards, `w` for five vocabulary cards, or Enter to continue later. Review counts cover cards already in SQLite; `/word` also imports saved vocabulary notes.

### Analytics (`/stats`)

The stats dashboard provides a comprehensive view of your learning journey:

![/stats screenshot](assets/03_stats.png)

- **Effort Trend**: A visual 7-day chart of your input volume.
- **Mastery Breakdown**: Identifies your most frequent error types (Top 3 Priorities).

### Personalized Translation Quiz (`/quiz`)

`/quiz` turns the same real error history used by your handbook into active Chinese-to-English practice. It generates fresh Chinese prompts around your recurring grammar weaknesses, accepts valid English alternatives, and gives a score, corrected expression, and concise feedback in Chinese after every answer.

```text
/quiz                 # 5 questions from the last 30 days
/quiz 10              # 10 questions
/quiz 5 --days=0      # use all error history
```

### Error Handbook (`/handbook`)

The handbook turns your accumulated error history into a personalized reference document. Instead of generic grammar rules, it analyzes your actual mistakes, identifies your specific recurring sub-pattern (your "linguistic fingerprint"), and explains the root cause in terms of what you personally do wrong.

Run it from the command line:

```sh
node tools/igt-handbook.mjs --days=30
```

![/handbook screenshot](assets/05_handbook.png)

**What the generated file looks like:**

The output is a Markdown file structured for Obsidian (collapsible callouts, tables). Here is what a realistic excerpt looks like:

---

```markdown
# 📘 Personal English Error Handbook

> [!INFO] Generated with: GEMINI (gemini-2.5-pro) on 2026-05-07

> [!ABSTRACT] 📊 Performance Summary
>
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

> [!TIP] Coach's Note
> One targeted drill per day on the present perfect / simple past contrast will
> resolve 40% of your remaining error load.

## 🎯 Error Frequency Ranking

| Error Type             | Freq | Severity    |
| :--------------------- | :--- | :---------- |
| Verb Tense             | 64   | 🔴 Major    |
| Article Usage          | 28   | 🟡 Moderate |
| Preposition Usage      | 19   | 🟡 Moderate |
| Subject-Verb Agreement | 14   | 🟢 Minor    |
| Word Choice            | 11   | 🟢 Minor    |
| Punctuation            | 9    | 🟢 Minor    |

## 📈 Weekly Trend

| Week    | Errors            |
| :------ | :---------------- |
| 2026-17 | ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 14 |
| 2026-18 | ▓▓▓▓▓▓▓▓▓▓▓ 11    |
| 2026-19 | ▓▓▓▓▓▓▓▓ 8        |
| 2026-20 | ▓▓▓▓▓ 5           |

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
> > be used with it. Simple past ("saw") is required.
> > **Rule**: Present perfect = no specific time anchor. Simple past = specific
> > time anchor (yesterday, last week, in 2020).
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
>
> English tense encodes not just time but the speaker's relationship to the event.
> Present perfect signals relevance to the present moment; simple past closes the
> event as finished history. The two are not interchangeable.
>
> #### Detected Habit
>
> _"The Yesterday Trap"_ — you consistently reach for present perfect when narrating
> recent past events, then attach a specific time adverb that contradicts it.
>
> #### Root Cause
>
> In Mandarin, aspect markers (了, 过) indicate completion without tense distinction,
> so the present-perfect / simple-past contrast has no direct L1 equivalent —
> learners default to the "more complete-sounding" form.
>
> #### Before / After
>
> | ❌ User wrote                        | ✅ Should be                    | Why                          |
> | :----------------------------------- | :------------------------------ | :--------------------------- |
> | I have seen him yesterday.           | I saw him yesterday.            | specific time = simple past  |
> | She has graduated last June.         | She graduated last June.        | "last June" anchors the past |
> | We have finished the report at 5 PM. | We finished the report at 5 PM. | clock time = simple past     |
>
> #### The Rule
>
> - Use **simple past** whenever a specific time expression is present
>   (yesterday, last week, in 2020, at 3 PM, when I was young).
> - Use **present perfect** when no time is specified and the focus is on
>   the current result or relevance (I've lost my keys — they're still missing).
> - Never combine present perfect with a specific past-time adverb.
> - In compound predicates ("she graduated and found"), both verbs must match.
>
> #### Mnemonic
>
> _"Specific time? Simple past every time."_
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

### Vocabulary Lookup (`/add`)

Look up any word and save it to your local Markdown vocabulary vault. Review saved words with `/vocab`.

![/add and /vocab screenshot](assets/07_vocab.png)

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

Start IGT with `igt`. All commands use a `/` prefix. Most have a short alias (shown in parentheses).

| Command            | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `/review` (`/r`)   | SRS review session — drills all grammar flashcards due today      |
| `/word` (`/w`)     | SRS review of your saved vocabulary; `/word --list` to browse     |
| `/today` | Grammar and vocabulary review counts, listening, writing, and conversation |
| `/stats` (`/st`)   | Factual activity, recurring errors, mastery, and review statistics |
| `/handbook` (`/h`) | Generate your personal error handbook (runs as background task)   |
| `/practice` (`/p`) | Practice session targeting your top error types                   |
| `/practice B2 10`  | Practice at CEFR level B2, 10 questions                           |
| `/quiz [1-10]`     | Personalized Chinese-to-English quiz with per-answer feedback     |
| `/ask`             | Open a multi-turn grammar consultation thread (opt-in save)       |
| `/chat`            | Free-conversation practice with gentle corrections (optional voice) |
| `/explain` (`/e`)  | Explain your last grammar correction in an `/ask` thread          |
| `/translate` (`/tr`) | Translate between Chinese and English (auto-detects direction)  |
| `/add <words>` (`/a`) | Look up one or more comma-separated words and save them to your vocab vault |
| `/retry`           | Re-run your last input with the same model                        |
| `/undo [N]` (`/u`) | Delete the last N inputs and their flashcards (default: 1)        |
| `/voice [on\|off\|status]` | Control automatic chat speech, including inside `/chat` |
| `/listen [text]` | Replay the latest English expression or supplied text; `--stop` stops audio |
| `/gemini`          | Switch to Google Gemini                                           |
| `/qwen`            | Switch to Alibaba Qwen                                            |
| `/deepseek`        | Switch to Deepseek                                                |
| `/ollama`          | Switch to the default local Ollama model                         |
| `/phi`             | Switch to local Phi-4 (Ollama)                                    |
| `/gemma`           | Switch to local Gemma 4 (Ollama)                                 |
| `/llm status`      | Show active provider, configured keys, and model names            |
| `/theme`           | Switch the UI color theme                                         |
| `/help`            | Show command reference                                            |
| `/exit` (`/q`)     | Quit (shows session summary first)                                |

**Keyboard shortcuts:**

- `↑` / `↓` — browse input history
- `Ctrl+C` — clear current input and return to prompt (does not exit)
- `"""` — enter multiline input mode

---

## Configuration Reference

IGT uses two configuration files:

| File              | Tracked by git | Purpose                                |
| ----------------- | -------------- | -------------------------------------- |
| `.env`            | No             | API keys, file paths, themes (private) |
| `igt_config.json` | Yes            | Model names, prompts (shared)          |

### `.env` (common settings)

The shipped `.env.example` is a fully annotated template — copy it and fill in what you need. The most common settings:

```env
# --- AI Provider Keys ---
GOOGLE_API_KEYS=key1,key2        # comma-separated; IGT rotates on rate-limit
DASHSCOPE_API_KEYS=your-key      # Qwen / Alibaba DashScope
DEEPSEEK_API_KEYS=your-key       # Deepseek
IGT_LLM_PROVIDER=gemini          # gemini | qwen | deepseek | ollama

# --- Model overrides (optional; override igt_config.json per provider) ---
IGT_GEMINI_FLASH_MODEL=          # e.g. gemini-2.5-flash
IGT_QWEN_PRO_MODEL=              # e.g. qwen-plus, qwen-max
IGT_OLLAMA_FLASH_MODEL=          # e.g. phi4, gemma4:12b

# --- File Paths & Settings ---
IGT_DB_PATH=igt_data.db          # SQLite database (auto-created on first run)
IGT_LOG_PATH=igt_db_error.log    # background error log
IGT_GRAMMAR_REF_DB_PATH=grammar_ref.db # Grammar reference database for /ask
IGT_THEME=auto                   # auto | light | dark; changes semantic colors only
IGT_REVIEW_PATH=                 # optional: path to a Markdown corrections log
IGT_REPORT_PATH=                 # folder for handbook exports

# --- Obsidian Integration (optional) ---
IGT_VAULT_DIR=                   # root of your Obsidian vault
IGT_VOCABULARY_FILE=             # vocabulary note path within vault
IGT_PRACTICE_FILE=               # practice log path within vault
IGT_ASK_FILE=                    # /ask consultation log (single file) within vault
IGT_ASK_DIR=                     # /ask separate-notes directory within vault

# --- Text-to-Speech (optional; /chat voice, /review [a]) ---
IGT_TTS_BASE_URL=http://localhost:8880  # OpenAI-compatible /v1/audio/speech server
IGT_TTS_SIDECAR=                 # adapter script to auto-launch (blank = none)
IGT_TTS_STREAM=false             # low-latency ffplay streaming (needs ffmpeg)
IGT_TTS_VOICE=                   # optional; defaults to af_heart
IGT_TTS_MODEL=                   # optional; defaults to kokoro
```

> **Text-to-speech.** Spoken replies in `/chat` (and the `[a]` key in `/review`) need a local TTS server speaking the OpenAI `/v1/audio/speech` protocol, reachable at `IGT_TTS_BASE_URL`. Two backends are supported:
>
> - **Kokoro** (default) — a native OpenAI-compatible server with preset voices ([Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI) on port `8880`). No adapter needed.
> - **CosyVoice3** — clones a reference voice (cross-lingual). It runs behind a small local shim (`tools/cosyvoice-tts-shim.mjs`, auto-launched via `IGT_TTS_SIDECAR`) that fronts a CosyVoice Docker container. See the CosyVoice profile in `.env.example` and `tools/cosyvoice/` for setup.
>
> Switch backends by swapping which profile is active in `.env`, then restart `igt`. If no server is reachable, IGT prints a one-time notice and stays silent — text output is unaffected. Toggle voice with `/voice`.

### `igt_config.json` (excerpt)

```json
{
  "LLMProvider": "gemini",
  "GeminiFlashModel": "gemini-2.5-flash",
  "GeminiProModel": "gemini-2.5-pro",
  "QwenFlashModel": "qwen-turbo",
  "QwenProModel": "qwen3.6-plus",
  "DeepseekFlashModel": "deepseek-v4-flash",
  "DeepseekProModel": "deepseek-v4-pro",
  "OllamaBaseUrl": "http://localhost:11434",
  "OllamaFamily": "gemma",
  "OllamaGemmaFlashModel": "gemma4:12b",
  "OllamaPhiFlashModel": "phi4"
}
```

Flash models handle grammar correction (speed-optimized); Pro models handle handbook and practice generation (quality-optimized). Ollama supports two local model families — switch between them in-session with `/gemma` and `/phi`, or set `OllamaFamily`. To use a different local model, update the matching `Ollama*Model` field — run `ollama list` to see what you have installed.

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

Apache 2.0
