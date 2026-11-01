import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer";
import { buildLearningOverview } from "../lib/application/learning-overview.mjs";
import { buildGrammarHistory } from "../lib/application/grammar-history.mjs";
import { buildCoachPatterns } from "../lib/application/grammar-coach.mjs";

// Isolated built-client QA: all API requests are fixtures, never live learning writes.
const dist = path.join(process.cwd(), "apps", "web", "dist");
const artifacts = path.join(process.cwd(), "artifacts", "learner-language");
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.join(dist, new URL(req.url, "http://localhost").pathname === "/" ? "index.html" : new URL(req.url, "http://localhost").pathname);
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".svg") ? "image/svg+xml" : "text/html");
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [], answers = [], saves = [];
  page.on("pageerror", error => { errors.push(error.message); console.error("Browser error:", error.message); });
  page.on("dialog", dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url());
    if (url.origin !== base) { await request.abort(); return; }
    if (url.pathname === "/" || url.pathname.startsWith("/assets/")) { await request.continue(); return; }
    let body = {};
    if (url.pathname === "/ask" && request.method() === "POST") {
      const payload = JSON.parse(request.postData()); answers.push(payload);
      await new Promise(resolve => setTimeout(resolve, 350));
      body = { data: { title: "现在完成时用法", question: payload.question, answer: payload.language === "zh-CN" ? "用 **since** 表示起点。\n\nI have lived here since 2020." : "Use **since** for a starting point.\n\nI have lived here since 2020.", related: [], category: "Grammar", tags: ["since", "present-perfect"] } };
    } else if (url.pathname === "/ask/save") {
      const payload = JSON.parse(request.postData()); saves.push(payload);
      body = { saved: true, metadata: { title: "现在完成时用法", category: "Grammar", tags: [] } };
    } else if (url.pathname === "/ask/notes") body = { directory: "", notes: [{ id: "旧笔记.md", title: "旧笔记", content: "Original saved English note with **since**.", bytes: 50, modifiedAt: "2026-10-01T00:00:00Z" }] };
    else if (url.pathname === "/dashboard") body = buildLearningOverview([]);
    else if (url.pathname === "/coach") body = buildCoachPatterns([]);
    else if (url.pathname === "/handbook") body = buildGrammarHistory([]);
    else if (url.pathname === "/vocab/words") body = { words: [], total: 0, totalSaved: 0, sourceAvailable: true, hasMore: false, offset: 0, limit: 25 };
    else if (url.pathname === "/settings/llm") body = { provider: "custom", providers: { custom: { models: { flash: "fixture", pro: "fixture" } } } };
    else if (url.pathname === "/settings/files") body = { paths: {} };
    else if (url.pathname === "/review/due") body = { cards: [] };
    else if (url.pathname === "/status-message") body = { content: "" };
    await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  const text = () => page.$eval("main", el => el.textContent);
  const route = async value => { await page.evaluate(value => { location.hash = value; }, value); await page.waitForFunction(value => location.hash === `#${value}`, {}, value); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); assert.deepEqual(errors, [], `Rendering ${value}`); };
  const click = async label => page.evaluate(label => {
    const el = [...document.querySelectorAll("button")].find(el => el.textContent.trim() === label && el.getClientRects().length);
    if (!el) throw new Error(`Missing button: ${label}`); el.click();
  }, label);
  const switchGuide = async value => {
    if (!await page.$eval("#learner-language > summary", el => el.getClientRects().length > 0)) {
      await page.click(".menu-toggle");
    }
    if (!await page.$eval("#learner-language", el => el.open)) await page.click("#learner-language > summary");
    await page.click(`#learner-language [data-language="${value}"]`);
    assert.equal(await page.$eval("#learner-language", el => el.open), false);
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("#learner-language > summary")), true, "Selection restores focus to the menu trigger");
  };
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base);
  await page.waitForSelector("#grammar-input");
  assert.match(await text(), /Refine your tone, catch subtle grammar nuances/);
  await page.type("#grammar-input", "My untouched English draft.");
  await switchGuide("zh-CN");
  assert.match(await text(), /调整语气、发现细微的语法问题/);
  assert.match(await page.$eval("h1", el => el.textContent), /Write with\s*clarity/);
  assert.equal(await page.$eval("#grammar-input", el => el.value), "My untouched English draft.");
  await page.screenshot({ path: path.join(artifacts, "grammar-zh-desktop.png"), fullPage: true });
  await page.reload();
  await page.waitForSelector("#grammar-input");
  assert.equal(await page.$eval('#learner-language [aria-checked="true"]', el => el.dataset.language), "zh-CN");
  await route("settings");
  await page.waitForSelector(".llm-settings");
  assert.equal(await page.$("#settings-guide-language"), null, "Settings has no duplicate language picker above its heading");
  await page.click("#learner-language > summary");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-checked") === "true");
  await page.screenshot({ path: path.join(artifacts, "language-menu-desktop.png"), fullPage: true });
  await page.keyboard.press("End");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-language")), "en");
  await page.keyboard.press("Escape");
  assert.equal(await page.$eval("#learner-language", el => el.open), false);
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("#learner-language > summary")), true);
  await page.click("#learner-language > summary");
  await page.click("main h1");
  assert.equal(await page.$eval("#learner-language", el => el.open), false, "Clicking outside closes the language menu");
  for (const guide of ["zh-CN", "en"]) {
   await page.setViewport({ width: 1440, height: 1000 });
   await switchGuide(guide);
   for (const value of ["dashboard", "translation", "word-lookup", "word-library", "word-review", "practice", "handbook", "coach", "settings", "ask"]) {
    await route(value);
    if (value === "ask") await page.waitForSelector("#ask-input");
    for (const width of [1440, 1024, 900, 768, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${value} overflow at ${width}`);
    }
   }
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await switchGuide("zh-CN");
  assert.equal(await page.$eval("#ask-answer-language", el => el.value), "zh-CN");
  await page.screenshot({ path: path.join(artifacts, "ask-empty-zh-desktop.png"), fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844 });
    const controls = await page.$eval(".ask-composer-actions", el => {
      const select = el.querySelector("select").getBoundingClientRect();
      const send = el.querySelector(".primary").getBoundingClientRect();
      return { sameRow: Math.abs(select.top - send.top) < 8, selectHeight: select.height, sendHeight: send.height };
    });
    assert.equal(controls.sameRow, true, `Language and send controls share one row at ${width}`);
    assert.ok(controls.selectHeight >= 44 && controls.sendHeight >= 44);
    await page.screenshot({ path: path.join(artifacts, `ask-empty-zh-${width}.png`), fullPage: true });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.type("#ask-input", "When do I use since?");
  await page.click(".ask-composer .primary");
  await page.waitForFunction(() => document.querySelector("#ask-input").readOnly);
  await page.select("#ask-answer-language", "en");
  await page.waitForFunction(() => document.querySelectorAll(".ask-turn").length === 1);
  assert.equal(answers[0].language, "zh-CN", "In-flight generation keeps its submitted language");
  assert.match(await page.$eval(".ask-answer", el => el.textContent), /用 since 表示起点/);
  await switchGuide("en");
  assert.match(await page.$eval(".ask-answer", el => el.textContent), /用 since 表示起点/, "Guide changes do not translate existing answers");
  await page.type("#ask-input", "Another example?");
  await page.click(".ask-composer .primary");
  await page.waitForFunction(() => document.querySelectorAll(".ask-turn").length === 2);
  assert.equal(answers[1].language, "en");
  assert.equal(answers[1].messages[0].answer, "用 **since** 表示起点。\n\nI have lived here since 2020.");
  await page.click(".ask-save-menu summary");
  assert.equal(await page.$eval(".ask-save-options select", el => el.value), "en", "Summary defaults to latest answer language");
  await page.select(".ask-save-options select", "zh-CN");
  await click("Summarize & save conversation");
  await page.waitForFunction(() => document.querySelector(".ask-save-options .ask-save-action:last-child button")?.textContent.includes("Saved"));
  await page.select(".ask-save-options select", "en");
  await click("Summarize & save conversation");
  await page.waitForFunction(() => document.querySelector(".ask-save-options .ask-save-action:last-child button")?.textContent.includes("Saved"));
  assert.deepEqual(saves.map(item => item.language), ["zh-CN", "en"]);
  assert.equal(saves[0].messages.length, 2);
  await click("Save this answer");
  await page.waitForFunction(() => document.querySelector(".ask-save-options .ask-save-action button")?.textContent.includes("Saved"));
  assert.equal(saves[2].language, undefined);
  assert.equal(saves[2].messages[0].answer, answers[1].messages[0].answer);
  await page.screenshot({ path: path.join(artifacts, "ask-language-desktop.png"), fullPage: true });
  await route("ask?view=notes");
  await page.waitForSelector(".ask-note-link");
  await switchGuide("zh-CN");
  await page.click(".ask-note-link");
  await page.waitForFunction(() => document.querySelector("dialog[open]"));
  assert.match(await page.$eval(".ask-note-card", el => el.textContent), /Original saved English note with since\./);
  await page.keyboard.press("Escape");
  await route("ask");
  assert.equal(await page.$eval("#ask-answer-language", el => el.value), "en", "Explicit Ask choice survives guide changes and navigation");
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(artifacts, "ask-language-mobile.png"), fullPage: true });
  await page.click(".menu-toggle");
  await page.waitForSelector(".top-nav.is-open");
  assert.equal(await page.$eval("#learner-language", el => el.getClientRects().length > 0), true);
  await page.focus("#learner-language > summary");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-checked") === "true");
  await page.screenshot({ path: path.join(artifacts, "language-menu-mobile.png"), fullPage: true });
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.equal(await page.$eval("#ask-answer-language", el => el.value), "en");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Open mobile navigation fits");
  assert.deepEqual(errors, []);
  console.log("Learner language browser QA passed: preserved slogans/content/drafts, preference persistence, both modes on 10 routes at 6 widths, mobile keyboard switching, in-flight request isolation, mixed-language follow-ups, summary variants, verbatim answer save, old-note reader.");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
