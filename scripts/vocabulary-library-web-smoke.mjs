import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { preview } from "vite";
import { listSavedVocabulary } from "../lib/application/vocabulary-library.mjs";

const parent = path.join(process.cwd(), ".cache");
fs.mkdirSync(parent, { recursive: true });
const dir = fs.mkdtempSync(path.join(parent, "library-browser-"));
const file = path.join(dir, "words.md");
const content = Array.from({ length: 31 }, (_, index) => {
  const word = index === 0 ? "follow up" : `word${String(index).padStart(2, "0")}`;
  return `### ${word}
**PoS:** phrasal verb · /ˈfɒləʊ ʌp/
**Meaning:** ${index === 1 ? "A longer definition that explains how an expression is used in a practical situation, with enough context to keep the full meaning readable on narrow screens." : "to act after an earlier event"}
**中文:** ${index === 0 ? "跟进" : "在特定的场景下理解并使用这个表达"}
**Synonyms:** check back, pursue
**Collocations:** follow up on a request
**Example 1:** I will follow up tomorrow.
**Example 2:** Please follow up on the request.
**Example 3:** She followed up yesterday.
**Note:** Use on for a task and with for a person.
**Memory:** Think of a second step after the first action.
*Added: 2026-10-${String(index + 1).padStart(2, "0")}*
`;
}).join("\n");
fs.writeFileSync(file, content);
const server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [], writes = [], requests = [];
  let failOnce = false, missing = false;
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url());
    const json = (body, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/vocab/words") {
      requests.push(url.search);
      if (failOnce) { failOnce = false; return json({ error: "Vocabulary temporarily unavailable" }, 500); }
      return json(listSavedVocabulary({ config: { VocabularyPath: missing ? path.join(dir, "missing.md") : file },
        search: url.searchParams.get("q"), sort: url.searchParams.get("sort"),
        limit: Number(url.searchParams.get("limit")), offset: Number(url.searchParams.get("offset")) }));
    }
    if (url.pathname === "/runtime" || url.pathname === "/status-message") return json({});
    if (url.pathname === "/vocab/seed") return json({ seeded: 0 });
    if (url.pathname === "/review/due") return json({ cards: [] });
    if (request.method() === "POST") { writes.push(url.pathname); return request.abort(); }
    return request.continue();
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const output = path.join(process.cwd(), "artifacts", "vocabulary-library");
  fs.mkdirSync(output, { recursive: true });
  async function capture(name) {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} overflows at ${width}`);
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
    }
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${base}/#word-library`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".saved-word");
  assert.equal(await page.title(), "Saved words · ClearWrite");
  assert.equal(await page.$eval("a[href='#word-library']", el => el.getAttribute("aria-current")), "page");
  assert.equal(await page.$$eval(".saved-word", els => els.length), 25);
  assert.match(await page.$eval(".vocabulary-library-status", el => el.textContent), /31 saved words/);
  await capture("list");
  const listHeight = await page.$eval('.vocabulary-library-list', el => el.getBoundingClientRect().height);
  await page.focus(".saved-word-row");
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('#saved-word-dialog').open);
  assert.equal(await page.$eval('.saved-word-dialog-header button', el => document.activeElement === el), true);
  assert.equal(await page.$eval('.vocabulary-library-list', el => el.getBoundingClientRect().height), listHeight, 'opening details does not expand the list');
  assert.equal(await page.$$eval("#saved-word-dialog .word-examples li", els => els.length), 3);
  assert.equal(await page.$$eval("#saved-word-dialog .audio-btn", els => els.length), 4);
  assert.match(await page.$eval("#saved-word-dialog", el => el.textContent), /Memory cue/);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.$eval('#saved-word-dialog', el => el.contains(document.activeElement)), true, 'focus stays inside the dialog');
  }
  await page.$eval(".saved-word-details", el => { el.scrollTop = 0; });
  await capture("details");
  assert.equal(await page.$eval('#saved-word-dialog', el => {
    const box=el.getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight && el.scrollWidth <= el.clientWidth;
  }), true, 'dialog fits narrow viewport');
  assert.equal(await page.$eval('.saved-word-details', el => el.scrollHeight > el.clientHeight), true, 'long details scroll independently');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#saved-word-dialog').open);
  assert.equal(await page.$eval('.saved-word-row', el => document.activeElement === el), true);
  assert.equal(await page.evaluate(() => scrollY), scrollBefore);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.click('.saved-word-row');
  await page.waitForFunction(() => document.querySelector('#saved-word-dialog').open);
  await page.click('.saved-word-dialog-header button');
  await page.waitForFunction(() => !document.querySelector('#saved-word-dialog').open);
  await page.click('.saved-word-row');
  await page.waitForFunction(() => document.querySelector('#saved-word-dialog').open);
  await page.mouse.click(2, 2);
  await page.waitForFunction(() => !document.querySelector('#saved-word-dialog').open);
  await page.click(".vocabulary-library-pagination button:last-child");
  await page.waitForFunction(() => document.querySelectorAll('.saved-word').length === 6);
  assert.match(await page.$eval(".vocabulary-library-pagination", el => el.textContent), /26–31/);
  await page.select("#saved-word-sort", "newest");
  await page.waitForFunction(() => document.querySelector('.saved-word-name strong')?.textContent === 'word30');
  await page.type("#saved-word-search", "跟进");
  await page.waitForFunction(() => document.querySelectorAll('.saved-word').length === 1);
  assert.match(await page.$eval(".saved-word-name", el => el.textContent), /follow up/);
  await page.type("#saved-word-search", "不存在");
  await page.waitForFunction(() => document.body.textContent.includes("No matching words"));
  await capture("no-results");
  await page.click(".vocabulary-library-empty button");
  await page.waitForSelector(".saved-word");
  failOnce = true;
  await page.type("#saved-word-search", "temporary");
  await page.waitForFunction(() => document.body.textContent.includes("Could not load your vocabulary"));
  await page.click(".vocabulary-library-empty button");
  await page.waitForFunction(() => document.body.textContent.includes("No matching words"));
  missing = true;
  await page.click(".vocabulary-library-empty button");
  await page.waitForFunction(() => document.body.textContent.includes("Vocabulary file not found"));
  assert.equal(await page.$eval(".vocabulary-library-empty a", el => el.hash), "#settings");
  missing = false;
  fs.writeFileSync(file, "# Empty vocabulary\n");
  await page.goto(`${base}/#grammar`); await page.waitForSelector("textarea");
  await page.goto(`${base}/#word-library`);
  await page.waitForFunction(() => document.body.textContent.includes("Your vocabulary starts here"));
  await capture("empty");
  await page.click(".vocabulary-library-header a");
  await page.waitForSelector(".word-review-page");
  await page.goto(`${base}/#word-lookup`); await page.waitForSelector("#word-lookup-input");
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  assert.ok(requests.length > 5);
  console.log("Saved Words browser checks passed: navigation, 31 source entries, paging, sorting, Chinese search, complete details/audio controls, independent modal, focus trap/restore, Escape/close/backdrop, independent scrolling, empty/missing/error recovery, 320/390/768/1440px, Review/Lookup siblings, no learning writes.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  assert.equal(path.dirname(dir), parent); fs.rmSync(dir, { recursive: true, force: true });
}
