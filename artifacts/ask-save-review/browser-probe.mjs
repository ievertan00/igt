import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

assert.ok(process.env.IGT_QA_URL);
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH });
try {
  const page = await browser.newPage();
  let failedWrites = 0;
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/ask/save') { failedWrites++; return request.abort('failed'); }
    if (url.pathname === '/ask/notes') return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ directory: 'Isolated fixture', notes: [] }) });
    if (url.pathname === '/ask') return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { answer: 'An answer to save.', related: [] } }) });
    await request.continue();
  });
  await page.goto(`${process.env.IGT_QA_URL}/#ask`);
  await page.waitForSelector('#ask-input');
  await page.type('#ask-input', 'A review question');
  await page.click('.ask-composer .primary');
  await page.waitForSelector('.ask-answer');
  await page.click('.ask-save-menu summary');
  await page.click('.ask-save-action button');
  await page.waitForFunction(() => document.body.textContent.includes('Save not confirmed'));
  const disabledBeforeChecking = await page.$eval('.ask-save-action button', (button) => button.disabled);
  await page.click('#ask-tab-notes');
  await page.waitForFunction(() => document.body.textContent.includes('No saved conversations yet'));
  await page.evaluate(() => [...document.querySelectorAll('#ask-panel-notes button')].find((button) => button.textContent === 'Refresh').click());
  await page.waitForFunction(() => !document.querySelector('.ask-notes-index .ask-pending'));
  await page.click('#ask-tab-ask');
  const disabledAfterChecking = await page.$eval('.ask-save-action button', (button) => button.disabled);
  assert.equal(disabledBeforeChecking, true);
  assert.equal(disabledAfterChecking, true);
  assert.equal(failedWrites, 1);
  console.log(JSON.stringify({ failedWrites, disabledBeforeChecking, disabledAfterChecking, actualNotesWritten: 0 }));
} finally { await browser.close(); }
