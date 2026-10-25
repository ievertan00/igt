import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { saveAskMessages } from '../../lib/application/ask.mjs';
import { listAskNotes } from '../../lib/application/ask-notes.mjs';
import { registerAskRoutes } from '../../lib/server/routes/ask.mjs';
import { dispatch } from '../../lib/server/router.mjs';
import configLoader from '../../lib/shared/config-loader.mjs';

const fixture = fs.mkdtempSync(path.join(import.meta.dirname, 'fixture-'));
const results = {};
const messages = [{ question: 'A question?', answer: 'An explanation.' }];
try {
  const config = { AskPath: path.join(fixture, 'save'), AskDir: path.join(fixture, 'browse') };
  const saved = saveAskMessages({ messages, config });
  results.pathMismatch = { saved: saved.saved, fileExists: fs.existsSync(path.join(config.AskPath, saved.vaultFile)), visibleInLibrary: listAskNotes(config).notes.length };
  assert.deepEqual(results.pathMismatch, { saved: true, fileExists: true, visibleInLibrary: 0 });

  const duplicateConfig = { AskDir: path.join(fixture, 'duplicates') };
  const first = saveAskMessages({ messages, config: duplicateConfig });
  const different = [{ question: messages[0].question, answer: 'A different explanation.' }];
  const second = saveAskMessages({ messages: different, config: duplicateConfig });
  fs.unlinkSync(path.join(duplicateConfig.AskDir, first.vaultFile));
  const repeated = saveAskMessages({ messages: different, config: duplicateConfig });
  results.duplicateAfterDeletion = { second: second.vaultFile, repeated: repeated.vaultFile, count: listAskNotes(duplicateConfig).notes.length };
  assert.equal(results.duplicateAfterDeletion.count, 2);

  const sizeConfig = { AskDir: path.join(fixture, 'size') };
  saveAskMessages({ messages, config: sizeConfig });
  const oversized = saveAskMessages({ messages: [{ question: 'A long discussion', answer: 'a'.repeat(1024 * 1024) }], config: sizeConfig });
  let listStatus;
  try { listAskNotes(sizeConfig); } catch (error) { listStatus = error.status; }
  results.oversizedSave = { saved: oversized.saved, libraryStatus: listStatus };
  assert.deepEqual(results.oversizedSave, { saved: true, libraryStatus: 413 });

  registerAskRoutes({ config: { AskDir: path.join(fixture, 'provider') }, getLLMManager: async () => { throw new Error('Provider initialization unavailable'); } });
  const req = Readable.from([JSON.stringify({ messages })]);
  req.method = 'POST'; req.url = '/ask/save'; req.setTimeout = () => {};
  const res = { status: null, payload: null, setTimeout() {}, writeHead(status) { this.status = status; }, end(body) { this.payload = JSON.parse(body); } };
  await dispatch(req, res);
  results.providerDependentSave = { status: res.status, error: res.payload.error.message };
  assert.equal(res.status, 500);

  const liveConfig = configLoader.load();
  results.currentConfiguration = { hasAskPath: Boolean(liveConfig.AskPath), hasAskDir: Boolean(liveConfig.AskDir) };
  console.log(JSON.stringify(results, null, 2));
} finally {
  assert.equal(path.dirname(fixture), import.meta.dirname);
  fs.rmSync(fixture, { recursive: true, force: true });
}
