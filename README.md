# ClearWrite — Write with clarity

[English](README.md) | [简体中文](README.zh.md)

ClearWrite is the local Web app in **IGT (Interactive Grammar Tool)**. It brings English writing feedback, expression coaching, vocabulary, sentence translation practice, and language questions into one workspace. IGT also includes a command-line companion.

Learning records are stored locally in SQLite and Markdown. When you choose an online AI provider, the text needed for a request is sent to that provider. Ollama is available for local model inference.

## Contents

- [Quick start](#quick-start)
- [The Web workspace](#the-web-workspace)
- [AI providers](#ai-providers)
- [CLI companion](#cli-companion)
- [Configuration and local data](#configuration-and-local-data)
- [Development and verification](#development-and-verification)
- [Deployment and operations](#deployment-and-operations)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Quick start

Use **Node.js 24 LTS** (the project's Windows environment uses v24.16.0), npm, and Git. The commands below use PowerShell and run from the project folder.

### 1. Install and configure

```powershell
git clone https://github.com/ievertan00/igt.git
Set-Location igt
npm ci
Copy-Item .env.example .env
```

`npm ci` installs from the tracked `package-lock.json` for a reproducible dependency set. Copy the template only for a new installation; preserve an existing `.env`. Open it in a text editor and configure an AI provider. For example:

```env
IGT_LLM_PROVIDER=gemini
GOOGLE_API_KEYS=your-api-key
```

See [AI providers](#ai-providers) for Qwen, Deepseek, and Ollama. Keep API keys and machine-specific configuration in `.env`, which is ignored by Git.

### 2. Prepare local storage

```powershell
npm run init-db
```

This creates or updates the configured SQLite database through migrations. The Runtime also applies pending migrations on startup. Existing installations normally only need to restart after an update.

### 3. Open the Web app

For development:

```powershell
npm run web:dev
```

This starts Vite and the Local Runtime together. Open the Web URL printed in the terminal. Development ports come from `IGT_WEB_PORT` and `IGT_DEV_API_PORT` in `.env`.

Use `npm run dev:status`, `npm run dev:stop`, or `npm run dev:restart` from any terminal. Closing the foreground terminal stops the Windows development instance; use `npm run dev:start -- --background` to keep it running deliberately. See [development service management](DEV-SERVICES.md) for preview instances and cleanup of older unregistered services.

For a production build served locally:

```powershell
npm run web:build
npm run web:start
```

`web:start` runs `node --env-file=.env apps/local/server.mjs`: the `.env` file must exist, and its `IGT_SERVER_HOST` / `IGT_SERVER_PORT` values control the binding. The defaults are `127.0.0.1` and `IGT_SERVER_PORT=0` (an available port); set a fixed port for a stable address. The Runtime serves `apps/web/dist` without opening the CLI.

To use the app from a phone or another computer on the same trusted network, set `IGT_SERVER_HOST=0.0.0.0` with a fixed port and open `http://<host-LAN-IP>:<port>`. There is no login — anyone on that network receives full server capabilities — so only do this on a trusted LAN and never expose the port to the internet. The Runtime rejects unknown Host headers and cross-origin browser requests, caps POST bodies at 2 MB, and disables the server-desktop file picker when listening beyond loopback. See [Deployment and operations](#deployment-and-operations) for running it as a managed service.

## The Web workspace

| Workspace | What you can do |
| --- | --- |
| **Writing → Grammar** | Check an English sentence or passage, compare corrections and refinements, and ask follow-up questions about the feedback. |
| **Writing → Express** | Turn a Chinese idea into natural English, or understand an English passage in Chinese. Include context and the tone you want. |
| **Vocabulary** | Look up English words or Chinese expressions, read meanings and examples, and save entries for review. |
| **Review** | Recall saved vocabulary from a clue, reveal the answer, and rate recall as **Again / Hard / Good / Easy**. |
| **Practice** | Translate Chinese sentences into English, reveal progressive hints, and compare your answer with feedback and a reference. |
| **Ask** | Discuss grammar, word choice, tone, and usage; save an answer or summarize and save a conversation. |
| **My learning → Overview** | Survey saved material and recent performance: inventory cards for saved words, Grammar corrections, Ask notes, and reports; a performance snapshot compared with the previous period; trends with metric switching, a data table, and period comparison; drill into the underlying records; and open the Practice log. |
| **My learning → Saved words** | Search and browse the Markdown vocabulary library, open entry details, and start vocabulary review. |
| **My learning → Saved notes** | Search saved Ask notes, filter by category and topic, and continue a discussion. |
| **My learning → Handbook** | Browse saved Grammar checks, newest first, with search and mistake-type filters. |
| **My learning → Learning reports** | Generate a proficiency report from saved Grammar checks and the Practice log: choose a time window and report language, review recurring error patterns and improvement directions, revisit saved reports, and download Markdown. |
| **Settings** | Configure models and Markdown file locations. |

The interface defaults to English. **中文引导** adds beginner guidance while keeping English examples, target expressions, and learner content in their original language. Ask has separate **Answer language** and **Note language** controls for generated explanations and conversation summaries.

### Writing and saved Grammar checks

Grammar handles the complete submitted passage, including numbered or bulleted items. Review the correction, rewrite, and diagnosed mistakes, then choose **Save to review log** when you want to keep the result. Generating feedback alone does not save a learning record or automatically create a flashcard.

Handbook shows only saved Grammar checks, with legacy records of unknown source labeled separately.

### Overview and Learning reports

**My learning** is a direct entry in the Web app with five tabs: Overview, Saved words, Saved notes, Handbook, and Learning reports. Overview reads the currently configured data through the Local Runtime — no snapshot import needed. It pairs a full inventory of saved material with performance figures for the selected period; figures are annotated with the chosen time window or current retention state. Trends support metric switching, a data table, period comparison, and drilling down into the underlying records. A practice log view lists recorded Practice attempts.

Learning reports generate a report grounded in saved Grammar checks and the Practice log, reviewing proficiency, recurring error patterns, underlying knowledge gaps, and improvement directions. Only abilities supported by your saved writing are assessed; AI corrections and assisted answers do not establish mastery. Reports use only records explicitly identified as Grammar checks; Practice, full-text analysis, and unknown-source records are excluded. A check with **No diagnosed mistakes** is not proof of error-free writing or durable mastery.

### Sentence Practice

Practice selects questions from the configured SQLite question bank; starting a session does not require grammar history or an LLM request to generate questions. AI evaluates submitted translations.

- **Difficulty:** `easy`, `standard`, `challenge`.
- **Style:** `casual`, `neutral`, `formal`, or `all`.
- **Context:** `home`, `dining`, `shopping`, `entertainment`, `social`, `health`, `work`, `transit`, `travel`, `services`, or `all`.
- **Session size:** CLI accepts 1–10 questions; Web offers 3 / 5 / 10.

Questions are distinct within a session, with less-used questions selected first. A small category may return fewer questions. Reveal up to three progressive hints before checking; hint use is recorded with the attempt. Valid alternative translations can be accepted without matching the reference wording. A successful assisted answer is not evidence of independent mastery.

### Vocabulary and review

Saved words remain readable in Markdown. Browsing the library does not change review schedules. Vocabulary review asks you to recall the English expression, reveal the answer, then choose **Again / Hard / Good / Easy**. The rating saves the review and next due date; revealing the answer alone does not.

The Local Runtime synchronizes vocabulary Markdown into rebuildable SQLite SRS cards at startup, preserving existing scheduling fields. Starting a Web review session also imports saved vocabulary. Typed correctness and your chosen recall rating are separate evidence.

### Ask notes

Saving is optional. Save one answer as a Markdown note, or summarize a conversation using the selected note language. Notes include metadata for browsing by category and tags. New note filenames use a generated Simplified Chinese title, retaining relevant English terms; the title language is separate from the explanation language. Duplicate titles receive a suffix instead of overwriting another note.

## AI providers

Choose a provider in `.env` and supply its keys where required. Model names and prompts live in `igt_config.json`; environment overrides take precedence. Provider availability, limits, and billing depend on your provider account.

| Provider | `.env` settings | Key management |
| --- | --- | --- |
| Google Gemini | `IGT_LLM_PROVIDER=gemini`, `GOOGLE_API_KEYS=...` | [Google AI Studio](https://aistudio.google.com/apikey) |
| Alibaba Qwen | `IGT_LLM_PROVIDER=qwen`, `DASHSCOPE_API_KEYS=...` | [DashScope](https://dashscope.console.aliyun.com/apiKey) |
| Deepseek | `IGT_LLM_PROVIDER=deepseek`, `DEEPSEEK_API_KEYS=...` | [Deepseek platform](https://platform.deepseek.com/api_keys) |
| Local Ollama | `IGT_LLM_PROVIDER=ollama` | No API key required |
| Custom OpenAI-compatible service | `IGT_LLM_PROVIDER=custom`, `IGT_CUSTOM_API_BASE=...`, `IGT_CUSTOM_API_KEYS=...` | Managed by your chosen service |

Key lists support comma-separated values. Use Web **Settings** or CLI `/provider status` to inspect configuration.

For a custom service, also set `IGT_CUSTOM_FLASH_MODEL` and `IGT_CUSTOM_PRO_MODEL` to model IDs supported by that endpoint, or configure them in Web Settings.

For Ollama, install it from [ollama.com](https://ollama.com/download), download a model supported by your machine, and set the matching override:

```env
IGT_LLM_PROVIDER=ollama
IGT_OLLAMA_FLASH_MODEL=your-installed-model
IGT_OLLAMA_PRO_MODEL=your-installed-model
```

Use `ollama list` to see installed models. If the service is not running, start `ollama serve` in a separate terminal. Local inference needs sufficient RAM and, depending on model size, GPU resources.

## CLI companion

From the project folder:

```powershell
node igt.mjs
```

Optionally run `npm link` once to register the global `igt` command. Type an English sentence at the prompt for Grammar feedback; the CLI asks whether to save it to the review log.

| Command | Purpose |
| --- | --- |
| `/word <word or phrase>` (`/w`, `/a`) | Look up vocabulary and choose whether to save it. |
| `/word --list` | Browse saved vocabulary. |
| `/word review [1-100]` | Review vocabulary with four recall ratings. |
| `/practice [1-10]` (`/p`) | Start Chinese-to-English sentence practice. |
| `/text` | Open an editor and analyze a complete document. |
| `/translate <text>` (`/tr`) | Translate text. |
| `/ask` | Start a language consultation with optional saving. |
| `/chat` | Practise conversation with gentle corrections. |
| `/handbook` (`/h`) | Browse and filter saved Grammar checks. |
| `/coach` | Analyze recurring mistakes in saved Grammar checks and request explanations. |
| `/stats` (`/st`) | Show recorded activity and a timeline. |
| `/provider status` | Show provider and model configuration. |
| `/provider switch <provider>` | Switch AI providers. |
| `/voice [on\|off\|status]` | Control automatic chat speech. |
| `/theme` | Select a terminal theme. |
| `/help` | Show the current public command reference. |
| `/exit` (`/quit`, `/q`) | Exit the CLI. |

Examples at the IGT prompt:

```text
/word follow up
/practice 5 --difficulty easy --context home
/practice sentence 3 --style formal --context work
/handbook --days 90 --search "meeting" --type "Articles"
/handbook --diagnosis none
/coach --days 90 --type "Articles"
/stats --days 30 --limit 10
```

Compatibility commands include `/today` for daily activity and review counts, `/explain` (`/e`) for discussing the latest correction, and `/llm` as an alias for `/provider`. Use `/help` for the current main command surface. For complete documents, use `/text` to open the editor.

## Configuration and local data

[.env.example](.env.example) is the annotated configuration template. Restart the affected process after editing startup settings.

| Setting | Purpose |
| --- | --- |
| `IGT_DB_PATH` | Primary SQLite database, including Practice questions, attempts, and SRS scheduling. |
| `IGT_GRAMMAR_REF_DB_PATH` | Local grammar reference database used by Ask. |
| `IGT_LOG_PATH` | Technical and database error log. |
| `IGT_REVIEW_PATH` | Markdown log for explicitly saved Grammar checks. |
| `IGT_DATA_DIR` | Optional common data directory; explicit paths take precedence. |
| `IGT_VOCAB_PATH` | Explicit vocabulary Markdown path. |
| `IGT_ASK_PATH` | Explicit Ask notes path. |
| `IGT_PRACTICE_PATH` | Explicit Practice Markdown log path. |
| `IGT_VAULT_DIR` | Optional Obsidian vault root. |
| `IGT_SERVER_HOST`, `IGT_SERVER_PORT` | Production Runtime binding. `0.0.0.0` enables trusted-LAN access; use a fixed port. |
| `IGT_ALLOWED_HOSTS` | Optional extra Host/Origin allowlist entries (comma-separated) beyond loopback, the machine name, and its interface addresses. |
| `IGT_DEV_API_PORT`, `IGT_WEB_PORT` | Development API and Web ports. |

Older vault-relative settings remain documented in `.env.example`. Markdown exports are user-readable learning records; SQLite owns vocabulary scheduling and recorded attempts. The actual configured database is the authority for Practice question content; `canonical-questions.json` is its versioned export. Do not replace live data with a test database or historical seed.

Back up both the configured database and Markdown records before moving data or repairing migrations. `node scripts/deploy/backup.mjs --dest <dir>` takes a consistent snapshot (SQLite Backup API plus vault and configuration) without stopping the service; see [Deployment and operations](#deployment-and-operations). If you instead copy the `.db` file manually, stop processes using SQLite first so committed data is not left in a WAL file.

### Optional speech

CLI chat voice uses an OpenAI-compatible `/v1/audio/speech` service. Configure `IGT_TTS_BASE_URL`, with optional voice, model, streaming, and sidecar settings in `.env.example`. Profiles are provided for Kokoro and a CosyVoice3 adapter. Streaming through `ffplay` requires FFmpeg. Web audio controls can fall back to browser speech when server audio fails. The app does not record or assess pronunciation.

## Development and verification

```powershell
npm run web:typecheck
npm run web:build
npm run test:learning
npm run test:my-learning
npm run verify-learning-resources
```

Focused Web and Runtime checks include `test:web-dev`, `test:runtime`, `test:static`, `test:web`, `test:my-learning-web`, `test:handbook-web`, `test:practice-web`, `test:coach-cache`, `test:vocabulary-sync`, `test:review-log-contract`, and `test:config-paths`. Browser checks require a usable Chromium installation; configure `PUPPETEER_EXECUTABLE_PATH` if needed. There is no single full-suite npm script.

Before changing Practice content, read [the storage contract](lib/features/practice/SCHEMA.md) and run `npm run verify:practice-bank` before and after the change. Deliberately export approved live edits with `npm run export:practice-bank`. Test databases must remain disposable and must not overwrite live content.

For an API/UI restart that skips startup vocabulary synchronization:

```powershell
node scripts/web-dev.mjs --skip-vocabulary-sync
```

Production supports the same flag on `node --env-file=.env apps/local/server.mjs --skip-vocabulary-sync`. Starting a Web review session still imports saved vocabulary.

## Deployment and operations

The first-version deployment model is single user, single instance, persistent disk, and controlled access on an always-on machine. [WEB-DEPLOYMENT-PLAN.md](WEB-DEPLOYMENT-PLAN.md) records the full design, security boundary, and acceptance checklist.

- **Release directory.** Build each release from an explicit commit into a separate directory: `git archive <commit>` extracted there, then `npm ci`, `npm run web:typecheck`, `npm run web:build`. Keep a deployment `.env` in that directory with absolute paths to the live database and Markdown vault, and carry it forward on upgrades so code updates never overwrite configuration or data. Keep a single writer: stop the development chain (`npm run dev:stop`) before starting the release instance.
- **Service supervisor.** `node scripts/deploy/service-launcher.mjs --logs <dir>` runs the Runtime with `--env-file=.env`, restarts it after crashes with backoff, writes one log file per day, and prunes logs older than 14 days.
- **Scheduled tasks.** `scripts/deploy/register-tasks.ps1 -ReleaseDir <dir> -BackupDir <dir> -LogDir <dir>` registers current-user tasks for the Runtime (at logon) and a daily backup. Without elevation the trigger is logon-based; starting before logon requires an administrator to register an S4U task or a Windows service.
- **Backup and restore.** `node scripts/deploy/backup.mjs --dest <dir> [--mirror <dir>]` writes a consistent SQLite Backup API snapshot plus the Markdown vault and configuration with a checksum manifest, keeping 14 daily and 8 weekly snapshots; `--mirror` copies each snapshot to a second location for off-machine retention. `node scripts/deploy/restore.mjs --backup <dir> --target <isolated-dir>` restores into an isolated directory and verifies checksums, integrity, and row counts. Never restore over live data while the service is running.
- **Readiness.** `GET /health` reports `checks.database` alongside uptime; treat `status: "ok"` as ready rather than relying on process liveness alone.

## Architecture

The React Web client and CLI call a shared local HTTP Runtime. The Runtime handles model requests, migrations, SQLite persistence, and Markdown workflows.

| Location | Responsibility |
| --- | --- |
| `igt.mjs`, `lib/cli/` | Interactive CLI, command routing, rendering, and API client. |
| `apps/web/` | React + TypeScript client built with Vite. |
| `apps/local/server.mjs` | Independent Local Web Runtime entry point. |
| `lib/server/` | HTTP routes and LLM provider integration. |
| `lib/application/` | Application workflows, including Grammar analysis and saving. |
| `lib/domain/`, `lib/features/` | Learning rules, parsing, and feature workflows. |
| `lib/db/`, `migrations/` | SQLite access and schema/data migrations. |
| `lib/shared/` | Configuration and shared utilities. |
| `scripts/`, `tests/` | Maintenance tools and verification. |

## Troubleshooting

- **Development port occupied:** inspect `npm run dev:status` and stop the managed instance with `npm run dev:stop`. For old services, inspect `npm run dev:status -- --legacy` before using `npm run dev:stop -- --legacy`. See [development service management](DEV-SERVICES.md). Configure different ports in `.env` only for intentionally parallel services.
- **Production page unavailable:** run `web:build` before `web:start`, confirm `.env` exists (it is loaded explicitly), and use the printed Runtime URL or the fixed `IGT_SERVER_PORT`.
- **Phone cannot reach the LAN address:** confirm both devices are on the same network, the host firewall allows inbound TCP on the chosen port (administrator rule), and `IGT_SERVER_HOST=0.0.0.0`. The host LAN IP can change under DHCP. Plain-HTTP LAN pages are supported; clipboard and review sessions fall back automatically outside secure contexts.
- **`/health` reports degraded:** the database check failed — verify the configured path and that only one writer (the release instance, not the dev chain) is using it.
- **Provider error or rate limit:** check credentials, model settings, and provider status; retry when the provider permits it.
- **Grammar missing from Handbook or Learning reports:** save the result to the review log. Learning reports also exclude legacy records with an unknown source.
- **Database locked or migration failed:** close processes using the database, inspect the configured error log, and preserve a backup before repair. Deleting the database erases local state and is not a routine fix.
- **Missing grammar reference resources:** run `npm run verify-learning-resources` and inspect its report; `init-db` prepares the primary database, not an external reference corpus.

## License

Apache 2.0
