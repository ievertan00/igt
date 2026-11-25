import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { createServer } from "vite";
import fs from "node:fs";
import path from "node:path";

// Fixture APIs only: no provider calls or writes to the user's notes.
const server = await createServer({ configFile: "apps/web/vite.config.ts", server: { host: "127.0.0.1", port: 0 } });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  const metadata = { title: "Present perfect: since and for", category: "Grammar", tags: ["present-perfect", "since-for"], metadataSource: "ai" };
  const content = `---\ntitle: ${JSON.stringify(metadata.title)}\ntags: ${JSON.stringify(metadata.tags)}\ncategory: "Grammar"\nmetadataSource: "ai"\n---\n\nUse since for a starting point.`;
  const notes = [
    { id: "truncated-filename.md", modifiedAt: "2026-10-26T01:00:00Z", bytes: content.length, content, ...metadata },
    { id: "legacy.md", modifiedAt: "2026-10-25T01:00:00Z", bytes: 15, content: "An older note." },
  ];
  let saved;
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const url = new URL(request.url());
    const json = (body) => request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/ask/notes") return json({ directory: "Fixture notes", notes });
    if (url.pathname === "/ask") return json({ data: { ...metadata, answer: "Use since for a starting point.", related: [] } });
    if (url.pathname === "/ask/save") { saved = JSON.parse(request.postData()); return json({ saved: true, metadata, vaultFile: notes[0].id }); }
    if (["/runtime", "/status-message"].includes(url.pathname)) return json({});
    await request.continue();
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/#ask`, { waitUntil: "networkidle0" });
  await page.click("#ask-tab-notes");
  await page.waitForSelector(".ask-note-link");
  assert.equal(await page.$$eval(".ask-note-link", (els) => els.length), 2);
  await page.select("#ask-category", "Grammar");
  await page.select("#ask-tag", "since-for");
  assert.equal(await page.$$eval(".ask-note-link", (els) => els.length), 1);
  await page.click(".ask-note-link");
  assert.match(await page.$eval("#ask-note-reader", (el) => el.textContent), /Present perfect: since and for/);
  assert.doesNotMatch(await page.$eval("#ask-note-reader .md", (el) => el.textContent), /metadataSource|tags:/);
  const output = path.join(process.cwd(), "artifacts", "ask-metadata");
  fs.mkdirSync(output, { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `notes-${width}.png`), fullPage: true });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.click("#ask-tab-ask");
  await page.type(".ask-composer textarea", "When do I use since?");
  await page.click(".ask-composer button.primary");
  await page.waitForSelector(".ask-answer");
  await page.click(".ask-save-menu summary");
  await page.click(".ask-save-action button");
  await page.waitForFunction(() => document.body.textContent.includes("Saved as “Present perfect"));
  assert.deepEqual(saved.messages[0].tags, metadata.tags);
  assert.equal(saved.messages[0].category, "Grammar");
  assert.deepEqual(errors, []);
  console.log("Ask metadata browser smoke passed: filters, legacy notes, reader, save payload, 1440/390/320.");
} finally {
  await browser?.close();
  await server.close();
}
