import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { preview, createServer } from "vite";
import fs from "node:fs";
import path from "node:path";

// Every learning API is intercepted; no real notes or DB are changed.
const dev = process.argv.includes("--dev");
const server = dev
  ? await createServer({ configFile: "apps/web/vite.config.ts", server: { host: "127.0.0.1", port: 0 } })
  : await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
if (dev) await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  const cards = [
    { id: 101, source_type: "vocab", word: "follow up", zh: "跟进", meaning: "to act after an earlier event", example: "I will follow up tomorrow.", masked_example: "I will ___ tomorrow.",
      vocab_details: { synonyms: "check back, pursue", collocations: "follow up on a request", examples: ["I will follow up tomorrow.", "Please follow up on the request."] } },
    { id: 102, source_type: "vocab", word: "second", zh: "第二个", meaning: "after the first" },
  ];
  const grades = [], deletions = [], saves = [];
  let dueRequests = 0, failGrade = true, failSave = true, failDue = false;
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url());
    const json = (body, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/review/due") {
      dueRequests++;
      if (failDue) { failDue = false; return json({ error: "Cards unavailable" }, 500); }
      return json({ cards: cards.filter(card => !grades.some(grade => grade.card_id === card.id)) });
    }
    if (url.pathname === "/review/grade") {
      const body = JSON.parse(request.postData());
      grades.push(body);
      await new Promise(resolve => setTimeout(resolve, 80));
      if (failGrade) { failGrade = false; return json({ error: "Evidence unavailable" }, 500); }
      const correct = body.answer.toLowerCase().replace(/[\s-]/g, "") === cards.find(card => card.id === body.card_id).word.replace(/\s/g, "");
      return json({ correct, next: { intervalDays: correct ? 6 : 1 }, persistence: { saved: true } });
    }
    if (url.pathname === "/review/delete") { deletions.push(JSON.parse(request.postData()).card_id); return json({ deleted: true }); }
    if (url.pathname === "/vocab/seed") return json({ seeded: 0 });
    if (url.pathname === "/runtime" || url.pathname === "/status-message") return json({});
    if (url.pathname === "/ask/notes") return json({ directory: "Test notes", notes: [] });
    if (url.pathname === "/ask") return json({ data: { title: "A useful explanation", answer: "Use a specific example.", related: [] } });
    if (url.pathname === "/ask/save") {
      saves.push(JSON.parse(request.postData()));
      if (failSave) { failSave = false; return request.abort("failed"); }
      return json({ saved: true, turnCount: saves.at(-1).messages.length, vaultFile: "A useful explanation.md" });
    }
    await request.continue();
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  await page.goto(`${base}/#word-review`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#review-answer"); assert.equal(await page.$$eval(".word-review-page button", buttons => buttons.filter(button => button.textContent.includes("Start a new session")).length), 1);
  assert.equal(await page.$eval("#review-answer", el => el.value), "");
  assert.equal(await page.$(".review-verdict"), null);
  await page.type("#review-answer", "FOLLOW-UP");
  await page.click(".review-recall-form button[type=submit]", { clickCount: 2 });
  await page.waitForFunction(() => document.body.textContent.includes("Evidence unavailable"));
  assert.equal(grades.length, 1);
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(await page.$eval("#review-answer", el => el.value), "FOLLOW-UP");
  await page.click(".review-recall-form button[type=submit]");
  await page.waitForSelector(".review-verdict");
  assert.equal(grades[1].request_id, grades[0].request_id);
  assert.match(await page.$eval(".review-verdict", el => el.textContent), /Correct/);
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".review-verdict");
  assert.equal(dueRequests, dev ? 2 : 1, "StrictMode may start two requests but reload must reuse the session");
  const output = path.join(process.cwd(), "artifacts", "vocabulary-review-ui");
  fs.mkdirSync(output, { recursive: true });
  async function capture(name) {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} overflows at ${width}`);
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
    }
  }
  await capture("review-result");
  
  
  assert.match(await page.$eval(".review-explore", el => el.textContent), /follow up on a request/);
  
  await page.click(".review-actions button.primary");
  await page.waitForSelector("#review-answer"); assert.equal(await page.$$eval(".word-review-page button", buttons => buttons.filter(button => button.textContent.includes("Start a new session")).length), 1);
  await page.click(".review-recall-form button[type=submit]");
  await page.waitForSelector(".review-verdict");
  assert.equal(grades.at(-1).answer, "");
  assert.match(await page.$eval(".review-verdict", el => el.textContent), /Not quite/);
  await capture("review-incorrect");
  
  await page.click(".review-remove-card");
  await page.waitForSelector(".review-empty-state");
  assert.deepEqual(deletions, [102]);
  assert.match(await page.$eval(".review-empty-state", el => el.textContent), /Correct1Incorrect1/);
  await capture("review-complete");
  failDue = true;
  await page.click(".review-session-tools > button");
  await page.waitForFunction(() => document.body.textContent.includes("Could not start a new session"));
  assert.equal(await page.$(".review-empty-state") !== null, true);
  await page.evaluate(() => localStorage.removeItem("igt.review.daily-session.v2"));
  grades.length = 0;
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("#review-answer"); assert.equal(await page.$$eval(".word-review-page button", buttons => buttons.filter(button => button.textContent.includes("Start a new session")).length), 1);
  await capture("review-prompt"); await page.click(".review-hint-button"); assert.match(await page.$eval(".review-letter-hint", el => el.textContent), /Starts with/);
  await page.setViewport({ width: 320, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "review prompt overflows at 320px");
  assert.equal(await page.$(".review-session-options"), null); assert.equal(await page.$eval("#review-limit", el => el.checkVisibility()), true);
  cards[0].word = "take something into consideration";
  cards[0].zh = "把某件事情考虑在内";
  cards[0].meaning = "to consider a particular fact or circumstance when making a decision";
  await page.evaluate(() => localStorage.removeItem("igt.review.daily-session.v2"));
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("#review-answer"); assert.equal(await page.$$eval(".word-review-page button", buttons => buttons.filter(button => button.textContent.includes("Start a new session")).length), 1);
  await page.type("#review-answer", cards[0].word);
  await page.click(".review-recall-form button[type=submit]");
  await page.waitForSelector(".review-verdict");
  await capture("review-long-expression");
  await page.setViewport({ width: 320, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "long expression overflows at 320px");
  assert.equal(await page.$(".review-session-options"), null); assert.equal(await page.$eval("#review-limit", el => el.checkVisibility()), true);
  const originalLimit = await page.$eval("#review-limit", el => Number(el.value)); await page.click('[aria-label="More cards"]'); assert.equal(await page.$eval("#review-limit", el => Number(el.value)), originalLimit + 1); await page.click('[aria-label="Fewer cards"]'); assert.equal(await page.$eval("#review-limit", el => Number(el.value)), originalLimit); await page.focus("#review-limit");
  await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control");
  await page.type("#review-limit", "5");
  assert.equal(await page.$eval("#review-limit", el => el.value), "5");
  assert.equal(await page.$(".review-session-options"), null); assert.equal(await page.$eval("#review-limit", el => el.checkVisibility()), true);
  await page.goto(`${base}/#ask`);
  await page.waitForSelector("#ask-input");
  await page.type("#ask-input", "How do I use this expression?");
  await page.click(".ask-composer button.primary");
  await page.waitForSelector(".ask-answer");
  await page.click(".ask-save-menu summary");
  await page.click(".ask-save-action button");
  await page.waitForFunction(() => document.body.textContent.includes("Retry save"));
  if (!await page.$eval(".ask-save-menu", menu => menu.open)) await page.click(".ask-save-menu summary");
  await page.click(".ask-save-action button");
  await page.waitForFunction(() => document.body.textContent.includes("Saved to Markdown notes"));
  assert.deepEqual(saves[0], saves[1]);
  await page.type("#ask-input", "Can you give another example?");
  await page.click(".ask-composer button.primary");
  await page.waitForFunction(() => document.querySelectorAll(".ask-turn").length === 2);
  await page.evaluate(() => document.querySelectorAll(".ask-save-menu summary")[1].click());
  await page.evaluate(() => [...document.querySelectorAll(".ask-turn")][1].querySelectorAll(".ask-save-action button")[1].click());
  await page.waitForFunction(() => [...document.querySelectorAll(".ask-turn")][1].textContent.includes("Saved to Markdown notes"));
  assert.equal(saves.at(-1).messages.length, 2);
  assert.equal(saves.at(-1).messages[0].title, "A useful explanation");
  await capture("ask");
  await page.goto(`${base}/#grammar`);
  await page.waitForSelector("textarea");
  assert.deepEqual(errors, []);
  console.log("Review/Ask browser smoke passed: typed/blank recall, retry identity, reload, deletion, summary, save retry, desktop/mobile and Grammar sibling.");
} finally {
  if (browser) await browser.close();
  if (dev) await server.close();
  else await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}





