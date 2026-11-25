import { test } from "node:test";
import assert from "node:assert/strict";
import { renderModuleGuide, renderModuleIndex } from "../lib/features/modules/catalog.mjs";

test("module catalog exposes Word, Sentence, and Text", () => {
  const index = renderModuleIndex();
  assert.match(index, /word/);
  assert.match(index, /sentence/);
  assert.match(index, /text/);
});

test("text module guide describes the supported workflow", () => {
  const guide = renderModuleGuide("text");
  assert.match(guide, /complete passage/);
  assert.match(guide, /\/text/);
});
