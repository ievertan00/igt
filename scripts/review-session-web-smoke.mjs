import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { preview } from "vite";
import fs from "node:fs";
import path from "node:path";

const server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  // Deliberately use a different browser timezone; the session must follow Beijing midnight.
  await page.emulateTimezone("America/Los_Angeles");
  await page.evaluateOnNewDocument(() => {
    const NativeDate = Date;
    globalThis.__reviewTestNow = NativeDate.parse("2026-10-02T15:59:00Z");
    globalThis.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [globalThis.__reviewTestNow])); }
      static now() { return globalThis.__reviewTestNow; }
    };
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cards = [
    { id: 101, word: "first", zh: "第一个", meaning: "first in order" },
    { id: 102, word: "second", zh: "第二个", meaning: "second in order" },
    { id: 103, word: "third", zh: "第三个", meaning: "third in order" },
  ];
  let dueRequests = 0;
  let failNextGrade = false;
  let failNextDue = false;
  let gradeRequests = 0;
  const grades = [];
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const route = new URL(request.url()).pathname;
    if (route === "/review/due") {
      dueRequests++;
      if (failNextDue) {
        failNextDue = false;
        await request.respond({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Could not load cards." }) });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      // A fresh server query changes the queue after grading; a daily session should retain it.
      const due = cards.filter((card) => !grades.includes(card.id));
      await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ cards: due }) });
    } else if (route === "/review/grade") {
      gradeRequests++;
      if (failNextGrade) {
        failNextGrade = false;
        await request.respond({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Rating was not saved." }) });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      grades.push(JSON.parse(request.postData()).card_id);
      await request.respond({ status: 200, contentType: "application/json", body: "{}" });
    } else if (route === "/runtime") {
      await request.respond({ status: 200, contentType: "application/json", body: "{}" });
    } else await request.continue();
  });
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/#word-review`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".review-prompt button.primary");
  await page.click(".review-prompt button.primary");
  await page.waitForSelector(".review-actions");
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(await page.$(".review-actions") !== null, true, "refresh must preserve the revealed card");
  await page.click(".review-actions button:nth-child(3)");
  await page.waitForFunction(() => document.querySelector(".review-card")?.textContent.includes("Card 2 of 3"));
  await page.reload({ waitUntil: "networkidle0" });
  assert.match(await page.$eval(".review-card", (node) => node.textContent), /Card 2 of 3/);
  assert.equal(await page.$eval(".review-prompt h2", (node) => node.textContent), "第二个");
  await page.click(".brand");
  await page.click("#workspace-nav details:nth-of-type(2) summary");
  await page.click("#workspace-nav a[href='#word-review']");
  await page.waitForSelector(".review-card");
  assert.match(await page.$eval(".review-card", (node) => node.textContent), /Card 2 of 3/);
  for (const next of ["Card 3 of 3", "All done for today."]) {
    await page.click(".review-prompt button.primary");
    await page.click(".review-actions button:nth-child(3)");
    await page.waitForFunction((text) => document.querySelector(".word-review-page")?.textContent.includes(text), {}, next);
  }
  await page.reload({ waitUntil: "networkidle0" });
  assert.match(await page.$eval(".review-empty-state", (node) => node.textContent), /You reviewed 3 vocabulary cards/);
  assert.deepEqual(grades, [101, 102, 103]);
  assert.equal(dueRequests, 1, "same-day refreshes must not fetch a replacement queue");
  grades.length = 0;
  await page.evaluate(() => {
    globalThis.__reviewTestNow = Date.parse("2026-10-02T16:01:00Z");
    window.dispatchEvent(new Event("focus"));
  });
  await page.waitForSelector(".review-prompt button.primary");
  assert.match(await page.$eval(".review-card", (node) => node.textContent), /Card 1 of 3/);
  assert.equal(dueRequests, 2, "a new Beijing day must create a new session");
  failNextGrade = true;
  await page.click(".review-prompt button.primary");
  await page.click(".review-actions button:nth-child(3)");
  await page.waitForFunction(() => document.querySelector(".word-review-page")?.textContent.includes("Could not save your rating"));
  assert.match(await page.$eval(".review-card", (node) => node.textContent), /Card 1 of 3/);
  assert.equal(await page.$(".review-actions") !== null, true, "failed ratings must keep the answer revealed");
  const beforeDoubleClick = gradeRequests;
  await page.click(".review-actions button:nth-child(3)", { clickCount: 2 });
  await page.waitForFunction(() => document.querySelector(".review-card")?.textContent.includes("Card 2 of 3"));
  assert.equal(gradeRequests, beforeDoubleClick + 1, "double-clicking must submit one rating");
  await page.evaluate(() => {
    localStorage.setItem("igt.review.daily-session.v1", "{broken JSON");
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".review-card");
  assert.match(await page.$eval(".review-card", (node) => node.textContent), /Card 1 of 2/);
  assert.deepEqual(errors, []);
  // An empty session is still today's session and must not be refetched on reload.
  grades.push(102, 103);
  await page.evaluate(() => localStorage.removeItem("igt.review.daily-session.v1"));
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".review-empty-state");
  const beforeEmptyReload = dueRequests;
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(dueRequests, beforeEmptyReload);
  assert.match(await page.$eval(".review-empty-state", (node) => node.textContent), /You are all caught up/);
  // Explicitly starting a new session is the only same-day action that replaces the queue.
  grades.length = 0;
  await page.click(".review-session-actions button");
  await page.waitForSelector(".review-prompt button.primary");
  assert.match(await page.$eval(".review-card", (node) => node.textContent), /Card 1 of 3/);
  await page.click(".review-prompt button.primary");
  await page.click(".review-actions button:nth-child(3)");
  await page.waitForFunction(() => document.querySelector(".review-card")?.textContent.includes("Card 2 of 3"));
  await page.click(".review-prompt button.primary");
  const beforeFailedRestart = await page.evaluate(() => localStorage.getItem("igt.review.daily-session.v1"));
  failNextDue = true;
  await page.click(".review-session-actions button");
  await page.waitForFunction(() => document.querySelector(".word-review-page")?.textContent.includes("Could not start a new session"));
  assert.match(await page.$eval(".review-card", (node) => node.textContent), /Card 2 of 3/);
  assert.equal(await page.$(".review-actions") !== null, true);
  assert.equal(await page.evaluate(() => localStorage.getItem("igt.review.daily-session.v1")), beforeFailedRestart);
  const beforeRestartRequests = dueRequests;
  await page.click(".review-session-actions button", { clickCount: 2 });
  await page.waitForFunction(() => document.querySelector(".review-card")?.textContent.includes("Card 1 of 2"));
  assert.equal(dueRequests, beforeRestartRequests + 1);
  assert.equal(await page.$(".review-actions"), null, "a new session starts with the first card hidden");
  assert.equal(await page.$eval(".review-prompt h2", (node) => node.textContent), "第二个");
  await page.reload({ waitUntil: "networkidle0" });
  assert.match(await page.$eval(".review-card", (node) => node.textContent), /Card 1 of 2/);
  assert.equal(dueRequests, beforeRestartRequests + 1);
  if (process.argv.includes("--screenshots")) {
    const outputDir = path.join(process.cwd(), "artifacts", "review-verification");
    fs.mkdirSync(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, "desktop.png"), fullPage: true });
    await page.setViewport({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(outputDir, "mobile.png"), fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log("Review browser smoke passed: daily persistence, rollover, ratings, empty session, new session, failed restart, double-click guard.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
