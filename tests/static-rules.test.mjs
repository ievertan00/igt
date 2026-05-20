import { test } from "node:test";
import assert from "node:assert/strict";
import { getStaticGrammarRule } from "../lib/features/handbook/static-rules.mjs";

test("returns rule object for known error type", () => {
  const rule = getStaticGrammarRule("Grammar / Article Usage");
  assert.ok(rule, "should return a rule");
  assert.ok(rule.title);
  assert.ok(rule.content);
});

test("returns null for unknown error type", () => {
  const rule = getStaticGrammarRule("Some / Bogus Type");
  assert.equal(rule, null);
});
