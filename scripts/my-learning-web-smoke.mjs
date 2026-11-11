import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer";
import { preview } from "vite";
import { dispatch } from "../lib/server/router.mjs";
import { registerCoachRoutes } from "../lib/server/routes/coach.mjs";
import { registerDashboardRoutes } from "../lib/server/routes/dashboard.mjs";
import { registerHandbookRoutes } from "../lib/server/routes/handbook.mjs";
import { buildGrammarHistory } from "../lib/application/grammar-history.mjs";
import { buildLearningOverview, getOverviewPracticeLog } from "../lib/application/learning-overview.mjs";
import { buildCoachPatterns, clearGrammarCoachCache } from "../lib/application/grammar-coach.mjs";

const entries = Array.from({ length: 14 }, (_, index) => ({ source: "grammar", entryId: `saved-${index}`, timestamp: new Date(Date.now() - index * 86400000).toISOString(),
  userInput: index < 12 ? "I read book." : "Yesterday she goes.", correction: index < 12 ? "I read a book." : "Yesterday she went.",
  diagnoses: [{ error_type: index < 12 ? "Articles" : "Tense", explanation: "Consider the context.", severity: "Minor" }] }));
entries.push({ source: "unknown", entryId: "legacy", timestamp: new Date().toISOString(), userInput: "Preserved legacy", diagnoses: [] });
let calls = 0, failGeneration = false, failOverview = false, overviewState = "normal", holdType = "", release;
let legacyOverview = false;
const llm = { config: {}, getCurrentProviderName: () => "custom", generateWithFallback: async input => {
  calls++;
  const { errorType, examples } = JSON.parse(input);
  if (holdType === errorType) await new Promise(resolve => { release = resolve; });
  if (failGeneration) throw new Error("Fixture unavailable");
  return JSON.stringify({ observedPattern: `${errorType}: a recurring pattern in your writing.`, principle: `${errorType} grammar principle explained in context.`, qualifications: "The context determines which form fits. Fixed expressions may differ.",
    possibleCauses: [{ hypothesis: "You may be overlooking the relevant context.", evidenceIds: [examples[0].entryId] }], examples: [{ entryId: examples.at(-1).entryId, explanation: "This saved correction fits its context." }] });
} };
const loadData = () => ({ entries });
registerCoachRoutes({ loadData, getLLMManager: async () => llm });
registerHandbookRoutes({ loadHistory: options => buildGrammarHistory(entries, { ...options, includeLegacy: true }) });
const events = entries.map(item => ({ source: "review-log", id: item.entryId, type: item.source === "grammar" ? "grammar" : "writing", timestamp: item.timestamp, title: item.userInput, href: item.source === "grammar" ? `#handbook?days=0&entry=${item.entryId}` : null }));
events.push({ source: "attempts", id: "1", type: "review", timestamp: new Date().toISOString(), title: "book", score: 100 });
events.push({ source: "vocab", id: "book", type: "vocabulary", timestamp: new Date().toISOString(), title: "book", precision: "day", href: "#word-library" });
const practiceMarkdown = "## Practice · 2026-11-08T10:00:00Z\n- Prompt: Translate the sentence.\n- Your answer: This is a saved practice entry.\n";
registerDashboardRoutes({ loadPracticeLog: (config, options) => getOverviewPracticeLog(config, { ...options, readFile: () => practiceMarkdown }), loadOverview: options => {
  if (failOverview) throw Object.assign(new Error("Fixture unavailable"), { status: 503 });
  const data = buildLearningOverview(overviewState === "empty" ? [] : overviewState === "partial" ? events.filter(event => event.source !== "review-log") : events, options, { reviewEntries: overviewState === "normal" ? entries : [], patterns: overviewState === "normal" ? buildCoachPatterns(entries, options).patterns : [],
    coverage: [{ source: "Saved writing", status: overviewState === "partial" ? "unavailable" : "available", note: "Saved records only." }, { source: "Vocabulary inventory", status: "inventory", count: 1, note: "Inventory is separate from activity." }, { source: "Translation, listening and conversation", status: "not-recorded", note: "Unsaved interactions are not counted." }] });
  if (legacyOverview) delete data.savedMaterial;
  return data;
} });
const api = http.createServer(dispatch);
await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
const apiBase = `http://127.0.0.1:${api.address().port}`;
let server, browser;
try {
  const list = await fetch(`${apiBase}/coach?days=0`).then(response => response.json());
  assert.equal(list.patterns.length, 2); assert.equal(calls, 0);
  assert.equal((await fetch(`${apiBase}/coach/unknown`)).status, 404);
  assert.equal((await fetch(`${apiBase}/coach?days=-1`)).status, 400);
  assert.equal((await fetch(`${apiBase}/coach/explain`, { method: "POST", body: JSON.stringify({ errorType: "Articles", version: "outdated" }) })).status, 409);
  assert.equal((await fetch(`${apiBase}/dashboard?limit=0`)).status, 400);
  server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0, open: false } });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH });
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", async request => {
    try {
      const url = new URL(request.url());
      if (url.origin === base && ["/coach", "/coach/explain", "/dashboard", "/dashboard/practice-log", "/handbook"].includes(url.pathname)) {
        const response = await fetch(`${apiBase}${url.pathname}${url.search}`, { method: request.method(), ...(request.postData() ? { body: request.postData(), headers: { "Content-Type": "application/json" } } : {}) });
        await request.respond({ status: response.status, contentType: "application/json", body: await response.text() });
      } else if (url.origin === base && url.pathname === "/ask/notes") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ notes: [{ id: "fixture.md" }] }) });
      } else if (url.origin === base && url.pathname === "/runtime") await request.respond({ status: 200, contentType: "application/json", body: "{}" });
      else await request.continue();
    } catch { if (!request.isInterceptResolutionHandled()) await request.abort(); }
  });
  const ready = async () => { await page.waitForNetworkIdle({ idleTime: 120 }); await page.waitForFunction(() => ![...document.querySelectorAll('[aria-busy]')].some(node => node.getAttribute("aria-busy") === "true")); };
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${base}/#coach?days=0`); await ready();
  assert.equal(calls, 0);
  assert.equal(await page.$(".coach-patterns"), null);
  assert.equal(await page.$eval(".coach-page h1", node => node.textContent), "English skills report");
  assert.equal(await page.$eval(".coach-actions .primary", node => node.textContent), "Generate report");
  // Full report generation, citations and persistence are covered by coach-report-web-smoke.mjs.
  const output = path.join(process.cwd(), ".tmp", "my-learning-qa"); fs.mkdirSync(output, { recursive: true });
  for (const route of ["dashboard", "coach"]) {
    await page.goto(`${base}/#${route}?days=0${route === "coach" ? "&errorType=Tense" : ""}`); await ready();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflow at ${width}`);
      if (width === 1440 || width === 390) await page.screenshot({ path: path.join(output, `${route}-${width}.png`), fullPage: true });
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflow at 200% text`);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${base}/#dashboard?days=0`); await ready();
  assert.deepEqual(
    await page.$$eval(".overview-quick, .overview-effort, .overview-priorities, .overview-timeline", sections =>
      sections.map(section => section.querySelector("h2").textContent)),
    ["Your saved material", "Effort trend", "Top 3 priorities", "Recent activity"],
  );
  assert.match(await page.$eval('.overview-quick-link[href^="#handbook"]', node => node.textContent), /14 saved Grammar checks/);
  assert.match(await page.$eval('.overview-quick-link[href^="#ask"]', node => node.textContent), /0 saved notes/);
  const coachCard = '.overview-quick-link[href="#coach"]';
  assert.equal((await page.$$(".overview-quick-link")).length, 4);
  assert.equal(await page.$eval('#workspace-nav a[href="#coach"]', node => node.textContent), "Learning reports");
  assert.equal(await page.$eval(coachCard + " strong", node => node.textContent), "Learning reports");
  assert.equal(await page.$eval(coachCard + " .overview-link-copy > span", node => node.textContent), "See your strengths, recurring mistakes, and what to practice next.");
  await page.click(coachCard);
  await page.waitForSelector(".coach-page");
  await page.goBack(); await ready();
  await page.click('.overview-history-actions a[href="#dashboard?view=practice-log"]');
  await page.waitForSelector(".practice-log-panel .md");
  assert.match(await page.$eval(".practice-log-panel", node => node.textContent), /This is a saved practice entry/);
  await page.goBack(); await ready();
  assert.equal((await page.$$(".learning-timeline li")).length, 5);
  assert.equal((await page.$$(".overview-daily li")).length, 7);
  for (const [period, count] of [["Weekly", 4], ["Monthly", 6], ["Daily", 7]]) {
    await page.evaluate(label => [...document.querySelectorAll('.overview-chart-controls button')].find(button => button.textContent === label).click(), period);
    assert.equal((await page.$$(".overview-daily li")).length, count);
    assert.equal(await page.$eval('.overview-chart-controls button[aria-pressed="true"]', node => node.textContent), period);
    assert.doesNotMatch(await page.$eval('.overview-daily', node => node.textContent), /Invalid Date|NaN/);
  }
  await page.click('.overview-counting summary');
  assert.equal(await page.$eval('.overview-counting', node => node.open), true);
  await page.click('.overview-counting summary');
  assert.equal((await page.$$(".overview-priority-list li")).length, 2);
  assert.match(await page.$eval(".overview-priority-list", node => node.textContent), /Articles12 hits/);
  assert.equal(await page.$(".learning-badge-review"), null);
  assert.doesNotMatch(await page.$eval(".learning-timeline", node => node.textContent), /100\/100/);
  await page.select(".overview-history-heading select", "90"); await ready();
  assert.match(await page.$eval(".overview-priorities", node => node.textContent), /Last 30 days/);
  await page.click(".handbook-pagination button:last-child"); await ready(); assert.equal((await page.$$(".learning-timeline li")).length, 5);
  assert.match(await page.$eval(".handbook-pagination", node => node.textContent), /6–10 of 16/);
  await page.goBack(); await ready(); assert.equal((await page.$$(".learning-timeline li")).length, 5);
  failOverview = true; await page.click(".overview-header button"); await ready(); assert.notEqual(await page.$('[role="alert"]'), null);
  failOverview = false; await page.click('[role="alert"] button'); await ready(); assert.equal(await page.$('[role="alert"]'), null);
  overviewState = "empty"; await page.click(".overview-header button"); await ready();
  assert.match(await page.$eval(".overview-priorities", node => node.textContent), /No error types recorded/);
  assert.match(await page.$eval(".overview-momentum", node => node.textContent), /No activity in either week/);
  assert.match(await page.$eval(".overview-page", node => node.textContent), /No recent activity in this window/);
  overviewState = "partial"; await page.click(".overview-header button"); await ready();
  assert.match(await page.$eval(".overview-notice", node => node.textContent), /Saved writing/);
  assert.match(await page.$eval(".overview-priorities", node => node.textContent), /Priorities unavailable/);
  events.unshift({ source: "long-record", id: "long", type: "text", timestamp: new Date().toISOString(), title: "A long saved text. ".repeat(50), href: "#ask?view=notes" });
  overviewState = "normal"; await page.click(".overview-header button"); await ready();
  await page.click(".learning-timeline details summary");
  assert.equal(await page.$eval(".learning-timeline details p", node => node.textContent), events[0].title);
  legacyOverview = true;
  await page.click(".overview-header button"); await ready();
  assert.match(await page.$eval('.overview-quick-link[href^="#handbook"]', node => node.textContent), /14 saved Grammar checks/);
  assert.match(await page.$eval('.overview-quick-link[href^="#ask"]', node => node.textContent), /1 saved note/);
  await page.goto(`${base}/#grammar`); await page.waitForSelector("textarea");
  assert.deepEqual(errors, []);
  console.log("My Learning: real route contracts, report-only Coach entry, pattern API compatibility, mixed timeline, pagination, back navigation and responsive layouts passed.");
} finally { release?.(); await browser?.close(); await server?.close(); await new Promise(resolve => api.close(resolve)); }
