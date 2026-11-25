import assert from "node:assert/strict";
import test from "node:test";
import { reviewExampleParts } from "../apps/web/src/review-example.ts";

const matches = (text, word) => reviewExampleParts(text, word).filter(part => part.highlighted).map(part => part.text);

test("review examples highlight exact words without matching longer words", () => {
  assert.deepEqual(matches("Art is part of the ART course.", "art"), ["Art", "ART"]);
});
test("review examples highlight regular inflections and phrases", () => {
  assert.deepEqual(matches("She followed up; he is following-up.", "follow up"), ["followed up", "following-up"]);
  assert.deepEqual(matches("She studies, studied and is studying.", "study"), ["studies", "studied", "studying"]);
  assert.deepEqual(matches("He stopped and is stopping.", "stop"), ["stopped", "stopping"]);
});
test("review examples highlight common irregular forms", () => {
  assert.deepEqual(matches("She wrote it; it was written yesterday.", "write"), ["wrote", "written"]);
});
test("review examples escape punctuation and preserve all source text", () => {
  const sentence = "C++ is useful. <script> stays plain text.";
  const parts = reviewExampleParts(sentence, "C++");
  assert.deepEqual(matches(sentence, "C++"), ["C++"]);
  assert.equal(parts.map(part => part.text).join(""), sentence);
  assert.deepEqual(matches(sentence, ""), []);
});
