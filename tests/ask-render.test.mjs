import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAskResponse } from "../lib/features/ask/handler.mjs";
import { renderAskResponse } from "../lib/features/ask/render.mjs";

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

// Capture everything renderAskResponse writes to stdout, with a fixed column width.
function capture(response, columns) {
  const orig = process.stdout.write;
  const prevCols = process.stdout.columns;
  let out = "";
  process.stdout.write = (chunk) => { out += chunk; return true; };
  process.stdout.columns = columns;
  try {
    renderAskResponse(response);
  } finally {
    process.stdout.write = orig;
    process.stdout.columns = prevCols;
  }
  return out;
}

test("parseAskResponse parses well-formed JSON", () => {
  const raw = JSON.stringify({
    question: "affect vs effect",
    title: "Affect vs Effect",
    answer: "Use **affect** as a verb.",
    related: ["When is 'effect' a verb?"],
  });
  const r = parseAskResponse(raw);
  assert.equal(r.answer, "Use **affect** as a verb.");
  assert.deepEqual(r.related, ["When is 'effect' a verb?"]);
});

test("parseAskResponse recovers answer from malformed JSON instead of leaking the raw blob", () => {
  // Unescaped double-quote inside the answer markdown breaks JSON.parse — the exact
  // failure local models produce. The user must NOT see the raw {"question":...} blob.
  const malformed =
    '{"question":"q","title":"Quoting","answer":"Use the word "literally" with care.\\n\\n## Tip\\nKeep it simple.","related":["x"]}';
  const r = parseAskResponse(malformed);
  assert.ok(!r.answer.trimStart().startsWith("{"), "answer should not start with raw JSON");
  assert.ok(!r.answer.includes('"related"'), "answer should not contain JSON scaffolding");
  assert.ok(r.answer.includes("literally"), "recovered answer keeps the markdown text");
  assert.ok(r.answer.includes("\n"), "escaped newlines are decoded");
  assert.equal(r.title, "Quoting");
});

test("renderAskResponse renders a fitting table as a grid", () => {
  const out = capture({
    answer: "| Word | Type |\n| --- | --- |\n| affect | verb |\n| effect | noun |",
    related: [],
    sources: [],
  }, 80);
  const plain = stripAnsi(out);
  assert.ok(plain.includes("| Word"), "narrow table keeps the grid form");
  assert.ok(plain.includes("affect"));
});

test("renderAskResponse repairs collapsed markdown table rows", () => {
  const out = capture({
    answer:
      "| Feature | Restrictive | Non-restrictive |\n" +
      "|---------|-------------|-----------------|\n" +
      "| Purpose | Identifies the noun. | Adds extra info. | Punctuation | No commas. | Uses commas.",
    related: [],
    sources: [],
  }, 120);
  const plain = stripAnsi(out);

  assert.ok(plain.includes("| Feature"), "table header still renders as a table");
  assert.ok(plain.includes("| Purpose"), "first collapsed row is recovered");
  assert.ok(plain.includes("| Punctuation"), "second collapsed row is recovered");
  assert.ok(!plain.includes("Purpose | Identifies the noun. | Adds extra info. | Punctuation"), "collapsed row is not rendered as a raw paragraph");
});

test("renderAskResponse degrades a too-wide table to a vertical layout that fits", () => {
  const wide = {
    answer:
      "| Tense | Form | Example sentence showing the usage clearly | Common mistake learners often make |\n" +
      "| --- | --- | --- | --- |\n" +
      "| Present perfect | have/has + past participle | I have lived here for ten years now today | Using simple past instead of present perfect |",
    related: [],
    sources: [],
  };
  const cols = 60;
  const out = capture(wide, cols);
  const plain = stripAnsi(out);

  // No physical line should overflow the terminal width (that's what fragments the grid).
  for (const line of plain.split("\n")) {
    assert.ok(line.length <= cols, `line exceeds ${cols} cols: ${JSON.stringify(line)}`);
  }
  // Vertical fallback labels each value with its header.
  assert.ok(plain.includes("Tense:"), "vertical layout labels rows with headers");
  assert.ok(!plain.includes("| Tense"), "wide table is not rendered as a grid");
});
