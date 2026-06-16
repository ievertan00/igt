import { test } from "node:test";
import assert from "node:assert/strict";
import { maskTerm } from "../lib/cli/commands/review.mjs";

test("maskTerm: single word exact match", () => {
  const example = "The memory was ephemeral and beautiful.";
  const term = "ephemeral";
  assert.strictEqual(maskTerm(example, term), "The memory was ___ and beautiful.");
});

test("maskTerm: single word with plural suffix", () => {
  const example = "We bought three apples yesterday.";
  const term = "apple";
  assert.strictEqual(maskTerm(example, term), "We bought three ___ yesterday.");
});

test("maskTerm: single word irregular verb inflection", () => {
  const example = "She ran a marathon last Sunday.";
  const term = "run";
  assert.strictEqual(maskTerm(example, term), "She ___ a marathon last Sunday.");
});

test("maskTerm: multi-word verb phrase with standard inflection", () => {
  const example = "We are looking forward to the upcoming vacation.";
  const term = "look forward to";
  assert.strictEqual(maskTerm(example, term), "We are ___ the upcoming vacation.");
});

test("maskTerm: multi-word verb phrase with irregular verb inflection", () => {
  const example = "She paid attention to every single detail.";
  const term = "pay attention to";
  assert.strictEqual(maskTerm(example, term), "She ___ every single detail.");
});

test("maskTerm: noun phrase with plural inflection", () => {
  const example = "We need to reduce our carbon footprints.";
  const term = "carbon footprint";
  assert.strictEqual(maskTerm(example, term), "We need to reduce our ___.");
});
