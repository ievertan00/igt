import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { preview } from "vite";

const server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let saves = 0;
  let askRequests = [];
  let noteRequests = [];
  let failQuestion = true;
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const route = new URL(request.url()).pathname;
    if (route === "/grammar") {
      await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ result: {
        originalText: "I suggested him to join the call.",
        evaluate: "Your meaning is clear. The verb pattern needs a small correction.",
        correction: "I suggested that he join the call.",
        refine: "I suggested he join the call.",
        diagnoses: [
          { error_type: "Grammar / Sentence Structure", severity: "Moderate", explanation: "Replace 'suggested him to join' with 'suggested that he join': suggest takes a that-clause here." },
          { error_type: "Vocabulary / Word Choice", severity: "Minor", explanation: "Optionally omit 'that' from 'suggested that he join' for a more conversational sentence." },
        ],
        remember: "Use suggest with a that-clause.",
      }, persistence: { saved: false, requiresConfirmation: true } }) });
    } else if (route === "/grammar/save") {
      saves++;
      assert.equal(JSON.parse(request.postData()).data.evaluate, "Your meaning is clear. The verb pattern needs a small correction.");
      await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ persistence: { saved: true } }) });
    } else if (route === "/ask") {
      const body = JSON.parse(request.postData());
      askRequests.push(body);
      assert.match(body.messages[0].answer, /Original sentence: I suggested him to join the call\./);
      assert.match(body.messages[0].answer, /Correction: I suggested that he join the call\./);
      assert.match(body.messages[0].answer, /suggest takes a that-clause here/);
      if (failQuestion) {
        failQuestion = false;
        await request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Provider temporarily unavailable" }) });
      } else await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { title: "Suggest patterns", answer: `Use **suggest + that-clause**. Answer ${askRequests.length}.`, tags: ["verb-pattern"], category: "Grammar" } }) });
    } else if (route === "/ask/save") {
      const body = JSON.parse(request.postData());
      noteRequests.push(body);
      assert.equal(body.messages.length, 1);
      assert.match(body.messages[0].answer, /Original sentence: I suggested him to join the call\./);
      await request.respond({ status: noteRequests.length === 1 ? 503 : 200, contentType: "application/json", body: JSON.stringify(noteRequests.length === 1 ? { error: "Save temporarily unavailable" } : { saved: true }) });
    } else if (route === "/runtime") {
      await request.respond({ status: 200, contentType: "application/json", body: "{}" });
    } else await request.continue();
  });
  const address = server.httpServer.address();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(`http://127.0.0.1:${address.port}/#grammar`, { waitUntil: "networkidle0" });
  await page.type("#grammar-input", "I suggested him to join the call.");
  await page.click(".grammar-composer button[type=submit]");
  await page.waitForSelector(".grammar-why-list li");
  assert.deepEqual(await page.$$eval(".detail-section h2", (nodes) => nodes.map((node) => node.textContent)), ["Evaluate", "Correction", "More natural", "Why", "Remember"]);
  assert.deepEqual(await page.$$eval(".grammar-why-list strong", (nodes) => nodes.map((node) => node.textContent)), ["Sentence Structure (Moderate)", "Word Choice (Minor)"]);
  assert.equal(saves, 0);
  assert.equal(await page.$(".detail-original"), null);
  // Exercise the real result page rather than making its container artificially tall.
  for (const width of [1280, 390]) {
    await page.setViewport({ width, height: 844 });
    await page.click(".grammar-intro h1");
    await page.keyboard.press("PageDown");
    await page.waitForFunction(() => window.scrollY > 100);
    assert.equal(await page.$eval(".topbar", node => Math.round(node.getBoundingClientRect().top)), 0, `Navigation remains visible after scrolling real feedback at ${width}px`);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.setViewport({ width: 1280, height: 1000 });
  if (process.argv.includes("--screenshots")) {
    const referenceDir = path.join(process.cwd(), "artifacts", "grammar-verification");
    fs.mkdirSync(referenceDir, { recursive: true });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewport({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `No horizontal overflow at ${width}px`);
      await page.screenshot({ path: path.join(referenceDir, `writing-${width}.png`), fullPage: true });
    }
    await page.setViewport({ width: 1280, height: 1000 });
  }
  await page.focus("#grammar-input");
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.type("#grammar-input", "An edited draft.");
  await page.select(".grammar-follow-up-controls select", "en");
  await page.type("#grammar-follow-up-input", "Why not use to join?");
  await page.click(".grammar-follow-up-composer button[type=submit]");
  await page.waitForSelector(".grammar-follow-up-error");
  assert.equal(await page.$eval("#grammar-follow-up-input", node => node.value), "Why not use to join?");
  assert.equal(await page.$(".grammar-follow-up-turn"), null);
  await page.click(".grammar-follow-up-composer button[type=submit]");
  await page.waitForSelector(".grammar-follow-up-turn");
  assert.equal(noteRequests.length, 0, "Answers must not auto-save");
  assert.equal(askRequests[1].language, "en");
  await page.type("#grammar-follow-up-input", "Can I omit that?");
  await page.focus("#grammar-follow-up-input");
  await page.keyboard.down("Control");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Control");
  await page.waitForFunction(() => document.querySelectorAll(".grammar-follow-up-turn").length === 2);
  assert.equal(askRequests[2].messages[1].question, "Why not use to join?");
  assert.match(askRequests[2].messages[1].answer, /Answer 2/);
  await page.click(".grammar-follow-up-turn:last-of-type button");
  await page.waitForSelector(".grammar-follow-up-save .grammar-follow-up-error");
  await page.click(".grammar-follow-up-turn:last-of-type button");
  await page.waitForFunction(() => document.querySelector(".grammar-follow-up-turn:last-of-type button")?.disabled);
  await page.waitForFunction(() => document.querySelector(".grammar-follow-up-turn:last-of-type [role=status]")?.textContent.includes("Saved"));
  assert.deepEqual(noteRequests[0], noteRequests[1], "Save retries must preserve content identity");
  assert.match(noteRequests[1].messages[0].answer, /Previous discussion[\s\S]*Why not use to join\?/);
  assert.match(noteRequests[1].messages[0].answer, /Follow-up question\n\nCan I omit that\?/);
  assert.match(noteRequests[1].messages[0].answer, /Answer 3/);
  const capture = process.argv.includes("--screenshots");
  const outputDir = path.join(process.cwd(), "artifacts", "grammar-verification");
  if (capture) {
    fs.mkdirSync(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, "desktop.png"), fullPage: true });
  }
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  if (capture) await page.screenshot({ path: path.join(outputDir, "mobile.png"), fullPage: true });
  await page.click(".save-review");
  await page.waitForFunction(() => document.querySelector(".save-review")?.textContent.includes("Saved to review log"));
  assert.equal(saves, 1);
  assert.deepEqual(errors, []);
  console.log("Grammar browser smoke passed: grammar context, multi-turn follow-ups, failure recovery, explicit Ask note save/retry, desktop/mobile, review log.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
