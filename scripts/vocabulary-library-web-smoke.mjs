import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { preview } from "vite";
import Database from "better-sqlite3";
import { listSavedVocabulary, readVocabularyHistory } from "../lib/application/vocabulary-library.mjs";

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
const db = new Database(":memory:");
for (const name of ["001_initial_schema.sql", "009_practice_attempts.sql"]) db.exec(fs.readFileSync(path.join(process.cwd(), "migrations", name), "utf8"));
for (let index = 0; index < 31; index++) {
  const word = index === 0 ? "follow up" : `word${String(index).padStart(2, "0")}`;
  db.prepare("INSERT INTO srs_cards (source_type,prompt,answer,word,due_date,total_reviews,interval_days,last_reviewed) VALUES ('vocab',?,?,?,?,?,?,?)")
    .run(word, word, word, index % 3 ? "2099-01-01" : "2026-10-01", [24, 1, 1, 2, 1][index] || 0, index === 0 ? 19 : 0, index === 0 ? "2026-10-23 12:00:00" : null);
}
for (let i = 0; i < 23; i++) db.prepare("INSERT INTO practice_attempts (activity_type,prompt,learner_answer,reference_answer,score,feedback,created_at) VALUES ('review-vocabulary','follow up',?, 'follow up',100,?,?)")
  .run(i === 0 ? "follow-up" : "follow up", JSON.stringify({ cardId: 1, correct: true, rating: i === 0 ? "hard" : "good", audioPlayed: false, result: { next: { intervalDays: 19, dueDate: "2026-11-09" } } }), `2026-10-${String(i === 22 ? 23 : Math.min(16, i + 1)).padStart(2, "0")} 12:00:00`);
for (const [cardId, dates, correct] of [[2, ['22'], true], [3, ['22'], false], [4, ['21', '22'], true]]) {
  for (const day of dates) db.prepare("INSERT INTO practice_attempts (activity_type,prompt,learner_answer,reference_answer,score,feedback,created_at) VALUES ('review-vocabulary',?,?,?,?,?,?)")
    .run(`word0${cardId - 1}`, correct ? `word0${cardId - 1}` : 'wrong', `word0${cardId - 1}`, correct ? 100 : 0, JSON.stringify({ cardId, correct, audioPlayed: false, rating: 'good' }), `2026-10-${day} 12:00:00`);
}
const server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [], writes = [], requests = [];
  let failOnce = false, missing = false, historyFailOnce = false, historyRequests = 0, unavailable = false;
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url());
    const json = (body, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/vocab/words") {
      requests.push(url.search);
      if (failOnce) { failOnce = false; return json({ error: "Vocabulary temporarily unavailable" }, 500); }
      return json(listSavedVocabulary({ config: { VocabularyPath: missing ? path.join(dir, "missing.md") : file }, db: unavailable ? null : db,
        search: url.searchParams.get("q"), sort: url.searchParams.get("sort"),
        schedule: url.searchParams.get("schedule") || "all", status: url.searchParams.get("status") || "all",
        limit: Number(url.searchParams.get("limit")), offset: Number(url.searchParams.get("offset")) }));
    }
    if (url.pathname === "/vocab/history") {
      historyRequests++;
      if (historyFailOnce) { historyFailOnce = false; return json({ error: "History temporarily unavailable" }, 500); }
      return json(readVocabularyHistory(db, { cardId: Number(url.searchParams.get("card_id")), offset: Number(url.searchParams.get("offset")) }));
    }
    if (url.pathname === "/runtime" || url.pathname === "/status-message") return json({});
    if (url.pathname === "/vocab/seed") return json({ seeded: 0 });
    if (url.pathname === "/review/due") return json({ cards: [] });
    if (request.method() === "POST") { writes.push(url.pathname); return request.abort(); }
    return request.continue();
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const output = process.env.IGT_VOCABULARY_QA_OUTPUT || path.join(process.cwd(), "artifacts", "vocabulary-library");
  fs.mkdirSync(output, { recursive: true });
  async function capture(name) {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} overflows at ${width}`);
      assert.equal(await page.$$eval('.vocabulary-library-filters select', selects => {
        const boxes = selects.map(el => el.getBoundingClientRect());
        return boxes.every(box => Math.abs(box.width - boxes[0].width) < 1 && box.height === 44)
          && (innerWidth <= 640 || boxes.every(box => box.top === boxes[0].top));
      }), true, `filter dimensions/alignment at ${width}`);
      assert.equal(await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open]');
        if (!dialog) return true;
        const box = dialog.getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight && dialog.scrollWidth <= dialog.clientWidth;
      }), true, `modal fits ${width}`);
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: !(await page.$('dialog[open]')) });
      const audioButtons = await page.$$eval('#saved-word-dialog[open] .audio-btn', buttons => buttons.map(button => {
        const box = button.getBoundingClientRect();
        const icon = button.querySelector('.icon, .loading-spinner').getBoundingClientRect();
        return { width: box.width, height: box.height, iconWidth: icon.width, iconHeight: icon.height };
      }));
      for (const button of audioButtons) {
        assert.equal(button.width, button.height, `speaker button must stay circular at ${width}: ${JSON.stringify(button)}`);
        assert.ok(button.width >= 44, `speaker target must be at least 44px at ${width}`);
        assert.equal(button.iconWidth, button.iconHeight, `speaker icon must stay square at ${width}`);
      }
    }
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${base}/#word-library`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".saved-word");
  assert.equal(await page.title(), "Saved words · ClearWrite");
  assert.equal(await page.$eval("a[href='#word-library']", el => el.getAttribute("aria-current")), "page");
  assert.equal(await page.$$eval(".saved-word", els => els.length), 25);
  assert.match(await page.$eval(".vocabulary-library-status", el => el.textContent), /31 saved words/);
  assert.equal(await page.$('#saved-word-search'), null, 'search bar has been removed');
  assert.deepEqual(await page.$$eval('.vocabulary-overview-metric strong', els => els.map(el => el.textContent)), ['31', '11']);
  assert.deepEqual(await page.$$eval('.vocabulary-distribution-value strong', els => els.map(el => el.textContent)), ['26', '1', '1', '1', '1', '1']);
  assert.equal(await page.$eval('#vocabulary-status-guide', el => el.open), false);
  await page.focus('.vocabulary-status-guide-trigger'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#vocabulary-status-guide').open);
  assert.match(await page.$eval('#vocabulary-status-guide', el => el.textContent), /7 actual days/);
  assert.equal(await page.$$eval('#vocabulary-status-guide dt', items => items.length), 6);
  await page.keyboard.press('Tab');
  assert.equal(await page.$eval('#vocabulary-status-guide', el => el.contains(document.activeElement)), true);
  await capture('status-guide');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#vocabulary-status-guide').open);
  assert.equal(await page.$eval('.vocabulary-status-guide-trigger', el => el === document.activeElement), true);
  await page.click('.vocabulary-status-guide-trigger');
  await page.waitForFunction(() => document.querySelector('#vocabulary-status-guide').open);
  await page.click('#vocabulary-status-guide button');
  await page.waitForFunction(() => !document.querySelector('#vocabulary-status-guide').open);
  await page.click('.vocabulary-status-guide-trigger');
  await page.waitForFunction(() => document.querySelector('#vocabulary-status-guide').open);
  await page.mouse.click(2, 2);
  await page.waitForFunction(() => !document.querySelector('#vocabulary-status-guide').open);
  await capture("list");
  const listHeight = await page.$eval('.vocabulary-library-list', el => el.getBoundingClientRect().height);
  await page.focus(".saved-word-row");
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('#saved-word-dialog').open);
  assert.equal(await page.$eval('#saved-word-dialog .saved-word-dialog-header button', el => document.activeElement === el), true);
  assert.equal(await page.$eval('.vocabulary-library-list', el => el.getBoundingClientRect().height), listHeight, 'opening details does not expand the list');
  assert.equal(await page.$$eval("#saved-word-dialog .word-examples li", els => els.length), 3);
  assert.equal(await page.$$eval("#saved-word-dialog .audio-btn", els => els.length), 4);
  assert.match(await page.$eval("#saved-word-dialog", el => el.textContent), /Memory cue/);
  assert.equal(await page.$$eval('.word-history-record', els => els.length), 0);
  assert.equal(historyRequests, 0, 'word details no longer load review history');
  assert.equal(await page.$('#saved-word-dialog .word-status'), null);
  assert.equal(await page.$eval('.saved-word-dialog-status', el => el.textContent), 'Well retained');
  assert.equal(await page.$eval('.saved-word-dialog-status i', el => getComputedStyle(el).backgroundColor), 'rgb(61, 128, 91)');
  assert.doesNotMatch(await page.$eval('#saved-word-dialog', el => el.textContent), /Word status|Next review|Total reviews|Last reviewed|Current interval|Review history/);
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
  assert.equal(await page.$eval('.saved-word-row', el => getComputedStyle(el).outlineStyle), 'none', 'Escape restores list position without leaving an outline');
  await page.keyboard.press('Tab');
  assert.equal(await page.$('.saved-word-row[data-restored-focus="true"]'), null, 'keyboard navigation clears focus suppression');
  assert.equal(await page.evaluate(() => document.activeElement.matches('.saved-word-row:focus-visible') && getComputedStyle(document.activeElement).outlineStyle !== 'none'), true, 'the next word retains visible keyboard focus');

  assert.equal(await page.evaluate(() => scrollY), scrollBefore);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.click('.saved-word-row');
  await page.waitForFunction(() => document.querySelector('#saved-word-dialog').open);
  await page.click('#saved-word-dialog .saved-word-dialog-header button');
  await page.waitForFunction(() => !document.querySelector('#saved-word-dialog').open);
  await page.click('.saved-word-row');
  await page.waitForFunction(() => document.querySelector('#saved-word-dialog').open);
  await page.mouse.click(2, 2);
  await page.waitForFunction(() => !document.querySelector('#saved-word-dialog').open);
  await page.click('.saved-word:nth-child(6) .saved-word-row');
  await page.waitForFunction(() => document.querySelector('#saved-word-dialog').open);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#saved-word-dialog').open);
  await page.click('.vocabulary-distribution-item[data-learning-status="well-retained"]');
  await page.waitForFunction(() => document.querySelectorAll('.saved-word').length === 1);
  assert.equal(await page.$eval('#saved-word-status', el => el.value), 'well-retained');
  await page.select('#saved-word-schedule', 'upcoming');
  await page.waitForFunction(() => document.body.textContent.includes('No matching words'));
  await capture('no-results');
  await page.click('.vocabulary-library-empty button');
  await page.waitForFunction(() => document.querySelectorAll('.saved-word').length === 25);
  await page.select('#saved-word-sort', 'next-review');
  await page.waitForFunction(() => !document.body.textContent.includes('Loading saved words'));
  await page.select('#saved-word-sort', 'az');
  await page.waitForFunction(() => !document.body.textContent.includes('Loading saved words'));
  await page.click(".vocabulary-library-pagination button:last-child");
  await page.waitForFunction(() => document.querySelectorAll('.saved-word').length === 6);
  assert.match(await page.$eval(".vocabulary-library-pagination", el => el.textContent), /26–31/);
  await page.select("#saved-word-sort", "newest");
  await page.waitForFunction(() => document.querySelector('.saved-word-name strong')?.textContent === 'word30');
  failOnce = true;
  await page.select('#saved-word-sort', 'az');
  await page.waitForFunction(() => document.body.textContent.includes("Could not load your vocabulary"));
  await page.click(".vocabulary-library-empty button");
  await page.waitForSelector('.saved-word');
  missing = true;
  await page.select('#saved-word-sort', 'next-review');
  await page.waitForFunction(() => document.body.textContent.includes("Vocabulary file not found"));
  assert.equal(await page.$eval(".vocabulary-library-empty a", el => el.hash), "#settings");
  missing = false;
  unavailable = true;
  await page.goto(`${base}/#grammar`); await page.waitForSelector('textarea');
  await page.goto(`${base}/#word-library`); await page.waitForSelector('.saved-word');
  assert.equal(await page.$eval('#saved-word-status', el => el.disabled), true);
  assert.deepEqual(await page.$$eval('.vocabulary-overview-metric strong', els => els.map(el => el.textContent)), ['31', '—']);
  assert.equal(await page.$('.vocabulary-distribution-grid'), null);
  unavailable = false;
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
  console.log("Saved Words browser checks passed: status-guide modal/keyboard/focus/close/backdrop, equal aligned dropdowns, details status text/color without schedule/statistics/history, six status counts/filters, next-review sort, paging, modal focus/scrolling, empty/unavailable/error recovery, 320/390/768/1440px, Review/Lookup/Grammar siblings, no learning writes.");
} finally {
  if (browser) await browser.close();
  db.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  assert.equal(path.dirname(dir), parent); fs.rmSync(dir, { recursive: true, force: true });
}
