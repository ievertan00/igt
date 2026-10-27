import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { listSavedVocabulary } from "../lib/application/vocabulary-library.mjs";
import { registerVocabRoutes } from "../lib/server/routes/vocab.mjs";
import { dispatch } from "../lib/server/router.mjs";

function source(t, content = "") {
  const parent = path.join(process.cwd(), ".cache");
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, "saved-vocabulary-test-"));
  const file = path.join(dir, "words.md");
  fs.writeFileSync(file, content);
  t.after(() => { assert.equal(path.dirname(dir), parent); fs.rmSync(dir, { recursive: true, force: true }); });
  return { file, config: { VocabularyPath: file } };
}

const entry = (word, date = "2026-10-20") => `### ${word}
**PoS:** noun · /test/
**Meaning:** A saved expression
**中文:** 保存的词汇
**Synonyms:**
**Collocations:** useful expression
**Example 1:** First example for ${word}.
**Example 2:** Second example for ${word}.
**Example 3:** Third example for ${word}.
**Note:** Use it in a sentence.
**Memory:** A useful memory cue.
*Added: ${date}*
`;

test("library reads every Markdown entry without depending on the SRS deck", t => {
  const input = `# Vocabulary\n${entry("zebra")}${entry("apple")}${entry("apple")}`;
  const { file, config } = source(t, input);
  const result = listSavedVocabulary({ config });
  assert.equal(result.sourceAvailable, true);
  assert.equal(result.totalSaved, 3);
  assert.deepEqual(result.words.map(word => word.word), ["apple", "apple", "zebra"]);
  assert.equal(new Set(result.words.map(word => word.id)).size, 3);
  assert.equal(result.words[0].synonyms, "", "empty fields must not swallow the next line");
  assert.equal(result.words[0].example3, "Third example for apple.");
  assert.equal(result.words[0].memory, "A useful memory cue.");
  assert.equal(result.words[0].phonetic, "/test/");
  assert.equal(fs.readFileSync(file, "utf8"), input, "browsing never rewrites the vocabulary file");
  assert.equal(JSON.stringify(result).includes(file), false);
});

test("library searches Chinese, examples and notes, sorts and paginates consistently", t => {
  const { config } = source(t, entry("zebra", "2026-10-22") + entry("apple", "2026-10-23") + entry("banana", "2026-10-21"));
  assert.deepEqual(listSavedVocabulary({ config, sort: "newest" }).words.map(word => word.word), ["apple", "zebra", "banana"]);
  assert.equal(listSavedVocabulary({ config, search: "保存" }).total, 3);
  assert.equal(listSavedVocabulary({ config, search: "SECOND EXAMPLE FOR APPLE" }).total, 1);
  assert.equal(listSavedVocabulary({ config, search: "memory cue" }).total, 3);
  const page = listSavedVocabulary({ config, limit: 1, offset: 1 });
  assert.equal(page.words[0].word, "banana"); assert.equal(page.hasMore, true);
  assert.equal(listSavedVocabulary({ config, limit: 1, offset: 100 }).offset, 2);
  assert.equal(listSavedVocabulary({ config, search: "missing" }).total, 0);
  assert.throws(() => listSavedVocabulary({ config, limit: 101 }), error => error.status === 400);
  assert.throws(() => listSavedVocabulary({ config, sort: "invalid" }), error => error.status === 400);
});

test("library distinguishes an empty source from a missing source", t => {
  const { config, file } = source(t);
  assert.equal(listSavedVocabulary({ config }).sourceAvailable, true);
  fs.unlinkSync(file);
  const missing = listSavedVocabulary({ config });
  assert.equal(missing.sourceAvailable, false);
  assert.equal(missing.totalSaved, 0);
});

test("saved vocabulary GET route validates queries and returns complete entries read-only", async t => {
  const { config } = source(t, entry("follow up"));
  registerVocabRoutes({ getConfig: () => config });
  async function get(url) {
    const req = Readable.from([]); req.method = "GET"; req.url = url;
    const res = { writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
    await dispatch(req, res);
    return res;
  }
  const response = await get("/vocab/words?q=follow%20up&sort=az&limit=25&offset=0");
  assert.equal(response.status, 200);
  assert.equal(response.body.words[0].word, "follow up");
  assert.equal(response.body.words[0].added, "2026-10-20");
  assert.equal((await get("/vocab/words?limit=-1")).status, 400);
});
