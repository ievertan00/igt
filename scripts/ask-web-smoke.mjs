import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const root = path.join(process.cwd(), 'artifacts', 'ask-qa');
fs.mkdirSync(root, { recursive: true });
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const base = process.env.IGT_QA_URL;
assert.ok(base, 'Set IGT_QA_URL to the running Web app.');
const clickText = async (text) => page.evaluate((text) => {
  const button = [...document.querySelectorAll('button')].find((button) => button.textContent.includes(text));
  if (!button) throw new Error(`Missing button: ${text}`);
  button.click();
}, text);
try {
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${base}/#ask`);
  await page.waitForFunction(() => document.querySelector('.ask-note-link') || document.body.textContent.includes('No saved conversations yet') || document.body.textContent.includes('could not be loaded'));
  const live = await page.evaluate(() => ({ notes: document.querySelectorAll('.ask-note-link').length, error: document.body.textContent.includes('could not be loaded') }));
  assert.equal(live.error, false, 'Live notes must load through the Vite proxy');
  await page.screenshot({ path: path.join(root, 'ask-desktop.png'), fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(root, 'ask-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

  let failAsk = true;
  let noteMode = 'ready';
  let history;
  let saved;
  const notes = [
    { id: 'Comma questions.md', modifiedAt: '2026-10-21T10:00:00Z', bytes: 20, content: '## Direct answer\n\nUse a comma between **independent clauses**.\n\n## Examples\n\n- I went home, and she stayed.' },
    { id: 'Present perfect.md', modifiedAt: '2026-10-20T10:00:00Z', bytes: 20, content: '## Present perfect\n\nConnect a past event to the present.' },
  ];
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    let body;
    let status = 200;
    if (url.pathname === '/ask/notes') {
      status = noteMode === 'error' ? 503 : 200;
      body = noteMode === 'error' ? { error: 'Temporary fixture failure' } : { directory: 'Markdown notes', notes: noteMode === 'empty' ? [] : notes };
    } else if (url.pathname === '/ask') {
      history = JSON.parse(request.postData()).messages;
      status = failAsk ? 503 : 200;
      body = failAsk ? { error: 'Temporary fixture failure' } : { data: { answer: '## Direct answer\n\nA successful explanation.' } };
    } else if (url.pathname === '/ask/save') {
      saved = JSON.parse(request.postData()).messages;
      body = { saved: true };
    }
    if (body) await request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
    else await request.continue();
  });
  await page.reload();
  await page.waitForSelector('.ask-note-link');
  await clickText('Present perfect');
  assert.match(await page.$eval('#ask-note-reader', (el) => el.textContent), /Connect a past event/);
  await page.type('#ask-notes-search', 'independent');
  await page.waitForFunction(() => document.querySelectorAll('.ask-note-link').length === 1);
  assert.match(await page.$eval('#ask-note-reader', (el) => el.textContent), /Comma questions/);
  await page.type('#ask-notes-search', 'notfound');
  await page.waitForFunction(() => document.body.textContent.includes('No notes match'));
  await clickText('Clear search');
  await page.waitForFunction(() => document.querySelectorAll('.ask-note-link').length === 2);
  await page.click('.ask-suggestion');
  assert.ok(await page.$eval('#ask-input', (el) => el.value.length > 10));
  await page.focus('#ask-input');
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');
  await page.waitForSelector('.ask-error');
  assert.equal(await page.$$('.ask-turn').then((items) => items.length), 0);
  assert.ok(await page.$eval('#ask-input', (el) => el.value.length > 10));
  failAsk = false;
  await page.click('.ask-composer .primary');
  await page.waitForSelector('.ask-turn');
  assert.deepEqual(history, [], 'Failed requests must not become conversation history');
  await clickText('Save conversation');
  await page.waitForFunction(() => document.body.textContent.includes('Conversation saved'));
  assert.equal(saved.length, 1);
  assert.match(saved[0].answer, /successful explanation/);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent.includes('Clear chat') && !button.disabled));
  await clickText('Clear chat');
  await page.waitForSelector('.ask-suggestions');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}`);
  }
  noteMode = 'error';
  await page.reload();
  await page.waitForFunction(() => document.body.textContent.includes('Retry loading notes'));
  noteMode = 'ready';
  await clickText('Retry loading notes');
  await page.waitForSelector('.ask-note-link');
  noteMode = 'empty';
  await page.reload();
  await page.waitForFunction(() => document.body.textContent.includes('No saved conversations yet'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ live, states: 'selection, content search, no results, retry, empty, send failure, keyboard send, save, clear', widths: [320, 390, 768, 1440], screenshots: root }));
} finally {
  await browser.close();
}
