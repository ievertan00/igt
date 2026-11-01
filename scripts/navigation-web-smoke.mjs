import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { preview } from 'vite';
import { buildGrammarHistory } from '../lib/application/grammar-history.mjs';
const output = path.join(process.cwd(), 'artifacts', 'navigation-stability');
fs.mkdirSync(output, { recursive: true });
const server = await preview({ configFile: 'apps/web/vite.config.ts', preview: { host: '127.0.0.1', port: 0 } });
let browser;
try {
 browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH });
 const page = await browser.newPage();
 const base = `http://127.0.0.1:${server.httpServer.address().port}`;
 const entries = Array.from({length:10}, (_,i)=>({source:'grammar',entryId:`fixture-${i}`,timestamp:new Date().toISOString(),userInput:'I read book.',correction:'I read a book.',diagnoses:[]}));
 await page.setRequestInterception(true);
 page.on('request', async request => {
  const url = new URL(request.url());
  if(url.origin !== base) return request.abort();
  if(url.pathname==='/' || url.pathname.startsWith('/assets/')) return request.continue();
  const body = url.pathname==='/handbook' ? buildGrammarHistory(entries) : url.pathname==='/ask/notes' ? {notes:[]} : {};
  return request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const checks=[];
 for (const width of [1400,1024]) {
  await page.setViewport({width,height:844});
  let baseline;
  for (const route of ['grammar','practice','ask','handbook']) {
   await page.goto(`${base}/#${route}`,{waitUntil:'networkidle0'});
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
   await page.screenshot({path:path.join(output,`${route}-${width}.png`)});
  }
 }
 fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(checks,null,2));
 console.log('Navigation remains in the same horizontal position across Writing, Practice, Ask and My learning, and stays pinned while scrolling.');
} finally {await browser?.close();await server.close();}
