import assert from "node:assert/strict";
import { test } from "node:test";
import { registerWordRoutes } from "../lib/server/routes/word.mjs";
import { dispatch } from "../lib/server/router.mjs";

const entry = { status: "found", word: "scrutiny", pos: "noun", phonetic: "/ˈskruːtəni/", meaning: "Careful examination.", zh: "仔细审查", synonyms: "inspection", collocations: "under scrutiny", example: "The plan is under scrutiny.", example2: "Her work faced scrutiny.", example3: "The report deserves scrutiny.", note: "Usually uncountable.", suggestions: "" };
let outputs = [];
let calls = [];
registerWordRoutes({ getLLMManager: async () => ({ generateWithFallback: async (...args) => {
  calls.push(args);
  const output = outputs.shift();
  if (output instanceof Error) throw output;
  return output;
} }) });

async function lookup(responses, query = "scrutiny") {
  outputs = [...responses];
  calls = [];
  let status;
  let body;
  await dispatch({ method: "GET", url: `/word/lookup?q=${encodeURIComponent(query)}` }, {
    writeHead(value) { status = value; },
    end(value) { body = JSON.parse(value); },
  });
  return { status, body };
}

test("lookup recovers once from an unterminated model string", async () => {
  const result = await lookup(['{"word":"scrutiny","meaning":"' + "x".repeat(19_700), JSON.stringify(entry)]);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.word, "scrutiny");
  assert.equal(result.body.persistence.saved, false);
  assert.equal(calls.length, 2);
});

test("repeated malformed output returns an actionable error instead of parser internals", async () => {
  const result = await lookup(['{"meaning":"unfinished', '{"meaning":"unfinished']);
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "INVALID_LLM_RESPONSE");
  assert.match(result.body.error.message, /try again/i);
  assert.doesNotMatch(result.body.error.message, /JSON|position|Unterminated/);
  assert.equal(result.body.error.retryable, true);
  assert.equal(calls.length, 2);
});

test("an unrecognized word returns spelling guidance without generating a fake entry", async () => {
  const result = await lookup([JSON.stringify({ ...entry, status: "not_found", word: "", meaning: "", zh: "", suggestions: "scrutiny" })], "scrutniy");
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, "WORD_NOT_FOUND");
  assert.match(result.body.error.message, /spelling/i);
  assert.match(result.body.error.message, /scrutiny/);
  assert.equal(result.body.data, undefined);
  assert.equal(result.body.error.retryable, false);
  assert.equal(calls.length, 1);
});

test("valid fenced output is accepted without retry", async () => {
  const result = await lookup([`  \n\`\`\`json\n${JSON.stringify(entry)}\n\`\`\`\n`]);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.requested, "scrutiny");
  assert.equal(calls.length, 1);
});

test("invalid entry shapes and oversized fields cannot reach the client as dictionary entries", async () => {
  for (const value of [null, [], {}, { ...entry, meaning: {} }, { ...entry, meaning: "x".repeat(5000) }]) {
    const result = await lookup([JSON.stringify(value), JSON.stringify(value)]);
    assert.equal(result.status, 502);
    assert.equal(result.body.error.code, "INVALID_LLM_RESPONSE");
    assert.equal(calls.length, 2);
  }
});

test("provider failures are not retried as JSON repair", async () => {
  const result = await lookup([new Error("Provider request timed out (60s)")]);
  assert.equal(result.status, 502);
  assert.equal(result.body.error.message, "Provider request timed out (60s)");
  assert.equal(calls.length, 1);
});
