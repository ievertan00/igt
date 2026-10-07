import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { getInstalledBrowsers } from '@puppeteer/browsers';
import { preview } from 'vite';

const output = import.meta.dirname;
const server = await preview({ configFile: 'apps/web/vite.config.ts', preview: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || await puppeteer.executablePath();
  if (!fs.existsSync(executablePath)) {
    const configuration = await puppeteer.configuration();
    const installed = await getInstalledBrowsers({ cacheDir: configuration.cacheDirectory });
    executablePath = installed.find(item => item.browser === 'chrome' && fs.existsSync(item.executablePath))?.executablePath || executablePath;
  }
  browser = await puppeteer.launch({ headless: true, executablePath });
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  let failRequest = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const route = new URL(request.url()).pathname;
    const respond = (data, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (route === '/runtime') return respond({ runtime: 'local', storage: { database: 'sqlite', assets: 'markdown' } });
    if (route === '/status-message') return respond({ content: '' });
    if (route === '/translation') {
      const body = JSON.parse(request.postData());
      requests.push(body);
      if (failRequest) return respond({ error: { message: 'Please retry.' } }, 500);
      return respond({ data: body.direction === 'zh2en'
        ? { translation: 'Could we move our meeting to tomorrow?', notes: 'Could we makes a polite request.' }
        : { translation: '我们能把会议改到明天吗？', notes: 'Move a meeting means change its scheduled time.' } });
    }
    return request.continue();
  });
  const url = `http://127.0.0.1:${server.httpServer.address().port}/#translation`;
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1000 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('a[href="#translation"]', element => element.textContent.trim()), 'Express');
    assert.equal(await page.$eval('main button.primary', element => element.disabled), true);
    await page.type('#translation-input', '我想礼貌地问同事，能否把会议改到明天。');
    await page.click('main button.primary');
    await page.waitForSelector('.translation-result');
    assert.equal(requests.at(-1).direction, 'zh2en');
    assert.ok(await page.evaluate(() => document.querySelector('main').innerText.includes('Why this works')));
    await page.screenshot({ path: path.join(output, `zh2en-${width}.png`), fullPage: true });
    await page.click('.switches button:nth-child(2)');
    assert.equal(await page.$('.translation-result'), null);
    assert.equal(await page.$eval('.switches button:nth-child(2)', element => element.getAttribute('aria-pressed')), 'true');
    await page.$eval('#translation-input', element => { element.focus(); element.select(); });
    await page.type('#translation-input', 'Could we move our meeting to tomorrow?');
    await page.click('main button.primary');
    await page.waitForSelector('.translation-result');
    assert.equal(requests.at(-1).direction, 'en2zh');
    assert.ok(await page.evaluate(() => document.querySelector('main').innerText.includes('Meaning in Chinese')));
    assert.ok(await page.evaluate(() => document.querySelector('main').innerText.includes('Expression notes')));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, `en2zh-${width}.png`), fullPage: true });
  }
  failRequest = true;
  await page.click('main button.primary');
  await page.waitForFunction(() => document.querySelector('main').innerText.includes('Try again.'));
  assert.equal(await page.$eval('main button.primary', element => element.disabled), false);
  assert.deepEqual(errors, []);
  console.log('Express browser checks passed: both directions, result reset, notes, error recovery, desktop/mobile layout, no page errors. Responses were mocked.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
