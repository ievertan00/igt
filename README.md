# ClearWrite · Local AI for English Writing and Learning

**English** · [简体中文](README.zh.md)

> **Learn how native English speakers would phrase it, one draft at a time.** ClearWrite uses local AI to suggest natural wording and explain why it fits the situation.

## Contents

[1. What it is](#1-what-it-is) · [2. Feature map](#2-feature-map) · [3. Features in detail](#3-features-in-detail) · [4. One complete learning loop](#4-one-complete-learning-loop) · [5. Three ways to use it](#5-three-ways-to-use-it) · [6. Your records and privacy](#6-your-records-and-privacy) · [7. Quick start](#7-quick-start) · [8. CLI command reference](#8-cli-command-reference) · [9. Further reading and licence](#9-further-reading-and-licence)

---

## 1. What it is

ClearWrite is an AI tool for learning English through the writing you already do. Your emails, messages, and documents make good learning material because they contain the things you actually need to say. When a sentence gives you pause, you have a reason to work out which words go together and how to put them in order.

Natural English depends on who you're writing to and what you want them to take from the message. ClearWrite helps you understand how native speakers choose words, sentence structures, and tone for a given situation. AI can explain how a phrasing is likely to land. You decide what best conveys your meaning and carry that judgment into the next thing you write.

Real drafts often contain personal or work information, so ClearWrite is designed to run locally. You can process drafts with a local AI model and decide what to keep.

**Your learning material belongs to you.** Most of it, including saved vocabulary, writing corrections, notes, and practice logs, lives in Markdown (`.md`) files on your computer. Even if ClearWrite stops being maintained, you can keep opening, organising, and using those files with any text editor.

---

## 2. Feature map

| Area | Web entry | What it does | How it helps you learn |
| --- | --- | --- | --- |
| Writing and expression | **Writing → Refine / Express** | Whole-passage feedback, optional refinements, error diagnosis, follow-up questions, two-way Chinese/English expression | Moves you from "it was corrected" to "I know why", with the edit kept inside your own sentence |
| Vocabulary and recall | **Vocabulary / Review / Saved words** | Two-way lookup, saved entries, active recall with four graded ratings and spaced review | Separates "I looked it up" from "I can produce it", and brings words back according to recall |
| Sentence production | **Practice** | Chinese-to-English prompts from a local bank, difficulty and context filters, three progressive hints, answer feedback | Trains active production from meaning to sentence, and distinguishes unaided answers from hinted ones |
| Questions and notes | **Ask / Saved notes** | Usage questions, examples, saving a single answer or a whole discussion as a structured note | Turns scattered questions into a searchable personal reference with categories and topics |
| Records and diagnosis | **My learning** (Overview / Saved words / Saved notes / Handbook / Learning reports) | Inventory and trends, filtering by mistake type, Coach reports grounded in real records | Turns "I think I always get articles wrong" into checkable evidence, and shows what to practise next |
| Settings and helpers | **Settings**, selection lookup, audio | Model and Markdown locations, look up any selected text in place, optional read-aloud | Keeps the mechanics out of the way so attention stays on the language |

---

## 3. Features in detail

### 3.1 Writing and expression · Writing

**Writing → Refine** handles a single sentence or a whole passage, including paragraphs, numbered lists and bullet lists. Feedback is structured in five layers: **Evaluate** (overall assessment) → **Correction** (the necessary edit) → **More natural** (optional refinement) → **Why** (diagnosis by mistake type) → **Remember** (a memory cue, i.e. Tips). Required changes and "a more natural way to say it" are shown separately, so you can change one word and keep the meaning you intended.

**A complete example: the most common sentence in an email closing** (three necessary edits spanning gerunds, time prepositions and verb patterns, plus one optional refinement):

> Submitted: *I am looking forward to meet you at next Friday and discuss about the details of our cooperation.*

- **Evaluate**: The meaning is clear, but three edits are needed, along with one optional improvement to tone.
- **Correction**: *I am looking forward to meeting you next Friday and discussing the details of our cooperation.*
- **More natural**: *I'm looking forward to seeing you next Friday and talking about possible cooperation.*
- **Why**:
  1. **meeting / discussing** — the *to* in *look forward to* is a preposition, not an infinitive marker, so it takes a noun or a gerund (-ing). Both *meet* and *discuss* are governed by this *to*, so they become *meeting / discussing*. Contrast *I hope to meet you*, where *to* introduces an infinitive and the base form *meet* is correct.
  2. **next Friday** — with *next / this / last* plus a time noun (such as *next Friday* or *last week*), the phrase already expresses time, so no preposition is needed; *at next Friday* is redundant.
  3. **discuss** — *discuss* is transitive and takes a direct object: say *discuss the details*, not *discuss about something*.
  4. **Optional (the More natural version)** — *seeing you / talking about possible cooperation* sounds more natural and better suits an email closing than *meet you / discuss the details of our cooperation*, with the same meaning.
- **Remember (Tips)**: when you see *look forward to*, think "to is a preposition, so use -ing" (the same goes for *be used to doing* and *object to doing*); don't put a preposition before *next / last / this* plus a time noun; and don't add *about* after the transitive verb *discuss*.

You can keep asking underneath the feedback until the rule makes sense. After submitting *If I would have known about the meeting, I would have told you.*, ask "Why can't the if-clause use *would have*?" — a third conditional uses the past perfect *had known* in the clause and *would have told* in the main clause.

Only **Save to review log** writes a learning record. Generating feedback saves nothing and creates no flashcards automatically. Select any English text on the page to look it up in place.

**Writing → Express** works in both directions:

- **Chinese → English**: describe a Chinese idea, including who you are speaking to and the tone you want, and get a natural English version plus wording notes. Try "我想问同事能不能把会议挪到周五，语气客气一点".
- **English → Chinese**: paste a colleague's reply or an unfamiliar English passage to understand its meaning and implied tone in context.

> **Why it helps**: the correction is stored with your original sentence and its context, so the next time you write a similar email you revisit a concrete problem rather than an abstract rule. Two-way expression closes both gaps — not being able to say it, and not being quite sure what was meant.

### 3.2 Vocabulary and recall · Vocabulary / Review

**Vocabulary** accepts an English phrase (such as *follow up on*) or a Chinese expression (such as 跟进), and shows meanings, examples and common combinations before you decide whether to save it. **Saved words** is a searchable Markdown library with entry details and a direct route into review.

**Review** is recall first, checking second: read the clue and try to produce the English expression → reveal the answer → rate the recall **Again / Hard / Good / Easy** → let the scheduler set the next review. The IPA is revealed on demand so it cannot give the answer away. Only submitting a rating records the review and the next due date; browsing the library never changes the schedule, and whether your typed answer matched is recorded separately from your self-rating.

> **Why it helps**: active recall builds longer-lasting memory than re-reading, and the four ratings keep "I recognise it" distinct from "I can say it" — so a lookup history is never mistaken for vocabulary you can use.

### 3.3 Sentence production · Practice

- **Choosing questions**: the Web app offers 3 / 5 / 10 questions, difficulty **easy / standard / challenge**, and contexts **home, dining, shopping, entertainment, social, health, work, transit, travel, services** or all of them. The CLI also accepts 1–10 questions and `--style casual|neutral|formal`. Pick travel before a trip, work before a meeting. Questions come from the local bank, so starting a session needs no history and generates nothing on the fly.
- **Answering**: write your own English first. If you get stuck, reveal hints one step at a time — **Simple hint → Intermediate hint → Complete pattern** — up to three levels, with the last giving only a sentence pattern rather than writing it for you.
- **Comparing**: submit to see feedback and a reference translation. Different wording still works if it conveys the intended meaning; an exact match is not required.
- **Keeping the trace**: each attempt records which hints you used. **Overview → Practice log** shows which sentences you wrote unaided and which are worth retrying with hints hidden.

> **Why it helps**: this trains active production from a meaning to a sentence, not multiple-choice recognition. Because hint usage is recorded honestly, an answer written with help is never mistaken for independent use.

### 3.4 Questions and notes · Ask

**Ask** is for working a usage question all the way through: start with "What's the difference between *follow up on the proposal* and *follow up with Alex*?", ask for an example of each, then paste a sentence of your own into the same conversation. **Answer language** and **Note language** are independent — you can understand a point in Chinese and file an English summary.

Save a single answer, or summarise the whole discussion into a Markdown note with a title, category and tags. **Saved notes** supports keyword search, category and topic filters, and starting a new discussion with an existing note as context (the original note stays unchanged).

> **Why it helps**: an explanation no longer disappears with the chat window. It becomes a searchable second grammar book, and understanding in one language while summarising in another is useful writing practice in itself.

### 3.5 Records and diagnosis · My learning

| Sub-page | What it shows | Use it to |
| --- | --- | --- |
| **Overview** | Saved-material inventory, performance snapshot versus the previous period, trends, error distribution, priorities and the practice log | See what you actually did in a period, then drill into the underlying records |
| **Handbook** | Saved Refine checks, filterable by time, keyword and mistake type | Revisit one class of correction in bulk — articles, for example |
| **Learning reports** | Choose a time window and report language; Coach draws on saved Refine checks and Practice attempts | Find recurring error patterns, likely gaps and a direction for practice; reopen saved reports or download Markdown |

**The evidence boundary is deliberate**: one AI correction, one hinted answer and one self-rating cannot establish durable mastery; reports only assess abilities supported by your writing records; **No diagnosed mistakes** means no issue was diagnosed in that check, not that the text is flawless. After understanding an edit, try the same structure in a new context a few days later without hints — that is the useful test.

### 3.6 Settings and helpers

- **Model settings**: save multiple named configurations, each built around a single model you define yourself — provider, endpoint, credentials and model ID are all up to you; choose a Web default or assign models per task.
  - **Web**: Writing, Translation, Word lookup, Practice, Coach and Ask each have their own model picker and remember their choice per browser, falling back to the default when unset.
  - **CLI**: `/model add` opens the model settings page, `/model list` shows all task assignments, `/model <task> name` assigns one, and `/model <task> reset` restores the default. Assignable tasks: grammar, translation, word, practice, text, ask, chat, coach.
  - **Match the model to the task**: point high-frequency, structured jobs like Refine at a local model (such as Ollama) to avoid spending online tokens, and point reasoning-heavy jobs like Ask and Coach at a paid state-of-the-art model for more reliable explanations and advice. The Web app and CLI share the same saved configurations, but keep their assignments separately (Web in the browser, CLI in `IGT_CLI_MODELS` in `.env`), without overwriting each other.
- **Markdown file settings**: choose where vocabulary, corrections, notes, the practice log and reports are saved, including an Obsidian vault.
- **Selection lookup**: select English or Chinese text on any page to look it up without switching pages.
- **Optional audio**: read-aloud for words and chat voice through a local OpenAI-compatible `/v1/audio/speech` service. The app does not record or assess pronunciation.

---

## 4. One complete learning loop

The modules are not a row of unrelated tools; they follow one language problem from start to finish:

1. **Write** — your email draft contains *I look forward to meet you on Friday.*
2. **Understand** — Refine points out *meet → meeting*; a follow-up clarifies the two roles of *to*.
3. **Save** — Save to review log files the original, the edit and the explanation in Handbook.
4. **Extend** — Express handles the same situation from Chinese ("politely ask to move the meeting"); Vocabulary adds *follow up on*.
5. **Practise** — write invitation and follow-up sentences unaided in a work-context Practice session; Review brings the phrase back a few days later.
6. **Inspect** — Overview shows the period's activity, Handbook filters by mistake type, Learning reports surfaces recurring patterns.
7. **Reproduce** — days later, in a new context, write it again without hints and compare against your first attempt.

This loop targets the most common gap in English learning: **it made sense at the time, but it never came back when you needed it**. Every step uses your own sentences, and what it leaves behind is a record you can return to — not a one-off score.

---

## 5. Three ways to use it

| Form | How to start | Best for |
| --- | --- | --- |
| **Web interface (main)** | `npm run web:start` | Everyday learning, the full feature set, Chinese guidance and visual reports |
| **CLI companion** | `node igt.mjs` | Terminal habits; type English for grammar feedback or Chinese for translation |
| **Android development app** | ADB-connected to the computer running ClearWrite | Writing, vocabulary, practice, questions and records on a phone, using the same data and model settings |

All three share one set of learning records and model configuration. See the [Android installation and connection guide](apps/android/README.md) ([中文](apps/android/README.zh.md)).

---

## 6. Your records and privacy

| Content | Stored in |
| --- | --- |
| Vocabulary, saved corrections, Ask notes, practice log, Coach reports | Local **Markdown** files (optionally an Obsidian vault) |
| Practice questions and attempts, vocabulary review schedule, activity records | Local **SQLite** database |

When you choose an online model, only the text needed for that request goes to the service you selected; a local model keeps processing on your computer. There is no account and no cloud sync. To back up your learning history, keep **both the database and the Markdown files**. Configuration and deployment/backup details: [.env.example](.env.example) and [deployment and backups](WEB-DEPLOYMENT-PLAN.md).

---

## 7. Quick start

Install Node.js 24, npm and Git. For a first installation, run these commands in PowerShell:

```powershell
git clone https://github.com/ievertan00/igt.git
Set-Location igt
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run web:build
npm run web:start
```

1. Keep the terminal open and visit the local address printed after **Ready on**. The interface opens in English; turn on **中文引导** for Chinese guidance.
2. Open **Settings → Model settings**, add a model you have access to and select it as the Web default, supplying the model ID, credentials and endpoint as applicable. For local Ollama, keep `IGT_LLM_PROVIDER=ollama` in `.env`, set `IGT_DEFAULT_MODEL` to an installed name from `ollama list`, start Ollama and restart ClearWrite.
3. Try the email sentence above in **Writing → Refine**. For later sessions, run `npm run web:start` from the project folder.

### Start from the command line

Run `node igt.mjs` from the project folder to open the interactive CLI. Type an English sentence for grammar feedback, or Chinese for a translation; everything else uses `/` commands (see the reference in the next chapter). The CLI and the Web app share the same learning records and model configuration.

To launch it by typing `igt` from any directory, run `npm link` once from the project folder. This registers the `igt` command declared in `package.json` as a global command:

```powershell
npm link
igt
```

After registering, you no longer need to return to the project folder to start a session, and code updates normally do not require re-linking. The CLI also needs a configured model: run `/model add` to add one and `/model default` to set the default, or configure it in the Web **Model settings** page.

---

## 8. CLI command reference

Run `node igt.mjs` from the project folder. At the prompt, **typing an English sentence checks its grammar** and **typing Chinese translates it**; everything else uses `/` commands. Use `/help <command>` for full options. The Web feature **Refine** is the same grammar workflow; the CLI keeps the grammar name.

| What you want to do | Try |
| --- | --- |
| Look up a phrase, list saved words, review five entries | `/word follow up on`, `/word --list`, `/word review 5` |
| Try three easy translation questions | `/practice 3 --difficulty easy` |
| Draft and analyse a whole passage in an editor | `/text` |
| Translate a piece of text | `/translate <text>` |
| Ask about usage or start an English conversation | `/ask When do I use "by Friday"?`, `/chat` |
| Revisit a month of corrections or recurring mistakes | `/handbook --days 30`, `/coach --days 30` |
| See activity | `/stats --days 30` |
| Add a model, set the default or task model | `/model add`, `/model default` |
| Voice and terminal theme | `/voice on`, `/theme` |
| Get command help or quit | `/help practice`, `/exit` |

---

## 9. Further reading and licence

[Configuration template](.env.example) · [Development services](DEV-SERVICES.md) · [Deployment and backups](WEB-DEPLOYMENT-PLAN.md) · [Android guide](apps/android/README.md)

Licensed under Apache 2.0.
