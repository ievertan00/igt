import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEnglishCounterpart, isMainlyChinese } from "../lib/shared/add-input.mjs";

test("detects Chinese lookup terms", () => {
  assert.equal(isMainlyChinese("破冰"), true);
  assert.equal(isMainlyChinese("look forward to"), false);
});

test("cleans a strict English counterpart response", () => {
  assert.equal(cleanEnglishCounterpart("English counterpart: \"break the ice\""), "break the ice");
});

test("rejects an unusable counterpart response", () => {
  assert.throws(() => cleanEnglishCounterpart("破冰"), /reliable English counterpart/);
});
