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
  assert.deepEqual(await page.$$eval(".correction-detail h2", (nodes) => nodes.map((node) => node.textContent)), ["Evaluate", "Correction", "More natural", "Why", "Remember"]);
  assert.deepEqual(await page.$$eval(".grammar-why-list strong", (nodes) => nodes.map((node) => node.textContent)), ["Sentence Structure (Moderate)", "Word Choice (Minor)"]);
  assert.equal(saves, 0);
  assert.equal(await page.$(".detail-original"), null);
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
  console.log("Grammar browser smoke passed: Evaluate, typed Why, desktop/mobile, explicit save.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
