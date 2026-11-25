# Interactive Grammar Tool (IGT)

IGT is a Node.js CLI for English learning: grammar feedback, translation, vocabulary, listening, conversation, and production practice. User learning state is stored locally and important learning records can be exported to Markdown.

## Tech stack

- Node.js ESM application (`type: module` in `package.json`)
- SQLite through `better-sqlite3`
- Online LLM providers and optional local Ollama
- Optional local OpenAI-compatible TTS service

## Project structure

- `igt.mjs` — interactive CLI entry point
- `lib/cli/` — command dispatch, help, rendering, and API client
- `lib/domain/` — reusable learning and parsing rules
- `lib/features/` — feature workflows such as practice, handbook, modules, and text analysis
- `lib/server/` — local HTTP server, routes, and LLM provider integration
- `apps/local/` — independent Local Web Runtime entrypoint
- `apps/web/` — Vite + React + TypeScript desktop Web client
- `apps/mobile/` — standalone Vite + React + TypeScript mobile client, emitted to `apps/web/dist/mobile/` and served at `/mobile/`
- `apps/android/` — Java WebView shell (APK built by `apps/android/build.ps1`)
- `lib/db/` — SQLite access and persistence
- `migrations/` — schema migrations applied by `lib/db/migrations.mjs`
- `scripts/` — development and verification utilities: `scripts/smoke/` (Web/CLI acceptance smokes), `scripts/db/` (database, import, and indexing utilities), `scripts/deploy/`, `scripts/dev-runtime/`, `scripts/prompt-ab/` (auto and blind A/B harnesses); dev-only scratch scripts live in the ignored `scripts/dev/`
- `tests/` — Node test-suite
- `docs/` — project documentation and design notes
- `DESIGN.md` — UI design guidelines

## Development commands

Install dependencies with `npm install`.

- Initialize the database: `npm run init-db`
- Run the learning workflow tests: `npm run test:learning`
- Verify local learning resources: `npm run verify-learning-resources`
- Launch the CLI directly: `node igt.mjs`
- Build both clients (desktop + mobile, in this order): `npm run client:build`. `web:build` alone clears `apps/web/dist/` and leaves no `/mobile/` build.
- Build / type-check / hot-reload the mobile client: `npm run mobile:build`, `npm run mobile:typecheck`, `npm run mobile:dev`
- Build the Android APK: `npm run android:build` (requires JDK 17 + Android SDK Platform 36 / Build Tools 36.0.0)
- Type-check the Web client: `npm run web:typecheck`
- Run the independent Web development chain: `npm run web:dev`
- Run the production Local Web Runtime: `npm run web:start`
- Run Web acceptance checks: `npm run test:web-dev`, `npm run test:runtime`, `npm run test:static`, `npm run test:web`, `npm run test:coach-cache`, `npm run test:vocabulary-sync`, `npm run test:review-log-contract`, and `npm run test:config-paths`
- Run mobile acceptance checks: `npm run test:mobile-app` (static routing + 12 screens at 320–430 px, touch targets, dark mode, back/share/draft bridges; synthetic fixtures only)

There is no single full-suite npm script; run individual tests with `node --test tests/<file>.test.mjs` when needed.

## Important conventions

- Never read files under `docs/` (including subfolders) unless the user explicitly instructs you to do so. Saving files under `docs/` is allowed.
- Keep secrets, local paths, ports, and provider choices in `.env`; use `.env.example` as the template. Never commit `.env`.
- Preserve Markdown exports and vault files as the user-readable learning record. Practice question content is an exception: the actual configured `igt_data.db` is authoritative; never replace its content or usage with a test database, an old seed, or a historical report.
- For Practice, read `lib/features/practice/SCHEMA.md`. `canonical-questions.json` is a versioned export of the actual database, not a competing authority. Run `npm run verify:practice-bank` before and after changes; deliberately export live content changes with `npm run export:practice-bank`. Tests rebuild only in memory and never write to the actual database.
- Older Practice reports, archived database copies and graphify indexes are historical context; verify them against the live database and current source before using them. Never replay removed migrations 025–035 or their template expansion based on an old report.
- Public CLI commands and their help text are defined by `lib/cli/commands/dispatch.mjs`, `lib/cli/commands/help.mjs`, and `lib/cli/commands/registry.mjs`; update all three when changing the command surface.
- The main practice entry point is `/practice` for sentence translation from a seeded question bank, filtered by difficulty, style, and context. Vocabulary lookup and review are under `/word`.
- Preserve the evidence boundary in learning features: a correction or one successful answer is not proof of durable mastery.
- Vocabulary Markdown is the content authority; Local Runtime startup synchronizes it into rebuildable SQLite SRS cards without overwriting review scheduling state.

## Verification notes

The working tree may contain live SQLite `-wal`/`-shm` files and uncommitted feature work. Inspect `git status` before editing and do not reset, clean, or overwrite unrelated changes.

## UI Development Rules

For UI-related tasks:
- Read the root-level `DESIGN.md` before making design decisions.
- Follow the existing design tokens and shared components.
- Preserve product functionality and business logic.
- Do not independently introduce a new visual style.
- Verify rendered results in a browser when available.
- Check affected sibling pages after shared component changes.
- **Exception — `apps/mobile/`**: the Android client keeps an independent, mobile-first **layout system** (`apps/mobile/src/styles.css`, "Pocket Studio"): one-hand bottom navigation, thumb-zone actions, full-screen focus modes and bottom sheets. Its **colour palette is aligned with the ClearWrite Design System** (`DESIGN.md` §2 / `apps/web/src/visual-system.css`): slate canvas, white cards, obsidian primary actions, brand-green accents and web semantic colours; night mode is derived from the same hues. Do not reflow it to match desktop layouts or import desktop components/CSS, and do not introduce a second colour system — only colour values and the Local Runtime HTTP contract are shared. Changes to the mobile UI are verified with `npm run test:mobile-app`, not the desktop `test:mobile-ui` audit.
