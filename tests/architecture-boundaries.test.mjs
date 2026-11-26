// Architecture boundary guard for the CLI client.
//
// The CLI is a client of the Local Runtime: business work must cross the HTTP
// contract, not reach into stateful internal layers by import. A handful of
// imports predate this rule; they are listed in KNOWN_EXCEPTIONS with a reason
// so the test blocks NEW leaks without breaking the current tree. When you
// migrate one of those calls to HTTP, remove its exception in the same change.
//
// See AGENTS.md "Directory layout principle" for the intended cut lines.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const cliRoot = path.join(projectRoot, "lib", "cli");

// Directories the CLI must never import from.
const FORBIDDEN_PREFIXES = ["lib/db/", "lib/application/", "lib/server/", "lib/features/", "apps/"];

// Each entry: "relative-source -> relative-target". Adding a new entry is a
// deliberate architecture decision and requires a reason in the comment.
const KNOWN_EXCEPTIONS = new Set([
  // Process discovery needs the runtime lock path before the HTTP server is up.
  "lib/cli/server-manager.mjs -> lib/db/runtime-lock.mjs",
  // Pure rendering helpers (no I/O, no state) — safe to share with the CLI.
  "lib/cli/commands/ask.mjs -> lib/features/ask/render.mjs",
  "lib/cli/commands/chat.mjs -> lib/features/ask/render.mjs",
  // Pure module metadata / validators (no I/O).
  "lib/cli/commands/dispatch.mjs -> lib/features/modules/catalog.mjs",
  "lib/cli/commands/practice.mjs -> lib/features/practice/question-bank.mjs",
  // Legacy terminal learning modules — terminal-only workflows, pending relocation to lib/cli.
  "lib/cli/commands/dispatch.mjs -> lib/features/modules/sentence.mjs",
  "lib/cli/commands/dispatch.mjs -> lib/features/modules/text.mjs",
  // Intentional offline reads: igt-coach.mjs / igt-handbook.mjs are dedicated
  // child processes that must browse saved Markdown with no runtime, provider,
  // or database (asserted by tests/handbook-cli.test.mjs). /stats runs in the
  // main process where the runtime is up and already uses GET /dashboard.
  "lib/cli/commands/learning.mjs -> lib/application/grammar-coach.mjs",
  "lib/cli/commands/handbook.mjs -> lib/application/grammar-history.mjs",
  // Intentional offline read: igt.mjs renders the startup/input-line status bar
  // before the runtime is reachable and on every prompt; a local pure read keeps
  // the terminal responsive. /model now uses GET /settings/llm/cli instead.
  // TODO: LLM model resolution leak — igt-coach's --type explanation runs in a
  // dedicated child process; migrate once that path has a runtime guarantee.
  "lib/cli/commands/learning.mjs -> lib/server/llm/request-model.mjs",
  // Root entry renders the status bar before the runtime is up and on every
  // prompt; a local pure config read keeps the terminal responsive.
  "igt.mjs -> lib/server/llm/cli-models.mjs",
]);

const IMPORT_PATTERN = /(?:from\s*|import\s*\()\s*["'](\.\.?\/[^"']+)["']/g;

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith(".mjs")) files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(projectRoot, file).replaceAll("\\", "/");
}

function collectViolations() {
  const found = new Set();
  const files = [...walk(cliRoot), path.join(projectRoot, "igt.mjs")];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const target = path.resolve(path.dirname(file), match[1]);
      const relTarget = rel(target);
      if (!FORBIDDEN_PREFIXES.some((prefix) => relTarget.startsWith(prefix))) continue;
      found.add(`${rel(file)} -> ${relTarget}`);
    }
  }
  return found;
}

test("CLI does not add new imports into internal layers", () => {
  const newViolations = [...collectViolations()]
    .filter((key) => !KNOWN_EXCEPTIONS.has(key))
    .sort();
  assert.deepEqual(
    newViolations,
    [],
    `New CLI boundary violation(s). Resolve via HTTP contract or document a reason in KNOWN_EXCEPTIONS:\n${newViolations.join("\n")}`,
  );
});

test("grandfathered exceptions still exist and stay honest", () => {
  const observed = collectViolations();
  const stale = [...KNOWN_EXCEPTIONS].filter((key) => !observed.has(key)).sort();
  assert.deepEqual(
    stale,
    [],
    `Exception(s) no longer match any import — remove them from KNOWN_EXCEPTIONS:\n${stale.join("\n")}`,
  );
});
