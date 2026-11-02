import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { preview } from 'vite';
import { buildGrammarHistory } from '../lib/application/grammar-history.mjs';
import { buildLearningOverview } from '../lib/application/learning-overview.mjs';
const output = path.join(process.cwd(), '.cache', 'navigation-stability');
fs.mkdirSync(output, { recursive: true });
const server = await preview({ configFile: 'apps/web/vite.config.ts', preview: { host: '127.0.0.1', port: 0 } });
let browser;
try {
 browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH });
 const page = await browser.newPage();
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 const base = `http://127.0.0.1:${server.httpServer.address().port}`;
 const entries = Array.from({length:10}, (_,i)=>({source:'grammar',entryId:`fixture-${i}`,timestamp:new Date().toISOString(),userInput:'I read book.',correction:'I read a book.',diagnoses:[]}));
 await page.setRequestInterception(true);
 page.on('request', async request => {
  const url = new URL(request.url());
  if(url.origin !== base) return request.abort();
  if(url.pathname==='/' || url.pathname.startsWith('/assets/')) return request.continue();
  const fixtures = {
   '/vocab/words': { words: [], total: 0, totalSaved: 0, sourceAvailable: true, limit: 30, offset: 0, hasMore: false },
   '/review/due': { cards: [] },
   '/ask/notes': { notes: [] },
   '/coach': { days: 90, checks: 0, patterns: [], coverage: {} },
   '/dashboard': buildLearningOverview([]),
  };
  const body = url.pathname==='/handbook' ? buildGrammarHistory(entries) : fixtures[url.pathname] || {};
  return request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const checks=[];
 for (const width of [1440,1024,768,390,320]) {
  await page.setViewport({width,height:844});
  let baseline;
  for (const route of ['grammar','word-lookup','word-library','word-review','practice','ask','ask?view=notes','handbook','coach','dashboard']) {
   await page.goto(`${base}/#${route}`,{waitUntil:'networkidle0'});
   await page.waitForSelector('.nav-primary');
   if (width <= 960) await page.click('.menu-toggle');
   assert.deepEqual(await page.$$eval('.nav-primary > a, .nav-primary > details > summary', nodes => nodes.map(node => node.textContent.trim())), ['Writing','Vocabulary','Practice','Ask','My learning'], `${width}/${route}: ${errors.join('; ')}`);
   await page.click('.nav-primary > details:nth-of-type(2) > summary');
   assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.nav-primary > details')[1].querySelectorAll('a')].map(node => node.textContent.trim())), ['Overview','Saved words','Saved notes','Handbook','Coach']);
   const inLearning = ['word-library','word-review','ask?view=notes','handbook','coach','dashboard'].includes(route);
   assert.equal(await page.evaluate(() => document.querySelectorAll('.nav-primary > details')[1].querySelector('summary').classList.contains('active')), inLearning);
   assert.equal(await page.$$eval('.nav-primary [aria-current="page"]', nodes => nodes.length), route === 'word-review' ? 0 : 1);
   if (route === 'word-lookup') await page.screenshot({path:path.join(output,`menu-${width}.png`)});
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(() => document.querySelectorAll('.nav-primary > details')[1].open), false);
   if (route === 'word-lookup' || route === 'word-library') {
    await page.click(route === 'word-lookup' ? '.lookup-learning-actions a[href="#word-review"]' : '.vocabulary-library-header a.primary[href="#word-review"]');
    await page.waitForFunction(() => location.hash === '#word-review');
    await page.goto(`${base}/#${route}`, {waitUntil:'networkidle0'});
    if (width <= 960) await page.click('.menu-toggle');
   }
   const geometry = await page.evaluate(()=>[...document.querySelectorAll('.nav-primary, .nav-primary > a, .nav-primary > details > summary')].map(e=>({x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width})));
   if (!baseline) baseline=geometry;
   checks.push({viewport:width,route,geometry});
   for(let i=0;i<geometry.length;i++) {
    assert.ok(Math.abs(geometry[i].x-baseline[i].x)<1, `${route}/${width}: navigation item ${i} shifted horizontally by ${geometry[i].x-baseline[i].x}px`);
    assert.ok(Math.abs(geometry[i].width-baseline[i].width)<1, `${route}/${width}: navigation item ${i} changed width`);
   }
   await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   assert.equal(await page.$eval('.topbar', e=>Math.round(e.getBoundingClientRect().top)),0,`Sticky on ${route}`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if (width <= 960) await page.click('.menu-toggle');
   await page.evaluate(() => window.scrollTo(0, 0));
   await page.screenshot({path:path.join(output,`${route.replace('?view=', '-')}-${width}.png`)});
  }
 }
 fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(checks,null,2));
 assert.deepEqual(errors, []);
 console.log('Navigation grouping, active destinations, lookup-to-review action, stable positions, sticky header, and overflow checks passed at five viewport widths.');
} finally {await browser?.close();await server.close();}
