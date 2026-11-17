import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { registerWordRoutes } from "../lib/server/routes/word.mjs";
import { WORD_LOOKUP_PROMPT, WORD_LOOKUP_SCHEMA } from "../lib/application/word.mjs";
import { dispatch } from "../lib/server/router.mjs";

const entry = { status: "found", word: "scrutiny", pos: "noun", phonetic: "/ˈskruːtəni/", meaning: "Careful examination.", zh: "仔细审查", synonyms: "inspection", collocations: "under scrutiny", verbForms: "", plural: "", comparative: "", example: "The plan is under scrutiny.", example2: "Her work faced scrutiny.", example3: "The report deserves scrutiny.", note: "Usually uncountable.", suggestions: "" };
let outputs = [];
let calls = [];
const parent = path.join(process.cwd(), ".cache");
fs.mkdirSync(parent, { recursive: true });
const fixture = fs.mkdtempSync(path.join(parent, "word-lookup-"));
const vocabularyFile = path.join(fixture, "words.md");
test.after(() => { assert.equal(path.dirname(fixture), parent); fs.rmSync(fixture, { recursive: true, force: true }); });
registerWordRoutes({ getConfig: () => ({ VocabularyPath: vocabularyFile }), getLLMManager: async () => ({ generateWithFallback: async (...args) => {
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

test("verb tense forms and noun plural survive lookup and Markdown saving", async () => {
  const verb = { ...entry, word: "enhance", pos: "verb", phonetic: "/ɪnˈhɑːns/", meaning: "To improve the quality of something.", zh: "增强", verbForms: "enhance · enhanced · enhanced", plural: "", synonyms: "improve, boost", collocations: "enhance the quality", example: "Good lighting enhances the room.", example2: "This course enhances your skills.", example3: "The update enhanced performance.", note: "Transitive.", suggestions: "" };
  const result = await lookup([JSON.stringify(verb)]);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.verbForms, "enhance · enhanced · enhanced");
  assert.equal(result.body.data.plural, "");
  const noun = { ...entry, word: "leaf", pos: "noun", phonetic: "/liːf/", meaning: "A flat green part of a plant.", zh: "叶子", verbForms: "", plural: "leaves", example: "A leaf fell.", example2: "The tree has many leaves.", example3: "She pressed a leaf.", note: "Irregular plural.", suggestions: "" };
  const saved = await lookup([JSON.stringify(noun)]);
  assert.equal(saved.body.data.plural, "leaves");
  assert.equal(saved.body.data.verbForms, "");
});

test("the dictionary schema and prompt request adjective comparatives", () => {
  assert.equal(WORD_LOOKUP_SCHEMA.properties.comparative.type, "string");
  assert.ok(WORD_LOOKUP_SCHEMA.required.includes("comparative"));
  assert.match(WORD_LOOKUP_PROMPT, /comparative for gradable adjectives/i);
  assert.match(WORD_LOOKUP_PROMPT, /adjectives that have no standard comparative/i);
});

test("adjective comparatives survive lookup while verb forms and plural stay empty", async () => {
  const adjective = { ...entry, word: "fragile", pos: "adjective", meaning: "Easily broken.", zh: "脆弱的", verbForms: "", plural: "", comparative: "more fragile", example: "Glass is fragile.", example2: "The fragile vase cracked.", example3: "Handle the fragile box gently.", note: "Gradable.", suggestions: "" };
  const result = await lookup([JSON.stringify(adjective)]);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.comparative, "more fragile");
  assert.equal(result.body.data.verbForms, "");
  assert.equal(result.body.data.plural, "");
  assert.equal(calls.length, 1);
  assert.match(String(calls[0][1]), /comparative for gradable adjectives/i, "the model prompt requests the new field");
});

test("saved adjective comparatives parse without swallowing the next Markdown line", async () => {
  const content = "# Vocabulary\n\n### fragile\n**PoS:** adjective · /ˈfrædʒ.aɪl/\n**Meaning:** Easily broken.\n**中文:** 脆弱的\n**Verb forms:**\n**Plural:**\n**Comparative:** more fragile\n**Example 1:** Glass is fragile.\n**Note:**\n";
  fs.writeFileSync(vocabularyFile, content);
  try {
    const result = await lookup([], "fragile");
    assert.equal(result.body.data.comparative, "more fragile");
    assert.equal(result.body.data.verbForms, "");
    assert.equal(result.body.data.plural, "");
    assert.equal(result.body.data.example, "Glass is fragile.");
    assert.equal(result.body.data.existing, true);
  } finally { fs.unlinkSync(vocabularyFile); }
});

test("lookup retries generic mention-only filler examples and returns meaningful replacements", async () => {
  const filler = { ...entry,
    example2: 'In a practical context, the team used “scrutiny” when discussing the same idea at work.',
    example3: 'The discussion gave learners another useful context for understanding “scrutiny”.',
  };
  const result = await lookup([JSON.stringify(filler), JSON.stringify(entry)]);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.example2, entry.example2);
  assert.equal(result.body.data.example3, entry.example3);
  assert.equal(calls.length, 2);
});

test("lookup rejects repeated examples even when only case and punctuation differ", async () => {
  const repeated = { ...entry, example2: 'the plan is under scrutiny!' };
  const result = await lookup([JSON.stringify(repeated), JSON.stringify(repeated)]);
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "INVALID_LLM_RESPONSE");
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

test("Chinese lookup uses CLI translation routing before dictionary generation", async () => {
  const result = await lookup(['English counterpart: "scrutiny"', JSON.stringify(entry)], "仔细审查");
  assert.equal(result.status, 200);
  assert.equal(result.body.data.requested, "仔细审查");
  assert.equal(result.body.data.lookup, "scrutiny");
  assert.equal(result.body.data.translated, true);
  assert.equal(result.body.data.existing, false);
  assert.deepEqual(calls.map(([query, , options]) => [query, options.taskType]), [["仔细审查", "translation"], ["scrutiny", "grammar"]]);
  assert.equal(result.body.persistence.saved, false);
  assert.equal(fs.existsSync(vocabularyFile), false, "lookup never saves a new entry");
});

test("an invalid Chinese counterpart stops before dictionary lookup", async () => {
  for (const output of ["", "还是中文", "12345"]) {
    const result = await lookup([output], "仔细审查");
    assert.equal(result.status, 502);
    assert.equal(result.body.error.code, "INVALID_ENGLISH_COUNTERPART");
    assert.equal(calls.length, 1);
    assert.equal(calls[0][2].taskType, "translation");
  }
});

test("Chinese translation failures preserve provider errors and do not generate a dictionary entry", async () => {
  const result = await lookup([new Error("Translation service unavailable")], "仔细审查");
  assert.equal(result.status, 502);
  assert.equal(result.body.error.message, "Translation service unavailable");
  assert.equal(calls.length, 1);
});

test("saved vocabulary wins before lookup and after canonicalization", async () => {
  const content = "# Vocabulary\n\n### scrutiny\n**PoS:** noun · /saved/\n**Meaning:** My saved meaning.\n**中文:** 仔细审查\n**Verb forms:**\n**Plural:** scrutinies\n**Comparative:**\n**Example:** Saved example.\n**Note:**\n**Memory:** my memory hook\n";
  fs.writeFileSync(vocabularyFile, content);
  try {
    const direct = await lookup([], "SCRUTINY");
    assert.equal(direct.body.data.meaning, "My saved meaning.");
    assert.equal(direct.body.data.phonetic, "/saved/");
    assert.equal(direct.body.data.note, "", "an empty field must not consume the next Markdown line");
    assert.equal(direct.body.data.verbForms, "", "an empty verb forms field must parse as empty");
    assert.equal(direct.body.data.plural, "scrutinies");
    assert.equal(direct.body.data.comparative, "", "an empty comparative field must parse as empty");
    assert.equal(direct.body.data.existing, true);
    assert.equal(calls.length, 0);
    const chinese = await lookup(["scrutiny"], "仔细审查");
    assert.equal(chinese.body.data.example, "Saved example.");
    assert.equal(chinese.body.data.existing, true);
    assert.equal(calls.length, 1, "translation is followed by a saved-entry check");
    const canonical = await lookup([JSON.stringify(entry)], "scrutinies");
    assert.equal(canonical.body.data.meaning, "My saved meaning.");
    assert.equal(canonical.body.data.existing, true);
    assert.equal(calls.length, 1);
    assert.equal(fs.readFileSync(vocabularyFile, "utf8"), content);
  } finally { fs.unlinkSync(vocabularyFile); }
});
