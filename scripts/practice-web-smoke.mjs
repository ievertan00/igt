import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { getInstalledBrowsers } from "@puppeteer/browsers";
import { preview } from "vite";
import Database from "better-sqlite3";
import { runMigrations } from "../lib/db/migrations.mjs";
import { selectPracticeQuestions, publicPracticeQuestion } from "../lib/features/practice/question-bank.mjs";

const db = new Database(":memory:");
await runMigrations(db, path.join(import.meta.dirname, "..", "migrations"));
const captures = path.join(process.cwd(), ".cache", "practice-browser");
fs.mkdirSync(captures, { recursive: true });
const server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || await puppeteer.executablePath();
  if (!process.env.PUPPETEER_EXECUTABLE_PATH && !fs.existsSync(executablePath)) {
    const configuration = await puppeteer.configuration();
    const installed = (await getInstalledBrowsers({ cacheDir: configuration.cacheDirectory }))
      .filter(browser => browser.browser === "chrome" && fs.existsSync(browser.executablePath))
      .sort((a, b) => b.buildId.localeCompare(a.buildId, undefined, { numeric: true }));
    executablePath = installed[0]?.executablePath || executablePath;
  }
  browser = await puppeteer.launch({ headless: true,
    executablePath,
    args: ["--no-sandbox"],
  });
  const port = server.httpServer.address().port;
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let selection;
  let selectedQuestions;
  let evaluationInput;
  let failEvaluation = false;
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const route = new URL(request.url()).pathname;
    const respond = data => request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    if (route === "/runtime") return respond({ runtime: "local", storage: { database: "sqlite", assets: "markdown" } });
    if (route === "/practice/generate") {
      selection = JSON.parse(request.postData());
      const questions = selectPracticeQuestions(db, selection).map(publicPracticeQuestion);
      selectedQuestions = questions;
      return respond({ data: { questions } });
    }
    if (route === "/practice/evaluate") {
      if (failEvaluation) {
        failEvaluation = false;
        return request.respond({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Please retry.", retryable: true } }) });
      }
      const { question, hints_used } = JSON.parse(request.postData());
      evaluationInput = { question, hints_used };
      const stored = db.prepare("SELECT reference_answer FROM practice_questions WHERE id = ?").get(question.id);
      return respond({ data: { score: 88, verdict: "good", feedback_zh: "意思准确，请注意语气。", corrected_answer: stored.reference_answer, reference_answer: stored.reference_answer, strengths_zh: ["意思清楚"], improvements_zh: ["注意正式语气"] } });
    }
    return request.continue();
  });
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    await page.setViewport({ width, height });
    await page.goto(`http://127.0.0.1:${port}/#practice`, { waitUntil: "networkidle0" });
    await page.waitForSelector('input[name="practice-style"]');
    assert.equal(await page.$('.switches'), null);
    await page.click('input[name="practice-count"][value="10"]');
    await page.click('input[name="practice-style"][value="formal"]');
    await page.click('input[name="practice-context"][value="work-study"]');
    await page.screenshot({ path: path.join(captures, `${name}-setup.png`), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.click('button.practice-generate');
    await page.waitForSelector('#practice-input');
    assert.equal(selection.mode, "sentence"); assert.equal(selection.count, 10);
    assert.equal(selection.style, "formal"); assert.equal(selection.context, "work-study");
    assert.equal(selectedQuestions.length, 10);
    assert.equal(await page.$('#practice-hint-list li'), null);
    assert.equal(await page.$eval('.practice-question button.primary', node => node.disabled), true);
    for (let index = 0; index < selectedQuestions.length; index++) {
      assert.equal(await page.$$eval('#practice-hint-list li', nodes => nodes.length), 0);
      if (index === 0) {
        for (let hint = 0; hint < 3; hint++) {
          await page.click('.practice-hints button');
          assert.equal(await page.$$eval('#practice-hint-list li', nodes => nodes.length), hint + 1);
        }
        assert.equal(await page.$eval('.practice-hints button', node => node.disabled), true);
        const reference = db.prepare('SELECT reference_answer FROM practice_questions WHERE id = ?').get(selectedQuestions[0].id).reference_answer;
        assert.ok(!(await page.$eval('.practice-question', node => node.textContent)).includes(reference));
        await page.screenshot({ path: path.join(captures, `${name}-hints.png`), fullPage: true });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await page.type('#practice-input', 'Please confirm the arrangements.');
      if (index === 0) {
        failEvaluation = true;
        await page.click('.practice-question button.primary');
        await page.waitForFunction(() => document.body.textContent.includes('Could not review this answer'));
        assert.equal(await page.$eval('#practice-input', node => node.value), 'Please confirm the arrangements.');
      }
      await page.click('.practice-question button.primary');
      await page.waitForFunction(() => document.body.textContent.includes('意思准确'));
      assert.equal(evaluationInput.hints_used, index === 0 ? 3 : 0);
      await page.waitForFunction(() => !document.querySelector('.practice-question button.primary').disabled);
      if (index === 0) {
        await page.evaluate(() => document.activeElement?.blur());
        await page.screenshot({ path: path.join(captures, `${name}-feedback.png`), fullPage: true });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      // Locate the next action by its displayed label rather than unrelated shell controls.
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => /^(Next question|Finish session)$/.test(button.textContent.trim()))?.click());
      if (index < selectedQuestions.length - 1) await page.waitForFunction(() => document.querySelector('#practice-input')?.value === '');
    }
    await page.waitForSelector('input[name="practice-style"]');
  }
  assert.deepEqual(errors, []);
  console.log("Practice desktop/mobile smoke ok; screenshots in .cache/practice-browser");
} finally {
  await browser?.close();
  await server.close();
  db.close();
}
