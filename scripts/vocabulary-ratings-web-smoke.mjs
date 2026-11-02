import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import puppeteer from "puppeteer";
import { preview } from "vite";
import { checkVocabularyReview, gradeVocabularyReview } from "../lib/application/vocabulary-review.mjs";
import { beijingDate } from "../lib/shared/timezone.mjs";
import { up as removeLegacyCoachStorage } from "../migrations/063_remove_legacy_coach_storage.mjs";

// Isolated in-memory SRS and evidence. No user DB, notes or configuration writes.
const db = new Database(":memory:");
for (const file of ["001_initial_schema.sql", "009_practice_attempts.sql", "010_practice_context.sql", "011_learning_plans.sql", "012_practice_task_link.sql", "015_learning_plan_pause.sql"]) {
  db.exec(fs.readFileSync(path.join(process.cwd(), "migrations", file), "utf8"));
}
removeLegacyCoachStorage(db);
db.prepare("INSERT INTO srs_cards (id,source_type,prompt,answer,word,zh,meaning,example,due_date) VALUES (1,'vocab','follow up','follow up','follow up','跟进','to act after an earlier event','She followed up yesterday.','2026-01-01')").run();
db.prepare("INSERT INTO srs_cards (id,source_type,prompt,answer,word,zh,meaning,due_date) VALUES (2,'vocab','boulder','boulder','boulder','巨石','a very large rock','2026-01-01')").run();
db.exec("ALTER TABLE srs_cards ADD COLUMN vocab_details TEXT");
db.prepare("UPDATE srs_cards SET pos='phrasal verb', vocab_details=? WHERE id=1").run(JSON.stringify({
  phonetic: "/ˈfɒləʊ ʌp/", synonyms: "check back, pursue, continue",
  collocations: "follow up on a request; follow up with a colleague",
  note: "Use follow up on for a request or task; use follow up with for a person.",
  examples: ["I will follow up tomorrow.", "Please follow up on the request.", "She followed up yesterday."],
}));
const server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [], grades = [];
  let loseResponse = true;
  let failDue = false;
  let dueRequests = 0;
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url());
    const json = (body, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
    try {
      if (url.pathname === "/vocab/seed") return json({ seeded: 0 });
      if (url.pathname === "/runtime" || url.pathname === "/status-message") return json({});
      if (url.pathname === "/review/due") {
        dueRequests++;
        if (failDue) { failDue = false; return json({ error: "Queue unavailable" }, 500); }
        return json({ cards: db.prepare("SELECT * FROM srs_cards WHERE due_date <= ? ORDER BY id").all(beijingDate()).map(card => ({ ...card, vocab_details: card.vocab_details ? JSON.parse(card.vocab_details) : null })) });
      }
      if (url.pathname === "/review/check") {
        const body = JSON.parse(request.postData());
        return json(checkVocabularyReview(db, { cardId: body.card_id, answer: body.answer }));
      }
      if (url.pathname === "/review/grade") {
        const body = JSON.parse(request.postData());
        grades.push(body);
        const result = gradeVocabularyReview(db, { cardId: body.card_id, answer: body.answer, requestId: body.request_id, audioPlayed: body.audio_played, rating: body.rating });
        if (loseResponse) { loseResponse = false; return json({ error: "Response lost after save" }, 500); }
        return json(result);
      }
      if (url.pathname === "/review/delete") {
        const body = JSON.parse(request.postData());
        db.prepare("DELETE FROM srs_cards WHERE id = ?").run(body.card_id);
        return json({ deleted: true });
      }
      return request.continue();
    } catch (error) { return json({ error: error.message }, error.status || 500); }
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const output = path.join(process.cwd(), "artifacts", "vocabulary-ratings");
  fs.mkdirSync(output, { recursive: true });
  async function capture(name) {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} overflows at ${width}`);
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
    }
  }
  const ratingButton = rating => `//button[contains(@class,'review-rating-button')][strong[text()='${rating}']]`;
  async function choose(label) { await page.locator(`xpath/${ratingButton(label)}`).click(); }
  const totalReviews = () => db.prepare("SELECT coalesce(sum(total_reviews),0) AS n FROM srs_cards").get().n;
  const evidenceCount = () => db.prepare("SELECT count(*) AS n FROM practice_attempts").get().n;
  await page.goto(`${base}/#word-review`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#review-answer");
  assert.equal(await page.$eval("#review-answer", el => document.activeElement === el), true);
  await capture("recall-reference");
  await page.type("#review-answer", "FOLLOW-UP");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".review-rating-button");
  assert.equal(totalReviews(), 0);
  assert.equal(evidenceCount(), 0);
  assert.equal(await page.$eval(".review-actions .primary", el => el.disabled), true);
  assert.equal(await page.$$eval(".review-rating-button", els => els.length), 4);
  assert.deepEqual(await page.$$eval(".review-rating-button", els => els.map(el => el.getAttribute("aria-pressed"))), ["false", "false", "false", "false"]);
  await capture("choose-rating");
  assert.equal(await page.$$eval('.review-result-example', els => els.length), 3);
  await page.setViewport({ width: 1440, height: 1000 });
  assert.equal(await page.evaluate(() => {
    const examples = document.querySelector('.review-explore-examples').getBoundingClientRect();
    const details = document.querySelector('.review-explore dl').getBoundingClientRect();
    const ratings = document.querySelector('.review-rating-options').getBoundingClientRect();
    const next = document.querySelector('.review-actions').getBoundingClientRect();
    return examples.right <= details.left && Math.abs(examples.top - details.top) < 2 && Math.abs(ratings.bottom - next.bottom) < 2;
  }), true, 'desktop example/detail columns and aligned review actions');
  await page.setViewport({ width: 320, height: 1000 });

  await page.hover('[data-rating="hard"]');
  assert.equal(await page.$eval('#review-rating-hint-hard', el => el.checkVisibility()), true);
  assert.equal(await page.$eval('#review-rating-hint-hard', el => el.getBoundingClientRect().right <= innerWidth), true);
  await page.focus('[data-rating="hard"]');
  await page.keyboard.press("Escape");
  assert.equal(await page.$eval('#review-rating-hint-hard', el => el.checkVisibility()), false);

  await page.focus(".review-ratings");
  await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.textContent.includes("Retry Again"));
  assert.equal(totalReviews(), 1, "lost response still committed exactly once");
  assert.equal(await page.$$eval(".review-rating-button", els => els.filter(el => !el.disabled).length), 1);
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".review-ratings");
  await choose("Retry Again");
  await page.waitForSelector(".review-rating-saved");
  assert.deepEqual(grades[0], grades[1], "reload retries the same answer, rating and request ID");
  assert.equal(totalReviews(), 1);
  assert.equal(evidenceCount(), 1);
  assert.equal(await page.$eval(".review-actions .primary", el => el.disabled), false);
  await capture("again-saved");
  await page.focus(".review-actions .primary"); await page.keyboard.press("Enter");
  await page.waitForSelector("#review-answer");
  assert.match(await page.$eval(".review-prompt h2", el => el.textContent), /巨石/);
  await page.click(".review-check");
  await page.waitForSelector(".review-rating-button");
  assert.match(await page.$eval(".review-verdict", el => el.textContent), /Answer revealed/);
  await choose("Hard");
  await page.waitForSelector(".review-rating-saved");
  assert.equal(db.prepare("SELECT interval_days FROM srs_cards WHERE id=2").get().interval_days, 1);
  assert.equal(db.prepare("SELECT score FROM practice_attempts ORDER BY id DESC").get().score, 0);
  await page.click(".review-actions .primary");
  await page.waitForSelector("#review-answer");
  assert.match(await page.$eval(".review-prompt h2", el => el.textContent), /跟进/, "Again returns after the other queued card");
  await page.type("#review-answer", "follow up");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".review-rating-button");
  await choose("Good");
  await page.waitForSelector(".review-rating-saved");
  assert.equal(db.prepare("SELECT interval_days FROM srs_cards WHERE id=1").get().interval_days, 3);
  await page.click(".review-actions .primary");
  await page.waitForSelector(".review-completion");
  assert.equal(totalReviews(), 3);
  assert.equal(evidenceCount(), 3);
  // An unrated feedback survives navigation/reload; Easy still records a wrong spelling as wrong.
  db.prepare("UPDATE srs_cards SET due_date='2000-01-01' WHERE id=1").run();
  await page.click(".review-new-session");
  await page.waitForSelector("#review-answer");
  await page.type("#review-answer", "incorrect spelling"); await page.keyboard.press("Enter");
  await page.waitForSelector(".review-rating-button");
  const requestCount = dueRequests;
  await page.goto(`${base}/#grammar`);
  await page.waitForSelector("textarea");
  await page.goto(`${base}/#word-review`);
  await page.waitForSelector(".review-rating-button");
  assert.equal(dueRequests, requestCount, "navigation keeps the daily queue");
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".review-rating-button");
  assert.equal(dueRequests, requestCount, "reload keeps the unrated feedback and daily queue");
  assert.equal(evidenceCount(), 3);
  failDue = true;
  await page.click(".review-new-session");
  await page.waitForFunction(() => document.body.textContent.includes("Could not start a new session"));
  assert.equal(await page.$eval(".review-your-answer", el => el.textContent.includes("incorrect spelling")), true);
  await choose("Easy");
  await page.waitForSelector(".review-rating-saved");
  assert.equal(db.prepare("SELECT score FROM practice_attempts ORDER BY id DESC").get().score, 0);
  assert.equal(JSON.parse(db.prepare("SELECT feedback FROM practice_attempts ORDER BY id DESC").get().feedback).rating, "easy");
  await capture("easy-saved");
  assert.deepEqual(errors, []);
  console.log("Vocabulary rating browser checks passed: real in-memory scheduler/evidence, four ratings, lost-response retry/reload, Again queue, blank recall, separate spelling score, autofocus/Enter, 320/390/768/1440px.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  db.close();
}
