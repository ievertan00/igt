import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHandbookArgs, runHandbook } from "../lib/cli/commands/handbook.mjs";
import { buildGrammarHistory } from "../lib/application/grammar-history.mjs";
import { formatReviewEntry } from "../lib/db/review-log.mjs";

test("CLI accepts both argument styles and interactive quoted equals arguments", () => {
  assert.deepEqual(parseHandbookArgs(["--days=0", "--search", "a book", "--type=Articles"]), { days: "0", search: "a book", errorType: "Articles" });
  assert.deepEqual(parseHandbookArgs(["--search=", "a book"]), { search: "a book" });
  for (const args of [["--search"], ["--unknown"], ["--days", "NaN"], ["--offset=-1"], ["--limit=2", "--limit=3"]]) assert.throws(() => parseHandbookArgs(args));
});

test("old report options fail with replacement guidance before history is loaded", () => {
  for (const option of ["--incremental", "-i", "--format=html", "--cache-stats", "--clear-cache", "-c"]) {
    let error = "";
    const code = runHandbook([option], { loadHistory: () => assert.fail("must not read or generate"), writeError: (text) => { error += text; } });
    assert.equal(code, 1);
    assert.match(error, /removed.*browses saved Grammar checks/);
  }
});

test("history command renders whole checks, pagination and no-diagnosis filtering", () => {
  const entries = [
    { source: "grammar", entryId: "clean", timestamp: "2026-10-29T12:00:00Z", userInput: "I read a book.", correction: "I read a book.", diagnoses: [], remember: "Context" },
    { source: "grammar", entryId: "issue", timestamp: "2026-10-28T12:00:00Z", userInput: "I read book.", correction: "I read a book.", diagnoses: [{ error_type: "Articles", explanation: "Use a determiner" }] },
  ];
  const invoke = (args) => {
    let output = "", error = "";
    const status = runHandbook(args, { loadHistory: (options) => buildGrammarHistory(entries, options), write: (text) => { output += text; }, writeError: (text) => { error += text; } });
    return { status, output, error };
  };
  const first = invoke(["--days=0", "--limit=1"]);
  assert.equal(first.status, 0);
  assert.match(first.output, /Original:\nI read a book\./);
  assert.match(first.output, /No diagnosed mistakes/);
  assert.match(first.output, /--offset 1/);
  const clean = invoke(["--days=0", "--diagnosis=none", "--search", "Context"]);
  assert.equal(clean.status, 0);
  assert.match(clean.output, /1 matching check/);
  assert.doesNotMatch(clean.output, /Use a determiner/);
  assert.equal(invoke(["--diagnosis=none", "--type=Articles"]).status, 1);
  assert.match(invoke(["--days=0", "--search=absent"]).output, /No checks match/);
});

test("help does not load history and saved content cannot inject terminal controls", () => {
  let output = "";
  assert.equal(runHandbook(["--help"], { loadHistory: () => assert.fail("help should not load history"), write: (text) => { output += text; } }), 0);
  assert.match(output, /--diagnosis all\|with\|none/);
  output = "";
  runHandbook([], { loadHistory: () => buildGrammarHistory([{ source: "grammar", entryId: "safe", userInput: "\x1b[2Jhello", diagnoses: [] }], { days: 0 }), write: (text) => { output += text; } });
  assert.doesNotMatch(output, /\x1b/);
});

test("dedicated CLI runs without a provider or database and leaves learning files intact", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "igt-handbook-cli-"));
  try {
    const reviewPath = path.join(folder, "review.md");
    const content = formatReviewEntry({ entryId: "saved-check", source: "grammar", originalText: "I read a book.", data: { diagnoses: [] } })
      + formatReviewEntry({ entryId: "legacy", originalText: "An older record.", data: { diagnoses: [] } });
    fs.writeFileSync(reviewPath, content);
    const envPath = path.join(folder, ".env");
    const configPath = path.join(folder, "igt_config.json");
    fs.writeFileSync(envPath, `IGT_REVIEW_PATH=${reviewPath}\n`);
    fs.writeFileSync(configPath, "{}");
    const script = fileURLToPath(new URL("../tools/igt-handbook.mjs", import.meta.url));
    // ConfigLoader deliberately reads the project .env rather than process env overrides.
    // Redirect only this child process to isolated configuration before running the real tool.
    const bootstrap = `import config from ${JSON.stringify(new URL("../lib/shared/config-loader.mjs", import.meta.url).href)}; config.envPath=${JSON.stringify(envPath)}; config.configPath=${JSON.stringify(configPath)}; process.argv=['node',${JSON.stringify(script)},...process.argv.slice(1)]; await import(${JSON.stringify(new URL("../tools/igt-handbook.mjs", import.meta.url).href)});`;
    const launch = (args) => spawnSync(process.execPath, ["--input-type=module", "-e", bootstrap, "--", ...args], { cwd: folder, encoding: "utf8", timeout: 10000 });
    const result = launch(["--days=0", "--diagnosis=none"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /saved-check/);
    assert.match(result.stdout, /1 record\(s\) have unclassified origins/);
    assert.equal(fs.readFileSync(reviewPath, "utf8"), content);
    const expectedFiles = [".env", "igt_config.json", "review.md"];
    assert.deepEqual(fs.readdirSync(folder).sort(), expectedFiles);
    const removed = launch(["--format=html"]);
    assert.equal(removed.status, 1);
    assert.match(removed.stderr, /removed/);
    assert.deepEqual(fs.readdirSync(folder).sort(), expectedFiles);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
