import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer";
import { preview } from "vite";
import { dispatch } from "../lib/server/router.mjs";
import { registerCoachRoutes } from "../lib/server/routes/coach.mjs";
import { parseCoachPracticeLog } from "../lib/application/coach-sources.mjs";

const output = path.join(process.cwd(), ".tmp", "coach-report-ui");
fs.mkdirSync(output, { recursive: true });
const reportDirectory = fs.mkdtempSync(path.join(output, "reports-"));
const timestamp = new Date().toISOString();
const practice = parseCoachPracticeLog(`## Practice · ${timestamp}
- Mode: practice-sentence
- Context: work
- Hints used: 2/3
- Prompt: 请描述团队的工作。
- Your answer: Our team finish report.
- Reference answer: Our team finishes the report.
- Feedback: Check subject–verb agreement and the determiner.
`);
const entries = [{ source: "grammar", entryId: "private-grammar-id", timestamp, userInput: "I read book.", correction: "I read a book.", diagnoses: [{ error_type: "Article Usage" }] }, ...practice];
let calls = 0, failGeneration = false;
const llm = { config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async input => {
  calls++;
  await new Promise(resolve => setTimeout(resolve, 20));
  if (failGeneration) throw new Error("Fixture unavailable");
  const data = JSON.parse(input);
  const grammar = data.evidence.find(item => item.source === "grammar").entryId;
  const practice = data.evidence.find(item => item.source === "practice").entryId;
  const titles = data.language === "en"
    ? ["Executive Summary", "Learning Data & Evidence Analysis", "English Proficiency Assessment", "Language Knowledge & Weakness Diagnosis", "Personalized Learning Recommendations"]
    : ["综合能力概览", "学习数据与证据分析", "英语能力评估", "语言知识与薄弱环节诊断", "个性化学习建议"];
  const body = [
    `Your meaning is understandable; noun phrases need attention. [${grammar}]`,
    "根据保存的语法检查和练习记录分析；样本有限，带提示的回答不能证明独立掌握。",
    `You communicate a clear subject and action. [${practice}]`,
    `### 4.1. Error Classification & Frequency Analysis\n\nOne affected original. [${grammar}]\n\n### 4.2. Individual patterns and rule mapping\n\n| Error type | Pattern | Original | Proposed correction | Rule | Explanation | Severity | Mastery | Evidence |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| Article Usage | Missing determiner | I read book. | I read a book. | Singular count nouns need determiners | Countability and reference determine the form. | Minor | Not Observed | [${grammar}] |\n\n### 4.3. Recurring Error Patterns\nInsufficient evidence.\n\n### 4.4. Root Cause Analysis\nPossible cause: noun countability may need attention. This is a hypothesis. [${grammar}]\n\n### 4.5. Language Knowledge Map\nNoun phrases need attention. [${grammar}]\n\n### 4.6. Rule-Level Mastery Assessment\nNot Observed: insufficient independent evidence.\n\n### 4.7. Error Recurrence & Independent Application\nAssisted Practice cannot establish independent application. [${practice}]\n\n### 4.8. Knowledge Relationships & Dependencies\nCountability informs determiner choice. [${grammar}]`,
    "Build on your clear communication by attending to noun phrases and agreement in new contexts.",
  ];
  return titles.map((title, i) => `## ${i + 1}. ${title}\n\n${body[i]}`).join("\n\n");
} };
registerCoachRoutes({ reportDirectory, loadData: () => ({ entries, sourceStatus: { grammar: "available", practice: "available" } }), getLLMManager: async () => llm });
const api = http.createServer(dispatch);
await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
const apiBase = `http://127.0.0.1:${api.address().port}`;
let server, browser;
try {
  server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0, open: false } });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ["--no-sandbox"] });
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", async request => {
    try {
      const url = new URL(request.url());
      if (url.origin === base && url.pathname.startsWith("/coach")) {
        const response = await fetch(`${apiBase}${url.pathname}${url.search}`, { method: request.method(), ...(request.postData() ? { body: request.postData(), headers: { "Content-Type": "application/json" } } : {}) });
        return request.respond({ status: response.status, contentType: "application/json", body: await response.text() });
      }
      if (url.origin === base && url.pathname === "/settings/llm")
        return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ provider: "custom", providers: { custom: { models: { pro: "Fixture model", flash: "Fixture model" } } }, profiles: [], activeProfileId: "" }) });
      if (url.origin === base && url.pathname === "/runtime")
        return request.respond({ status: 200, contentType: "application/json", body: "{}" });
      if (url.origin !== base) return request.abort();
      return request.continue();
    } catch { if (!request.isInterceptResolutionHandled()) await request.abort(); }
  });
  const ready = async () => {
    try { await page.waitForFunction(() => !document.querySelector('.coach-progress') && (document.querySelector(".coach-report") || document.querySelector('.coach-page [role="alert"]'))); }
    catch (error) { console.error("Coach state:", await page.$eval(".coach-page", node => node.textContent), "Model calls:", calls, "Page errors:", errors); throw error; }
    assert.equal(await page.$eval(".coach-page", node => node.querySelector('[role="alert"]')?.textContent || ""), "");
  };
  const generate = () => page.click(".coach-page .handbook-filters .primary");
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${base}/#coach?days=0`);
  await page.waitForSelector(".coach-page");
  assert.equal(calls, 0);
  assert.match(await page.$eval(".coach-page", node => node.textContent), /02_Practice_Log/);
  assert.equal(await page.$(".coach-patterns"), null);
  assert.doesNotMatch(await page.$eval(".coach-page", node => node.textContent), /Explore individual patterns/);
  // Compress the former browser deadline so this catches a client abort before the server finishes.
  await page.evaluate(() => {
    const original = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => original(callback, delay === 180_000 ? 1 : delay, ...args);
  });
  await generate(); await ready();
  assert.equal(calls, 1);
  assert.equal((await page.$$(".coach-report .md > h3")).length, 5);
  const text = await page.$eval(".coach-report", node => node.textContent);
  assert.match(text, /1 grammar checks/);
  assert.match(text, /1 practice records/);
  assert.doesNotMatch(text, /repeated inputs|need validation through practice|shortened for analysis|Saved locally/);
  assert.match(text, /Individual patterns and rule mapping/);
  assert.doesNotMatch(text, /private-grammar-id|practice-log-[a-f0-9]/);
  assert.doesNotMatch(text, /\[S\d+\]|Source records cited in this report/);
  assert.equal(await page.$$eval(".coach-report th", cells => cells.some(cell => cell.textContent === "Evidence")), false);
  assert.equal(await page.$(".coach-report details"), null);
  const download = await page.evaluate(async () => {
    const originalUrl = URL.createObjectURL, originalClick = HTMLAnchorElement.prototype.click;
    let content;
    URL.createObjectURL = blob => { content = blob.text(); return "blob:coach-download-test"; };
    HTMLAnchorElement.prototype.click = () => {};
    try {
      [...document.querySelectorAll(".coach-page button")].find(button => button.textContent === "Download Markdown").click();
      return await content;
    } finally { URL.createObjectURL = originalUrl; HTMLAnchorElement.prototype.click = originalClick; }
  });
  assert.match(download, /Individual patterns and rule mapping/);
  assert.doesNotMatch(download, /\[S\d+\]|private-grammar-id|practice-log-[a-f0-9]|## Source records|Hints used:/);
  await page.waitForSelector('.coach-history-item[aria-current="true"]');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    const layout = await page.evaluate(() => {
      const history = document.querySelector('.coach-history').getBoundingClientRect();
      const reading = document.querySelector('.coach-reading').getBoundingClientRect();
      return { sideBySide: history.right < reading.left, stacked: history.bottom <= reading.top };
    });
    assert.equal(width > 760 ? layout.sideBySide : layout.stacked, true, `report layout at ${width}`);
    if (width === 1440) {
      const toolbar = await page.evaluate(() => [...document.querySelectorAll('.coach-toolbar > div, .coach-toolbar > label')].map(node => node.getBoundingClientRect().bottom));
      assert.ok(Math.max(...toolbar) - Math.min(...toolbar) < 8, 'desktop controls share one horizontal row');
    }
    await page.screenshot({ path: path.join(output, `coach-${width}.png`), fullPage: true });
  }
  failGeneration = true; await generate();
  await page.waitForSelector('.coach-page [role="alert"]');
  assert.notEqual(await page.$(".coach-report"), null, "keep the previous report on failure");
  failGeneration = false; await generate(); await ready();
  assert.equal(await page.$('.coach-page [role="alert"]'), null);
  await page.evaluate(() => { const select = [...document.querySelectorAll(".coach-page select")].find(node => [...node.options].some(option => option.value === "en")); select.value = "en"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.waitForFunction(() => !document.querySelector(".coach-report"));
  await generate(); await ready();
  assert.match(await page.$eval(".coach-report .md", node => node.textContent), /Executive Summary/);
  await page.reload(); await page.waitForSelector(".coach-page");
  await page.waitForSelector(".coach-history-item");
  await page.click(".coach-history-item"); await ready();
  assert.notEqual(await page.$('.coach-history-item[aria-current="true"]'), null);
  assert.doesNotMatch(await page.$eval(".coach-report", node => node.textContent), /\[S\d+\]|Source records cited in this report/);
  // Coach adds shared icons; make sure neighboring pages still render at both sizes.
  for (const route of ['grammar', 'ask']) {
    await page.goto(`${base}/#${route}`);
    await page.waitForSelector('h1');
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflow at ${width}`);
    }
  }
  assert.deepEqual(errors, []);
  console.log("Coach: citation-free report display/download, hidden source records, saved reports, language, retry, and desktop/mobile layout passed.");
} finally {
  await browser?.close(); await server?.close(); await new Promise(resolve => api.close(resolve));
  fs.rmSync(reportDirectory, { recursive: true, force: true });
}
