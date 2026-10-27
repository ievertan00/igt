import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { preview } from "vite";
import { registerWordRoutes } from "../lib/server/routes/word.mjs";
import { dispatch } from "../lib/server/router.mjs";

const parent = path.join(process.cwd(), ".cache");
fs.mkdirSync(parent, { recursive: true });
const fixture = fs.mkdtempSync(path.join(parent, "word-web-"));
const file = path.join(fixture, "Vocabulary.md");
const calls = [], lookups = [], saves = [];
const entry = { status: "found", suggestions: "", word: "follow up", pos: "phrasal verb", phonetic: "/ˈfɒləʊ ʌp/", meaning: "To take further action after an earlier event.", zh: "跟进", synonyms: "check back", collocations: "follow up on a request", example: "I will follow up tomorrow.", example2: "Please follow up on the request.", example3: "We followed up after the meeting.", note: "Use on before the subject of your follow-up." };
registerWordRoutes({ getConfig: () => ({ VocabularyPath: file }), getLLMManager: async () => ({ generateWithFallback: async (input, _prompt, options) => {
  calls.push([input, options.taskType]);
  if (options.taskType === "translation") return input === "错误" ? "无法转换" : 'English counterpart: "follow up"';
  assert.equal(input, "follow up");
  return JSON.stringify(entry);
} }) });
const server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url());
    const json = (body, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/word/lookup") {
      lookups.push(url.searchParams.get("q"));
      let status, payload;
      await dispatch({ method: "GET", url: url.pathname + url.search }, {
        writeHead(value) { status = value; }, end(value) { payload = JSON.parse(value); },
      });
      return json(payload, status);
    }
    if (url.pathname === "/word/add") {
      saves.push(JSON.parse(request.postData()).entry);
      fs.writeFileSync(file, "# Test vocabulary\n\n### follow up\n**PoS:** phrasal verb · /saved/\n**Meaning:** Saved learner wording.\n**中文:** 跟进\n**Example 1:** My saved example.\n");
      return json({ persistence: { saved: true } });
    }
    if (url.pathname === "/runtime" || url.pathname === "/status-message") return json({});
    return request.continue();
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  await page.goto(`${base}/#word-lookup`);
  await page.waitForSelector("#word-lookup-input");
  const fill = async value => {
    await page.focus("#word-lookup-input");
    await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control");
    await page.type("#word-lookup-input", value);
  };
  await fill("跟进");
  await page.$eval("#word-lookup-input", input => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true })));
  assert.equal(lookups.length, 0, "Chinese IME confirmation must not submit the lookup");
  await page.click(".lookup-form button.primary");
  await page.waitForSelector(".lookup-result");
  assert.deepEqual(calls, [["跟进", "translation"], ["follow up", "grammar"]]);
  assert.match(await page.$eval(".lookup-result", el => el.textContent), /English expression for “跟进”: follow up/);
  assert.equal(saves.length, 0);
  assert.equal(fs.existsSync(file), false, "looking up must not save");
  const output = path.join(process.cwd(), "artifacts", "chinese-word-lookup");
  fs.mkdirSync(output, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `lookup-${width}.png`), fullPage: true });
  }
  await page.click(".lookup-result > button.primary");
  await page.waitForFunction(() => document.body.textContent.includes("Saved to your vocabulary"));
  assert.equal(saves.length, 1);
  assert.equal(await page.$eval(".lookup-result > button", button => button.disabled), true);
  await fill("跟进");
  await page.click(".lookup-form button.primary");
  await page.waitForFunction(() => document.querySelector(".lookup-result")?.textContent.includes("Saved learner wording."));
  assert.equal(calls.length, 3, "saved Chinese lookup translates once and reuses the Markdown entry");
  await fill("follow up");
  await page.click(".lookup-form button.primary");
  await page.waitForFunction(() => !document.querySelector(".lookup-form button").disabled);
  assert.equal(calls.length, 3, "saved English lookup makes no model call");
  await fill("错误");
  await page.click(".lookup-form button.primary");
  await page.waitForFunction(() => document.querySelector(".word-page")?.textContent.includes("reliable English counterpart"));
  assert.equal(await page.$(".lookup-result"), null, "errors clear the previous result");
  assert.equal(calls.length, 4);
  assert.deepEqual(errors, []);
  console.log("Chinese vocabulary browser smoke passed: IME, real lookup router with fake model, translated query, explicit save, saved entries, error recovery, desktop/mobile.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  assert.equal(path.dirname(fixture), parent);
  fs.rmSync(fixture, { recursive: true, force: true });
}
