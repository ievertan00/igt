import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { createServer } from "vite";

const server = await createServer({ configFile: "apps/web/vite.config.ts", server: { port: 0 } });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  let refine = null;
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/grammar" && request.method() === "POST") {
      await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ result: { correction: "", refine, evaluate: "The sentence is clear.", diagnoses: [], remember: "Keep writing." } }) });
    } else if (pathname === "/runtime") {
      await request.respond({ status: 200, contentType: "application/json", body: "{}" });
    } else await request.continue();
  });
  await page.goto(`${server.resolvedUrls.local[0]}#grammar`, { waitUntil: "networkidle0" });
  await page.type("#grammar-input", "This sentence is clear.");
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 900 });
    for (const alternative of [null, "", "This is a clear sentence."]) {
      refine = alternative;
      await page.click(".grammar-composer button.primary");
      await page.waitForSelector(".correction-detail");
      assert.ok(await page.$(".detail-natural"), "More natural field must remain visible without an alternative");
      assert.match(await page.$eval(".detail-natural", el => el.textContent), alternative ? /This is a clear sentence/ : /No alternative wording provided/);
      assert.equal((await page.$$(".detail-natural button")).length, alternative ? 1 : 0);
    }
  }
  console.log("Grammar More natural: empty and populated responses passed at desktop and mobile widths.");
} finally {
  await browser?.close();
  await server.close();
}
