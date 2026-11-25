import { test } from "node:test";
import assert from "node:assert/strict";
import { createPasteFilter } from "../lib/cli/paste-filter.mjs";

const START = "\x1b[200~";
const END = "\x1b[201~";

test("normal input passes through unchanged", () => {
  const feed = createPasteFilter();
  assert.equal(feed("hello world"), "hello world");
});

test("lone ESC is forwarded, not held back (meta/clear key must still work)", () => {
  const feed = createPasteFilter();
  assert.equal(feed("\x1b"), "\x1b");
});

test("arrow-key escape sequence passes through", () => {
  const feed = createPasteFilter();
  assert.equal(feed("\x1b[A"), "\x1b[A");
});

test("single-chunk paste: markers stripped, newlines collapsed to spaces", () => {
  const feed = createPasteFilter();
  assert.equal(feed(`${START}line one\nline two\x1b[201~`), "line one line two");
});

test("CRLF and CR inside a paste both become single spaces", () => {
  const feed = createPasteFilter();
  assert.equal(feed(`${START}a\r\nb\rc${END}`), "a b c");
});

test("text around a paste is preserved; only paste body is collapsed", () => {
  const feed = createPasteFilter();
  assert.equal(feed(`x${START}a\nb${END}y`), "xa by");
});

test("paste body split across chunks", () => {
  const feed = createPasteFilter();
  assert.equal(feed(`${START}first\nsec`), "first sec");
  assert.equal(feed(`ond\nthird${END}`), "ond third");
});

test("END marker split across chunks is not emitted as literal bytes", () => {
  const feed = createPasteFilter();
  assert.equal(feed(`${START}body\n`), "body ");
  // END marker arrives split: "\x1b[20" then "1~"
  assert.equal(feed("\x1b[20"), "");
  assert.equal(feed("1~after"), "after");
});

test("START marker split across chunks is still recognized", () => {
  const feed = createPasteFilter();
  assert.equal(feed("\x1b[2"), "");
  assert.equal(feed(`00~a\nb${END}`), "a b");
});

test("typing after a paste ends is normal input again", () => {
  const feed = createPasteFilter();
  assert.equal(feed(`${START}p\nq${END}`), "p q");
  assert.equal(feed("\x1b"), "\x1b");
  assert.equal(feed("r"), "r");
});
