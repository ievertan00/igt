import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { preview } from "vite";
import { buildHandbook } from "../lib/application/handbook.mjs";
import { registerHandbookRoutes } from "../lib/server/routes/handbook.mjs";
import { dispatch } from "../lib/server/router.mjs";
import { saveHandbookReport } from "../lib/application/handbook-reports.mjs";

const reportConfig = { ReportPath: path.join(process.cwd(), "artifacts", "handbook-qa", "reports") };
const reportFixture = "# Handbook QA fixture\n\n> [!NOTE]- Personal rule\n> Use **a determiner** before a singular countable noun.\n\n| Category | Observations |\n| --- | --- |\n| Articles | 2 |\n\n[Reference](https://example.com)\n\n<script>parent.__unsafe = true</script>";
for (const [date, count] of [["2026-10-20", 2], ["2026-10-21", 1]]) saveHandbookReport({ markdown: reportFixture, provider: "mock", date, days: 90, stats: { total_inputs: 3, total_diagnoses: count }, errorFrequency: [{ error_type: "Articles", count }], generatedAt: `${date}T10:00:00Z`, format: "html" }, reportConfig);
fs.writeFileSync(path.join(reportConfig.ReportPath, "handbook_2026-10-19_legacy.md"), "# Legacy QA fixture\n\nA saved report without a structured snapshot.");
registerHandbookRoutes({ getReportConfig: () => reportConfig });
const api = http.createServer(dispatch);
await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
const server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  const live = await fetch(`http://127.0.0.1:${api.address().port}/handbook?days=0&search=unlikely-handbook-probe&limit=2&offset=99`).then((response) => response.json());
  assert.equal(live.days, 0);
  assert.equal(live.search, "unlikely-handbook-probe");
  assert.equal(live.pagination.limit, 2);
  assert.deepEqual(live.examples, []);
  const invalidRule = await fetch(`http://127.0.0.1:${api.address().port}/handbook/rule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(invalidRule.status, 400);
  const data = { totalInputs: 8, entries: Array.from({ length: 8 }, (_, i) => ({
    entryId: `fixture-${i}`, timestamp: new Date(Date.now() - i * 86400000).toISOString(),
    userInput: i === 7 ? "She go yesterday." : `I bought book ${i}.`,
    correction: i === 7 ? "She went yesterday." : `I bought a book ${i}.`,
    diagnoses: [{ error_type: i === 7 ? "Tense" : "Articles", severity: "Minor", explanation: i === 7 ? "Past events" : "Use an article." }],
    remember: ["Read the context", "Try again tomorrow"], refine: "A more natural sentence.",
  })) };
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Users\\Evertan\\.cache\\puppeteer\\chrome\\win64-153.0.8010.36\\chrome-win64\\chrome.exe", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  let ruleRequests = 0;
  let failRule = true;
  let holdRule;
  let releaseRule;
  const linkedAttempts = [];
  let generatedTarget;
  let evaluatedTarget;
  let failReportList = true;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/handbook") {
      const options = Object.fromEntries(url.searchParams);
      const response = buildHandbook(data, { ...options, days: Number(options.days) });
      if (response.selected) response.practice = {
        status: response.selected === "Articles" ? "available" : "empty", total: response.selected === "Articles" ? 3 : 0,
        byDifficulty: response.selected === "Articles" ? { standard: 3 } : {},
        evidence: { attempts: linkedAttempts.length, withoutHints: linkedAttempts.filter((attempt) => attempt.hints_used === 0).length, latestScore: linkedAttempts.length ? 88 : null },
      };
      await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(response) });
    } else if (url.pathname === "/practice/generate") {
      const body = JSON.parse(request.postData());
      generatedTarget = body.targetErrorType;
      await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { questions: body.difficulty === "challenge" ? [] : [{
        id: "fixture-practice-article", kind: "sentence", prompt_zh: "请买一本书。", difficulty: body.difficulty, style: "neutral", context: "shopping",
        target_error_type: body.targetErrorType, practice_fields: { grammar_point: ["Articles"] }, hints: { simple: "注意名词前的限定词。" },
      }] } }) });
    } else if (url.pathname === "/practice/evaluate") {
      const body = JSON.parse(request.postData());
      evaluatedTarget = body.question.target_error_type;
      linkedAttempts.push(body);
      await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { score: 88, verdict: "good", corrected_answer: "Please buy a book.", reference_answer: "Please buy a book.", feedback_zh: "意思清楚。", strengths_zh: [], improvements_zh: [] } }) });
    } else if (url.pathname === "/handbook/rule") {
      ruleRequests++;
      const body = JSON.parse(request.postData());
      if (holdRule) await holdRule;
      await request.respond({ status: failRule ? 503 : 200, contentType: "application/json", body: JSON.stringify(failRule
        ? { error: { code: "HANDBOOK_RULE_UNAVAILABLE", message: "mock unavailable" } }
        : { exampleCount: body.errorType === "Tense" ? 1 : 5, rule: { title: `${body.errorType} rule`, content: `## ${body.errorType} explanation\nUse the pattern in a new sentence.`, generatedAt: new Date().toISOString() } }) });
    } else if (url.pathname.startsWith("/handbook/reports")) {
      if (url.pathname === "/handbook/reports" && failReportList) {
        failReportList = false;
        await request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Reports unavailable" }) });
      } else {
        const response = await fetch(`http://127.0.0.1:${api.address().port}${url.pathname}${url.search}`);
        await request.respond({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
      }
    } else if (["/runtime", "/dashboard", "/status-message"].includes(url.pathname)) {
      await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ runtime: "local", storage: {}, stats: {}, recentActivity: [] }) });
    } else await request.continue();
  });
  const url = `http://127.0.0.1:${server.httpServer.address().port}/#handbook`;
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.waitForSelector(".handbook-example");
  assert.equal(await page.$eval(".handbook-pagination", (el) => el.textContent.includes("1–5 of 7")), true);
  assert.ok(await page.$(".handbook-example ins"));
  assert.equal(await page.$$eval(".handbook-example li", (items) => items.length), 10);
  const clickText = async (selector, text) => {
    await page.$$eval(selector, (elements, label) => elements.find((el) => el.textContent.trim() === label).click(), text);
  };
  await clickText(".handbook-knowledge button", "Explain this pattern");
  await page.waitForSelector('.handbook-knowledge [role="alert"]');
  assert.equal(await page.$$(".handbook-example").then((items) => items.length), 5);
  failRule = false;
  await clickText(".handbook-knowledge button", "Try explanation again");
  await page.waitForSelector(".handbook-rule");
  assert.equal(ruleRequests, 2);
  await clickText(".handbook-pagination button", "Next");
  await page.waitForFunction(() => document.querySelector(".handbook-pagination")?.textContent.includes("6–7 of 7"));
  assert.ok(await page.$(".handbook-rule"));
  // A late response from the previous category must never appear here.
  await clickText(".handbook-list button", "Tense1");
  await page.waitForFunction(() => document.querySelector(".handbook-example")?.textContent.includes("She go yesterday."));
  assert.equal(await page.$(".handbook-practice a.secondary"), null);
  assert.equal(await page.$eval(".handbook-practice", (el) => el.textContent.includes("No related practice questions")), true);
  holdRule = new Promise((resolve) => { releaseRule = resolve; });
  await clickText(".handbook-knowledge button", "Explain this pattern");
  await page.waitForFunction(() => document.querySelector(".handbook-knowledge")?.textContent.includes("Preparing explanation"));
  await clickText(".handbook-list button", "Articles7");
  await page.waitForFunction(() => document.querySelector(".handbook-example")?.textContent.includes("I bought book 0."));
  const oldResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/handbook/rule");
  releaseRule();
  await oldResponse;
  holdRule = null;
  assert.equal(await page.$(".handbook-rule"), null);
  await page.select(".handbook-filters select", "0");
  await page.waitForFunction(() => document.querySelector(".coach-sample")?.textContent.includes("All history"));
  await page.type('.handbook-filters input[type="search"]', "PAST EVENTS");
  await clickText(".handbook-filters button", "Search");
  await page.waitForFunction(() => document.querySelector(".handbook-example")?.textContent.includes("She go yesterday."));
  await page.$eval('.handbook-filters input[type="search"]', (el) => { el.select(); });
  await page.keyboard.type("no-match-anywhere");
  await clickText(".handbook-filters button", "Search");
  await page.waitForFunction(() => document.querySelector(".handbook-page")?.textContent.includes("No matching examples."));
  await clickText(".handbook-filters button", "Clear search");
  await page.waitForSelector(".handbook-example");
  await clickText(".handbook-knowledge button", "Explain this pattern");
  await page.waitForSelector(".handbook-rule");
  const output = path.join(process.cwd(), "artifacts", "handbook-qa");
  fs.mkdirSync(output, { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(output, "mobile.png"), fullPage: true });
  await page.click(".handbook-practice a.secondary");
  await page.waitForSelector(".practice-target");
  assert.equal(await page.$eval(".practice-target h2", (el) => el.textContent), "Articles");
  assert.ok(page.url().includes("returnDays=0"));
  await page.click('input[name="practice-difficulty"][value="challenge"]');
  await page.click(".practice-generate");
  await page.waitForFunction(() => document.body.textContent.includes("No questions match this target"));
  assert.equal(generatedTarget, "Articles");
  await page.click('input[name="practice-difficulty"][value="standard"]');
  await page.click(".practice-generate");
  await page.waitForSelector("#practice-input");
  await page.type("#practice-input", "Please buy a book.");
  await clickText(".practice-question button", "Check answer");
  await page.waitForSelector(".evaluation");
  assert.equal(evaluatedTarget, "Articles");
  assert.equal(linkedAttempts[0].hints_used, 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, "practice-mobile.png"), fullPage: true });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(output, "practice-desktop.png"), fullPage: true });
  await clickText(".practice-target a", "Return to this Handbook category");
  await page.waitForFunction(() => document.querySelector(".handbook-practice")?.textContent.includes("1 linked practice attempts"));
  assert.equal(await page.$eval(".handbook-filters select", (el) => el.value), "0");
  assert.equal(await page.$eval(".handbook-list button.selected", (el) => el.textContent), "Articles7");
  await page.click(".handbook-reports > summary");
  await page.waitForSelector('.handbook-reports [role="alert"]');
  await clickText(".handbook-reports button", "Refresh reports");
  await page.waitForSelector(".handbook-report-select select");
  await page.select(".handbook-report-select select", "handbook_2026-10-21_mock.md");
  await page.waitForSelector(".handbook-reports iframe");
  const reportFrame = await (await page.$(".handbook-reports iframe")).contentFrame();
  await reportFrame.waitForSelector("table");
  assert.equal(await reportFrame.$$("script").then((items) => items.length), 0);
  assert.equal(await page.evaluate(() => window.__unsafe), undefined);
  await page.select(".handbook-report-compare select", "handbook_2026-10-20_mock.md");
  await clickText(".handbook-reports button", "Compare recorded counts");
  await page.waitForSelector(".handbook-comparison");
  assert.equal(await page.$eval(".handbook-comparison", (el) => el.textContent.includes("-1")), true);
  await page.$eval(".handbook-reports", (el) => el.scrollIntoView());
  await page.screenshot({ path: path.join(output, "reports-desktop.png") });
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(output, "reports-mobile.png") });
  assert.equal(await reportFrame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.select(".handbook-report-select select", "handbook_2026-10-19_legacy.md");
  await page.waitForFunction(() => document.querySelector(".handbook-reports")?.textContent.includes("no matching structured snapshot"));
  const downloaded = await fetch(`http://127.0.0.1:${api.address().port}/handbook/reports/export?id=handbook_2026-10-21_mock.md&format=html`);
  assert.match(downloaded.headers.get("content-disposition"), /attachment/);
  const offline = await browser.newPage();
  const offlineRequests = [];
  offline.on("request", (request) => offlineRequests.push(request.url()));
  await offline.setViewport({ width: 1100, height: 900 });
  await offline.setContent(await downloaded.text(), { waitUntil: "load" });
  assert.equal(offlineRequests.length, 0);
  assert.equal(await offline.$eval("h1", (el) => el.textContent), "Handbook QA fixture");
  await offline.screenshot({ path: path.join(output, "report-offline.png"), fullPage: true });
  await offline.emulateMediaType("print");
  assert.equal(await offline.$eval("details > p", (el) => el.getBoundingClientRect().height > 0), true);
  await offline.screenshot({ path: path.join(output, "report-print.png"), fullPage: true });
  await offline.close();
  assert.deepEqual(errors, []);
  console.log("Handbook: search, rules, Practice round trip, historical reports, retry, structured comparison, legacy reports and offline HTML passed; desktop/mobile layout and HTTP validation passed.");
} finally {
  await browser?.close();
  await server.close();
  await new Promise((resolve) => api.close(resolve));
}
