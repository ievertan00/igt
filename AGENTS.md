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
- `lib/server/` — local HTTP server, routes, migrations, and LLM provider integration
- `lib/db/` — SQLite access and persistence
- `scripts/` — database, import, indexing, and verification utilities
- `tests/` — Node test-suite
- `docs/` — project documentation and design notes

## Development commands

Install dependencies with `npm install`.

- Initialize the database: `npm run init-db`
- Run the learning workflow tests: `npm run test:learning`
- Verify local learning resources: `npm run verify-learning-resources`
- Launch the CLI directly: `node igt.mjs`

There is no single full-suite npm script; run individual tests with `node --test tests/<file>.test.mjs` when needed.

## Important conventions

- Keep secrets, local paths, ports, and provider choices in `.env`; use `.env.example` as the template. Never commit `.env`.
- Treat SQLite as local rebuildable state. Preserve Markdown exports and vault files as the user-readable learning record.
- Public CLI commands and their help text are defined by `lib/cli/commands/dispatch.mjs`, `lib/cli/commands/help.mjs`, and `lib/cli/commands/registry.mjs`; update all three when changing the command surface.
- The main practice entry point is `/practice` with `word`, `sentence`, and `choice` modes. Vocabulary lookup and review are under `/word`.
- Preserve the evidence boundary in learning features: a correction or one successful answer is not proof of durable mastery.

## Verification notes

The working tree may contain live SQLite `-wal`/`-shm` files and uncommitted feature work. Inspect `git status` before editing and do not reset, clean, or overwrite unrelated changes.
