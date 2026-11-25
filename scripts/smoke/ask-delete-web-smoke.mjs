import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';

// Isolated API fixtures: never delete the user's saved notes.
const server = await createServer({ configFile: 'apps/web/vite.config.ts', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let notes = ['Articles', 'Present perfect: connecting past actions to the present', 'Polite requests'].map((title, index) => ({ id: `note-${index}.md`, title, category: 'Grammar', tags: ['examples', 'everyday English'], content: '## When to use it\n\nUse the present perfect when a past action matters now.\n\n**I have finished the report.** It is ready to read.\n\n## Compare the meaning\n\nI finished the report yesterday. This tells us when the action happened.', modifiedAt: new Date().toISOString(), bytes: 300 }));
  let deleteCount = 0, failDelete = true, holdDelete, releaseDelete;
  await page.setRequestInterception(true);
  page.on('request', async request => {
    if (!['fetch', 'xhr'].includes(request.resourceType())) return void request.continue();
    const url = new URL(request.url());
    let body = {}, status = 200;
    if (url.pathname === '/ask/notes') body = { directory: 'Isolated fixtures', notes };
    if (url.pathname === '/ask/notes/delete') {
      deleteCount++;
      const id = JSON.parse(request.postData()).id;
      if (holdDelete) await holdDelete;
      if (failDelete) { status = 503; body = { error: 'Could not delete this note. Try again.' }; }
      else { notes = notes.filter(note => note.id !== id); body = { deleted: true, id }; }
    }
    void request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/#ask?view=notes`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.ask-note-link');
  assert.ok(await page.$('#ask-notes-search'));
  assert.equal(await page.$$('.ask-library-tools select').then(items => items.length), 0);
  assert.equal(await page.$eval('.ask-note-title strong', el => el.textContent), 'note-0');
  await page.click('.ask-note-link');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog').open);
  await page.waitForFunction(() => document.activeElement.dataset.restoredFocus === 'true');
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none');
  assert.equal(await page.$('.ask-note-link[aria-current="true"]'), null);
  await page.keyboard.press('Tab');
  assert.equal(await page.$('[data-restored-focus="true"]'), null);

  await page.click('[data-note-id="note-1.md"]');
  await page.waitForSelector('dialog[open]');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewport({ width, height: 900 });
    await page.screenshot({ path: path.join(os.tmpdir(), `igt-ask-reader-${width}.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const selector of ['.ask-note-delete', '.ask-note-continue']) {
      assert.ok(await page.$eval(selector, el => el.getBoundingClientRect().height >= 44));
    }
  }
  await page.click('.ask-note-delete');
  await page.waitForSelector('.ask-note-delete-confirm');
  assert.match(await page.$eval('.ask-note-delete-title', el => el.textContent), /note-1/);
  assert.equal(await page.evaluate(() => document.activeElement.matches('.ask-note-delete-actions .secondary')), true, 'Keep note is focused first');
  assert.equal(deleteCount, 0, 'Opening confirmation does not delete');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.ask-note-delete-confirm'));
  assert.equal(await page.$eval('dialog', el => el.open), true, 'Escape returns to the reader');
  assert.equal(await page.evaluate(() => document.activeElement.matches('.ask-note-delete')), true);
  await page.click('.ask-note-delete');
  await page.click('.ask-note-delete-confirm .secondary');
  assert.equal(deleteCount, 0, 'Cancel preserves the note');
  await page.click('.ask-note-delete');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewport({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.$eval('.ask-note-delete-confirm', el => el.scrollWidth > el.clientWidth), false);
    await page.screenshot({ path: path.join(os.tmpdir(), `igt-ask-delete-${width}.png`) });
  }
  await page.click('.ask-note-delete-submit');
  await page.waitForSelector('.ask-note-dialog-footer [role="alert"]');
  assert.equal(await page.$eval('dialog', el => el.open), true, 'Failure keeps note open');
  assert.equal(await page.$$('.ask-note-link').then(items => items.length), 3);
  assert.match(await page.$eval('.ask-note-delete-submit', el => el.textContent), /Retry deletion/);
  assert.equal(await page.evaluate(() => document.activeElement.matches('.ask-note-delete-submit')), true);
  failDelete = false;
  holdDelete = new Promise(resolve => { releaseDelete = resolve; });
  await page.click('.ask-note-delete-submit');
  await page.waitForSelector('.ask-note-delete-confirm[aria-busy="true"]');
  assert.equal(await page.$eval('[aria-label="Close note"]', el => el.disabled), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('dialog', el => el.open), true, 'Pending deletion keeps the dialog open');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true);
  assert.equal(deleteCount, 2, 'Pending controls prevent duplicate submissions');
  releaseDelete(); holdDelete = undefined;
  await page.waitForFunction(() => !document.querySelector('dialog').open);
  await page.waitForSelector('.ask-note-deleted');
  assert.match(await page.$eval('.ask-note-deleted [role="status"]', el => el.textContent), /Note deleted.*note-1/);
  await page.waitForFunction(() => document.activeElement.dataset.noteId === 'note-2.md');
  assert.equal(await page.$$('.ask-note-link').then(items => items.length), 2);
  // Verify localized confirmation with a long title and a short viewport.
  notes[0].title = '在日常表达中区分定冠词、不定冠词与零冠词：从具体例句理解不同语境中的使用方法';
  await page.evaluate(() => localStorage.setItem('clearwrite.learner-language', 'zh-CN'));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.setViewport({ width: 320, height: 600 });
  await page.click('.ask-note-link');
  await page.click('.ask-note-delete');
  assert.match(await page.$eval('#ask-note-delete-prompt', el => el.textContent), /删除/);
  assert.equal(await page.$eval('.ask-note-delete-submit', el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), true, 'Confirmation stays visible in a short mobile viewport');
  await page.screenshot({ path: path.join(os.tmpdir(), 'igt-ask-delete-zh-320.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.click('.ask-note-delete-submit');
  await page.waitForFunction(() => !document.querySelector('dialog').open);
  await page.click('.ask-note-link');
  await page.click('.ask-note-delete');
  await page.click('.ask-note-delete-submit');
  await page.waitForFunction(() => !document.querySelector('dialog').open);
  await page.waitForFunction(() => document.activeElement.id === 'ask-notes-all');
  await page.evaluate(() => localStorage.setItem('clearwrite.learner-language', 'en'));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('.ask-library-empty')?.textContent.includes('No saved conversations'));
  assert.equal(deleteCount, 4);
  assert.deepEqual(errors, []);
  console.log('Ask note deletion: reader, confirmation, keyboard, cancel, pending, failure/retry, success, next-note focus, empty state, English/Chinese and responsive layouts passed');
} finally {
  await browser?.close();
  await server.close();
}
