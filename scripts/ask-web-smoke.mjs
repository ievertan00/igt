import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const base = process.env.IGT_QA_URL;
assert.ok(base, 'Set IGT_QA_URL to the running Web app.');
const root = path.join(process.cwd(), 'artifacts', 'ask-qa');
fs.mkdirSync(root, { recursive: true });
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => dialog.accept());
const click = async (label) => page.evaluate((label) => {
  const button = [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === label && el.getClientRects().length);
  if (!button) throw new Error(`Missing visible button: ${label}`);
  button.click();
}, label);
const selectNote = async (title) => page.evaluate((title) => [...document.querySelectorAll('.ask-note-link')].find((el) => el.querySelector('strong').textContent === title).click(), title);
const fill = async (selector, text) => { await page.click(selector); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(selector, text); };
const noOverflow = async (width) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}`);
const waitAnswer = async (count) => page.waitForFunction((count) => document.querySelectorAll('.ask-turn').length === count && !document.querySelector('.ask-composer textarea').readOnly, {}, count);
try {
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${base}/#ask`);
  await page.waitForSelector('.ask-quick-question');
  assert.equal(await page.$eval('.ask-more', (el) => el.getAttribute('aria-expanded')), 'false');
  const initialLayout = await page.evaluate(() => {
    const composer = document.querySelector('.ask-composer').getBoundingClientRect();
    const inspiration = document.querySelector('.ask-welcome').getBoundingClientRect();
    return { composer: composer.height, inspiration: inspiration.height, gap: inspiration.top - composer.bottom };
  });
  assert.ok(initialLayout.composer >= 180 && initialLayout.composer <= 200, JSON.stringify(initialLayout));
  assert.ok(initialLayout.inspiration >= 40 && initialLayout.inspiration <= 60, JSON.stringify(initialLayout));
  assert.ok(initialLayout.gap >= 12 && initialLayout.gap <= 16);
  for (const [label, question] of [
    ['Word choice', "What's the difference between 'affect' and 'effect'?"],
    ['Grammar', "Is 'I have been working' correct here?"],
    ['Tenses', 'Can you explain when to use the present perfect?'],
  ]) {
    await click(label);
    assert.equal(await page.$eval('#ask-input', (el) => el.value), question);
  }
  await click('More');
  assert.equal(await page.$eval('#ask-more-suggestions', (el) => el.hidden), false);
  await page.click('.ask-suggestion');
  assert.equal(await page.$eval('#ask-input', (el) => el.value), "How do I use 'would' to sound more polite?");
  await page.evaluate(() => document.querySelectorAll('.ask-suggestion')[1].click());
  assert.equal(await page.$eval('#ask-input', (el) => el.value), "What's a more natural way to say this?");
  await click('Less');
  assert.equal(await page.$eval('#ask-more-suggestions', (el) => el.hidden), true);
  await fill('#ask-input', 'A longer question with context.\n'.repeat(25));
  assert.equal(await page.$eval('#ask-input', (el) => el.clientHeight <= 320 && el.scrollHeight > el.clientHeight), true, 'Input grows up to its cap and then scrolls');
  await fill('#ask-input', '');
  await page.waitForFunction(() => document.querySelector('.ask-composer .primary').disabled);
  assert.equal(await page.$eval('#ask-panel-notes', (el) => el.hidden), true);
  assert.equal(await page.evaluate(() => document.querySelector('.ask-composer').getBoundingClientRect().top < document.querySelector('.ask-welcome').getBoundingClientRect().top), true);
  await page.screenshot({ path: path.join(root, 'ask-desktop.png'), fullPage: true });
  await click('Saved notes');
  await page.waitForFunction(() => !document.querySelector('.ask-notes-index .ask-pending'));
  const live = await page.evaluate(() => ({ notes: document.querySelectorAll('.ask-note-link').length, error: Boolean(document.querySelector('.ask-notes-index .ask-error')) }));
  assert.equal(live.error, false, 'Real notes must load through the API proxy');
  if (live.notes) {
    await page.click('.ask-note-link');
    await page.waitForSelector('#ask-note-reader .md');
    await page.screenshot({ path: path.join(root, 'ask-notes-desktop.png'), fullPage: true });
  }
  await page.setViewport({ width: 390, height: 844 });
  if (live.notes) {
    await page.screenshot({ path: path.join(root, 'ask-note-mobile.png'), fullPage: true });
    await click('Back to notes');
  }
  await page.screenshot({ path: path.join(root, 'ask-notes-mobile.png'), fullPage: true });
  await click('Ask a question');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 1000 }); await noOverflow(width);
    await click('More'); await noOverflow(width);
    await click('Less');
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(root, 'ask-mobile.png'), fullPage: true });
  let failAsk = true;
  let noteMode = 'ready';
  let holdAsk;
  let saveCount = 0;
  let sentHistory;
  let saved;
  const notes = [
    { id: 'Comma questions.md', modifiedAt: '2026-10-21T10:00:00Z', bytes: 20, content: '**Q:** When should I use a comma?\n\n## Direct answer\n\nUse a comma between **independent clauses**.\n\n> I went home, and she stayed.\n\n| Type | Example |\n| --- | --- |\n| Coordinating | and |\n\n```text\n' + 'long_code_'.repeat(40) + '\n```\n\n<script>window.unsafeAsk = true</script>\n\n' + Array.from({ length: 18 }, (_, i) => `### Example ${i + 1}\n\n${'Meaningful context. '.repeat(20)}`).join('\n\n') + '\n\nEND OF COMPLETE NOTE' },
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
      const payload = JSON.parse(request.postData());
      sentHistory = payload.messages;
      if (holdAsk) await holdAsk;
      status = failAsk ? 503 : 200;
      body = failAsk ? { error: 'Temporary fixture failure' } : { data: { answer: `## Direct answer\n\nA successful explanation for ${payload.question}.\n\n> A natural English example.\n\n| Rule | Use |\n| --- | --- |\n| Context | Matters |`, related: ['Could you give another example?', 'How does the tone change?', 'When would I use this expression?'] } };
    } else if (url.pathname === '/ask/save') {
      saveCount++;
      saved = JSON.parse(request.postData()).messages;
      body = { saved: true, vaultFile: 'Saved answer.md' };
      if (!notes.some((note) => note.id === body.vaultFile)) notes.push({ id: body.vaultFile, content: saved.map((turn) => `**Q:** ${turn.question}\n\n${turn.answer}`).join('\n\n'), modifiedAt: new Date().toISOString(), bytes: 30 });
    }
    if (body) await request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
    else await request.continue();
  });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.reload();
  await page.waitForSelector('.ask-quick-question');
  await click('Word choice');
  const initial = await page.$eval('#ask-input', (el) => el.value);
  assert.ok(initial.length > 10);
  await click('Saved notes');
  await page.waitForSelector('.ask-note-link');
  assert.match(await page.$eval('#ask-note-reader', (el) => el.textContent), /Choose a note/);
  await selectNote('Present perfect');
  await page.waitForFunction(() => document.querySelector('#ask-note-reader').textContent.includes('Connect a past event'));
  await fill('#ask-notes-search', 'independent');
  assert.equal(await page.$$('.ask-note-link').then((items) => items.length), 1);
  assert.match(await page.$eval('#ask-note-reader', (el) => el.textContent), /Connect a past event/, 'Search keeps the open note');
  await fill('#ask-notes-search', 'notfound');
  await page.waitForFunction(() => document.body.textContent.includes('No notes match'));
  await click('Clear search');
  await selectNote('Comma questions');
  await page.waitForFunction(() => document.querySelector('#ask-note-reader').textContent.includes('END OF COMPLETE NOTE'));
  assert.equal(await page.$$('#ask-note-reader table').then((items) => items.length), 1);
  assert.equal(await page.$$('#ask-note-reader script').then((items) => items.length), 0);
  assert.equal(await page.evaluate(() => window.unsafeAsk), undefined);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 1000 });
    await noOverflow(width);
    if (width <= 760) {
      assert.equal(await page.$eval('.ask-notes-index', (el) => getComputedStyle(el).display), 'none');
      await click('Back to notes');
      assert.equal(await page.$eval('#ask-note-reader', (el) => getComputedStyle(el).display), 'none');
      await selectNote('Comma questions');
    }
  }
  await click('Ask a question');
  assert.equal(await page.$eval('#ask-input', (el) => el.value), initial, 'Draft survives tab changes');
  await page.focus('#ask-input');
  await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control');
  await page.waitForSelector('.ask-error');
  assert.equal(await page.$$('.ask-turn').then((items) => items.length), 0);
  assert.equal(await page.$eval('#ask-input', (el) => el.value), initial);
  failAsk = false;
  await click('Ask');
  await waitAnswer(1);
  assert.deepEqual(sentHistory, [], 'Failed requests do not enter conversation history');
  await page.click('.ask-save-menu summary');
  await click('Save this answer');
  await page.waitForFunction(() => document.body.textContent.includes('Saved to Markdown notes'));
  assert.equal(saved.length, 1);
  await page.evaluate(() => [...document.querySelectorAll('.ask-response-actions button')].find((el) => el.textContent.includes('Saved to notes')).click());
  assert.equal(saveCount, 1, 'Repeated save does not send another write');
  await click('Copy response');
  await page.waitForFunction(() => document.body.textContent.includes('Response copied'));
  let release;
  holdAsk = new Promise((resolve) => { release = resolve; });
  await page.click('.ask-related-question');
  await page.waitForFunction(() => document.querySelector('.ask-composer textarea').readOnly);
  await click('Saved notes');
  release(); holdAsk = undefined;
  await waitAnswer(2);
  assert.equal(await page.$eval('#ask-panel-notes', (el) => el.hidden), false, 'Late answers do not switch tabs');
  assert.equal(sentHistory.length, 1, 'Related questions continue the current discussion');
  await click('Ask a question');
  assert.equal(await page.evaluate(() => {
    const answer = document.querySelector('.ask-answer');
    const composer = document.querySelector('.ask-composer');
    const send = composer.querySelector('.primary').getBoundingClientRect();
    const box = composer.getBoundingClientRect();
    const cards = [...document.querySelectorAll('.ask-related-grid:first-of-type .ask-related-question')].slice(0, 3).map((el) => el.getBoundingClientRect());
    return answer.contains(document.querySelector('.ask-response-actions')) && send.bottom <= box.bottom && send.right <= box.right && cards.every((card) => card.top === cards[0].top);
  }), true, 'Answer actions stay inside the result frame, Send stays inside the composer, and related cards share a row on desktop');
  await page.evaluate(() => [...document.querySelectorAll('.ask-save-menu summary')].at(-1).click());
  await click('Save full conversation');
  assert.equal(saved.length, 2, 'The consolidated save menu retains full-conversation saving');
  await page.evaluate(() => document.querySelectorAll('.ask-save-menu').forEach((menu) => { menu.open = false; }));
  await click('Back to question');
  assert.equal(await page.$$('.ask-turn').then((items) => items.length), 1, 'Going back preserves earlier answers');
  assert.equal(await page.$eval('#ask-input', (el) => el.value), 'Could you give another example?', 'Going back restores the submitted question for editing');
  await page.click('.ask-previous summary');
  await page.click('.ask-previous button');
  assert.equal(await page.$$('.ask-turn').then((items) => items.length), 2, 'The complete discussion remains available after going back');
  await fill('#ask-input', 'An unsent follow-up');
  await page.evaluate(() => { location.hash = '#translation'; });
  await page.waitForFunction(() => document.title.startsWith('Express'));
  await page.evaluate(() => { location.hash = '#ask'; });
  await page.waitForFunction(() => document.title.startsWith('Ask'));
  assert.equal(await page.$eval('#ask-input', (el) => el.value), 'An unsent follow-up');
  assert.equal(await page.$$('.ask-turn').then((items) => items.length), 2);
  await page.screenshot({ path: path.join(root, 'ask-conversation-desktop.png'), fullPage: true });
  await click('New question');
  assert.equal(await page.$$('.ask-turn').then((items) => items.length), 0);
  await page.click('.ask-previous summary');
  await page.evaluate(() => [...document.querySelectorAll('.ask-previous button')].at(-1).click());
  assert.equal(await page.$$('.ask-turn').then((items) => items.length), 2, 'New question retains the prior discussion');
  await click('Saved notes');
  await selectNote('Comma questions');
  await click('Continue discussing');
  await page.waitForSelector('.ask-context');
  assert.equal(await page.$eval('#ask-panel-ask', (el) => el.hidden), false);
  await fill('#ask-input', 'Explain the saved example');
  await click('Send');
  await waitAnswer(1);
  assert.equal(sentHistory[0].answer, notes[0].content, 'Complete original Markdown is passed as context');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 1000 }); await noOverflow(width);
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(root, 'ask-conversation-mobile.png'), fullPage: true });
  await page.focus('#ask-tab-ask'); await page.keyboard.press('ArrowRight');
  assert.equal(await page.$eval('#ask-tab-notes', (el) => el.getAttribute('aria-selected')), 'true');
  await click('Back to notes');
  noteMode = 'error'; await click('Refresh');
  await page.waitForFunction(() => document.body.textContent.includes('Retry loading notes'));
  noteMode = 'ready'; await click('Retry loading notes');
  await page.waitForFunction(() => !document.querySelector('.ask-notes-index .ask-error'));
  noteMode = 'empty'; await click('Refresh');
  await page.waitForFunction(() => document.body.textContent.includes('No saved conversations yet'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ live, initialLayout, widths: [320, 390, 768, 1440], states: 'quick questions, More/Less, capped input growth, tabs, draft/navigation retention, search/selection, complete Markdown, mobile list/detail, failure/retry, related/pending, save deduplication, copy, previous questions, note context, empty', screenshots: root }));
} finally { await browser.close(); }
