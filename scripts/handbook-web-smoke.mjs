import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { preview } from "vite";
import { buildGrammarHistory } from "../lib/application/grammar-history.mjs";
import { registerHandbookRoutes } from "../lib/server/routes/handbook.mjs";
import { dispatch } from "../lib/server/router.mjs";

const entries = Array.from({ length: 13 }, (_, index) => ({
  source: "grammar", entryId: `fixture-${index}`, timestamp: new Date(Date.now() - index * 86400000).toISOString(),
  userInput: index === 0 ? "I read a book." : `I read book ${index}.`, correction: index === 0 ? "I read a book." : `I read a book ${index}.`,
  diagnoses: index === 0 ? [] : [{ error_type: index === 12 ? "Tense" : "Articles", severity: "Minor", explanation: "Use a determiner before a singular countable noun. 根据语境选择冠词。" }],
  remember: "Remember the context.",
  refine: index === 1 ? "I have been reading a book." : undefined,
}));
entries.push({ source: "unknown", entryId: "legacy", timestamp: new Date().toISOString(), userInput: "Legacy text", diagnoses: [] });
entries.push({ source: "text", entryId: "text-analysis", timestamp: new Date().toISOString(), userInput: "A text analysis", diagnoses: [] });
entries.push({ source: "grammar", entryId: "older-check", timestamp: "2020-01-01T12:00:00Z", userInput: "An older saved sentence.", correction: "An older saved sentence.", diagnoses: [] });
let failure = false;
registerHandbookRoutes({ loadHistory: options => {
  if (failure) throw Object.assign(new Error("Fixture unavailable"), { status: 503 });
  return buildGrammarHistory(entries, { ...options, includeLegacy: true });
} });
const api = http.createServer(dispatch);
await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
let server, browser;
try {
  const baseApi = `http://127.0.0.1:${api.address().port}`;
  const defaultHistory = await fetch(`${baseApi}/handbook`).then(response => response.json());
  assert.equal(defaultHistory.days, 0);
  assert.equal(defaultHistory.pagination.total, 15);
  const history = await fetch(`${baseApi}/handbook?days=0&diagnosis=none`).then(response => response.json());
  assert.equal(history.entries.length, 3);
  assert.equal(history.coverage.unclassified, 1);
  assert.equal((await fetch(`${baseApi}/handbook?diagnosis=none&errorType=Articles`)).status, 400);
  assert.equal((await fetch(`${baseApi}/handbook?limit=0`)).status, 400);
  server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0, open: false } });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", async request => {
    try {
      const url = new URL(request.url());
      if (url.origin === base && url.pathname === "/handbook") {
        const response = await fetch(`${baseApi}${url.pathname}${url.search}`);
        await request.respond({ status: response.status, contentType: "application/json", body: await response.text() });
      } else if (url.origin === base && url.pathname === "/runtime") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ provider: "mock", assets: {} }) });
      } else if (url.origin === base && url.pathname === "/coach") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ days: 90, checks: 0, patterns: [], coverage: { grammar: 0, unclassified: 0, excludedOtherSources: 0, undated: 0 } }) });
      } else await request.continue();
    } catch { if (!request.isInterceptResolutionHandled()) await request.abort(); }
  });
  const ready = async () => {
    await page.waitForNetworkIdle({ idleTime: 150 });
    await page.waitForFunction(() => document.querySelector(".handbook-page [aria-busy]")?.getAttribute("aria-busy") === "false");
  };
  const select = async (label, value) => {
    const handle = await page.evaluateHandle(text => [...document.querySelectorAll(".handbook-filters label")].find(node => node.firstChild.textContent.trim() === text)?.querySelector("select"), label);
    await handle.asElement().select(value);
    await ready();
  };
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${base}/#handbook`);
  await ready();
  assert.equal(await page.$eval('.handbook-filters select', node => node.value), "0");
  assert.equal(await page.$$(".handbook-example").then(nodes => nodes.length), 10);
  assert.doesNotMatch(await page.$eval(".handbook-page", node => node.textContent), /matching saved checks|saved before source labels were added/);
  assert.equal(await page.$(".handbook-reports"), null);
  assert.equal(await page.$(".handbook-knowledge"), null);
  assert.match(await page.$eval(".handbook-natural", node => node.textContent), /I have been reading a book/);
  assert.equal(await page.$eval(".handbook-refine", node => node.open), true);
  assert.doesNotMatch(await page.$eval(".handbook-page", node => node.textContent), /Source details/);
  await page.click(".handbook-notes-toggle");
  assert.equal(await page.$eval(".handbook-notes-toggle", node => node.getAttribute("aria-pressed")), "false");
  assert.equal(await page.$$eval(".handbook-refine", nodes => nodes.every(node => node.hidden)), true);
  assert.equal(await page.$eval(".handbook-natural", node => node.getBoundingClientRect().height > 0), true);
  await page.click(".handbook-notes-toggle");
  assert.equal(await page.$$eval(".handbook-refine", nodes => nodes.every(node => !node.hidden)), true);
  await page.click(".handbook-example .handbook-refine summary");
  await page.click(".handbook-pagination button:last-child");
  await page.waitForFunction(() => location.hash.includes("offset=10"));
  await ready();
  assert.equal((await page.$$(".handbook-example")).length, 5);
  assert.match(await page.$eval(".handbook-page", node => node.textContent), /An older saved sentence/);
  await page.goBack(); await ready();
  await page.waitForFunction(() => document.querySelectorAll(".handbook-example").length === 10);
  await select("Mistake type", "Articles");
  await page.waitForFunction(() => document.querySelector(".handbook-pagination")?.textContent.includes("of 11 checks"));
  await select("Diagnoses", "none");
  await page.waitForFunction(() => document.querySelectorAll(".handbook-example").length === 3);
  assert.equal(await page.$eval('.handbook-filters label:last-of-type select', node => node.disabled), true);
  assert.equal(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).has("errorType"), false);
  assert.match(await page.$eval(".handbook-page", node => node.textContent), /does not establish error-free writing/);
  await page.focus('input[type="search"]'); await page.type('input[type="search"]', "not found"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash.includes("not+found")); await ready();
  assert.equal((await page.$$(".handbook-example")).length, 0);
  await page.goBack(); await ready();
  await page.waitForFunction(() => document.querySelectorAll(".handbook-example").length === 3);
  failure = true;
  await page.click(".coach-header button");
  await page.waitForSelector('[role="alert"]');
  assert.equal((await page.$$(".handbook-example")).length, 3);
  failure = false;
  await page.click('[role="alert"] button'); await ready();
  assert.equal(await page.$('[role="alert"]'), null);
  const output = process.env.IGT_HANDBOOK_QA_DIR || path.join(process.cwd(), "artifacts", "handbook-history-qa");
  fs.mkdirSync(output, { recursive: true });
  await page.goto(`${base}/#handbook?days=0`); await ready();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    await page.screenshot({ path: path.join(output, `handbook-${width}.png`), fullPage: true });
  }
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at 200% text: ${await page.evaluate(() => [...document.querySelectorAll('.handbook-page *')].filter(node => node.getBoundingClientRect().right > innerWidth).map(node => node.className || node.tagName).join(', '))}`);
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.goto(`${base}/#grammar`);
  await page.waitForSelector("textarea");
  await page.goto(`${base}/#coach`);
  await page.waitForFunction(() => document.querySelector("h1")?.textContent.includes("Understand your recurring mistakes"));
  assert.deepEqual(errors, []);
  console.log("Handbook history: HTTP validation, chronological checks, filters, pagination, browser back, retry, 320/390/768/1440px, 200% text and reduced motion passed.");
} finally {
  await browser?.close();
  await server?.close();
  await new Promise(resolve => api.close(resolve));
}
