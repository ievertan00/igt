import { test } from "node:test";
import assert from "node:assert";
import { wrapText, renderCompactStats } from "../lib/ui.mjs";

test("wrapText reflows text with single newlines", () => {
  const input = "Added 'the' before 'wall time' to specify the particular\nwall time being discussed.";
  // Wrapping at 50 should reflow and break differently than the original \n
  const result = wrapText(input, 50);
  const expected = "Added 'the' before 'wall time' to specify the\nparticular wall time being discussed.";
  assert.strictEqual(result, expected);
});

test("wrapText preserves double newlines", () => {
  const input = "Para 1.\n\nPara 2.";
  const result = wrapText(input, 60);
  assert.strictEqual(result, "Para 1.\n\nPara 2.");
});

test("wrapText preserves lists and blockquotes", () => {
  const input = "Normal para.\n- item 1\n- item 2\n> quote";
  const result = wrapText(input, 60);
  const expected = "Normal para.\n- item 1\n- item 2\n> quote";
  assert.strictEqual(result, expected);
});

test("wrapText wraps long list items with indentation", () => {
  const input = "- This is a very long list item that should be wrapped and indented on subsequent lines.";
  const result = wrapText(input, 30);
  // It should wrap after "very long list item that"
  const expected = "- This is a very long list\n  item that should be wrapped\n  and indented on subsequent\n  lines.";
  assert.strictEqual(result, expected);
});

test("renderCompactStats formatting", () => {
  const result = renderCompactStats(1, 4, 1, 0);
  assert.ok(result.includes("1/4"));
  assert.ok(result.includes("25%"));
  assert.ok(result.includes("✓ 1"));
  assert.ok(result.includes("✗ 0"));
});
