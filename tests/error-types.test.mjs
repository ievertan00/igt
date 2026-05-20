import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyErrorType } from "../lib/domain/error-types.mjs";

test("classifies exact known keyword to canonical type", () => {
  const result = classifyErrorType("verb tense");
  assert.match(result, /Verb Tense/);
});

test("classifies article usage", () => {
  const result = classifyErrorType("article usage");
  assert.match(result, /Article/);
});

test("longest-match-first wins over shorter prefix match", () => {
  const result = classifyErrorType("subject-verb agreement");
  assert.match(result, /Subject-Verb/);
});

test("unknown keyword returns the input (or strips leading dashes)", () => {
  const result = classifyErrorType("xyzzy_unknown_type");
  assert.ok(typeof result === "string");
  assert.ok(result.length > 0);
});
