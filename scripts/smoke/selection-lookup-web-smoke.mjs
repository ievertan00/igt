import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { preview } from "vite";

const server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [], queries = [], saves = [];
  let fail = false;
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    const json = (body, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/word/lookup") {
      const query = url.searchParams.get("q");
      queries.push(query);
      return fail ? json({ error: { message: "Lookup unavailable. Please retry." } }, 502) : json({ data: {
        word: "follow up", meaning: "Take further action.", zh: "跟进", example: "I will follow up tomorrow.",
        translated: /\p{Script=Han}/u.test(query), requested: query, lookup: "follow up",
      } });
    }
    if (url.pathname === "/word/add") { saves.push(JSON.parse(request.postData())); return json({ persistence: { saved: true } }); }
    if (url.pathname === "/runtime" || url.pathname === "/status-message") return json({});
    if (url.pathname === "/" || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/images/")) return request.continue();
    return json({ error: "Fixture: page data unavailable" }, 503);
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const select = async (selector, text) => {
    await page.$eval(selector, (element, value) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = value;
        element.focus();
        element.setSelectionRange(0, value.length);
      } else {
        const node = element.firstChild;
        const start = node.textContent.indexOf(value);
        const range = document.createRange();
        range.setStart(node, start); range.setEnd(node, start + value.length);
        getSelection().removeAllRanges(); getSelection().addRange(range);
      }
      document.dispatchEvent(new Event("selectionchange"));
    }, text);
    await page.waitForSelector(".selection-lookup-trigger");
  };
  for (const route of ["grammar", "translation", "word-lookup", "word-review", "practice", "ask", "handbook", "coach", "dashboard", "settings"]) {
    await page.goto(`${base}/#${route}`);
    await select(".site-footer-motto", "practice");
    await page.click(".selection-lookup-trigger");
    await page.waitForSelector("dialog[open] .lookup-result");
    assert.equal(new URL(page.url()).hash, `#${route}`);
    assert.equal(await page.$eval("#selection-lookup-input", input => input.value), "practice");
    assert.equal(saves.length, 0, "lookup alone never saves");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog").open);
  }
  await page.goto(`${base}/#grammar`);
  await page.waitForSelector("textarea");
  await select("textarea", "跟进");
  await page.$eval(".selection-lookup-trigger", button => button.focus());
  await page.keyboard.press("Enter");
  await page.waitForSelector("dialog[open] .lookup-result");
  assert.match(await page.$eval("dialog", el => el.textContent), /English expression for “跟进”/);
  const output = path.join(process.cwd(), "artifacts", "selection-lookup");
  fs.mkdirSync(output, { recursive: true });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewport({ width, height: 900 });
    assert.equal(await page.$eval("dialog", el => el.scrollWidth <= el.clientWidth), true);
    await page.screenshot({ path: path.join(output, `selection-${width}.png`) });
  }
  await page.click("dialog .lookup-result > button.primary");
  await page.waitForFunction(() => document.querySelector("dialog").textContent.includes("Saved to your vocabulary"));
  assert.equal(saves.length, 1);
  await page.keyboard.press("Escape");
  assert.equal(await page.$eval("textarea", input => input.value), "跟进", "selected input stays intact");
  fail = true;
  await select(".site-footer-motto", "practice");
  await page.click(".selection-lookup-trigger");
  await page.waitForFunction(() => document.querySelector("dialog").textContent.includes("Please retry"));
  assert.equal(await page.$("dialog .lookup-result"), null);
  fail = false;
  await page.click("dialog .lookup-form button.primary");
  await page.waitForSelector("dialog .lookup-result");
  // A route change must dismiss the dialog and discard its result.
  await page.evaluate(() => { location.hash = "word-lookup"; });
  await page.waitForFunction(() => !document.querySelector("dialog").open);
  await select("#word-lookup-input", "follow up");
  await page.click(".selection-lookup-trigger");
  await page.waitForSelector("dialog .lookup-result");
  assert.equal(queries.at(-1), "follow up");
  await page.keyboard.press("Escape");
  await page.evaluate(() => { getSelection().removeAllRanges(); document.activeElement.blur(); document.dispatchEvent(new Event("selectionchange")); });
  await page.waitForFunction(() => !document.querySelector(".selection-lookup-trigger"));
  assert.deepEqual(errors, []);
  console.log("Selection lookup passed: all ten routes, Chinese/English, input preservation, keyboard, dismissal, error/retry, explicit save, responsive layouts. Lookup/save responses mocked; no learner files modified.");
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
