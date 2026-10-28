import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { createServer } from "vite";

// Isolated UI fixtures: every business request is intercepted; no user data is written.
const output = path.join(process.cwd(), "artifacts", "ui-consistency");
fs.mkdirSync(output, { recursive: true });
const server = await createServer({ configFile: "apps/web/vite.config.ts", server: { host: "127.0.0.1", port: 0 } });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [], checks = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.evaluateOnNewDocument(() => {
    // Deterministic playback permits inspection of the pending state without a TTS service.
    HTMLMediaElement.prototype.play = function () {
      setTimeout(() => window.__failAudio ? this.onerror?.(new Event("error")) : this.onended?.(new Event("ended")), window.__failAudio ? 20 : 2500);
      return Promise.resolve();
    };
  });
  const entry = { word: "follow up", pos: "phrasal verb", phonetic: "/ˈfɒləʊ ʌp/", zh: "跟进", meaning: "to act after an earlier event", example: "I will follow up tomorrow.", example2: "Please follow up on the request.", synonyms: "check back", collocations: "follow up on a request" };
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url()), pathname = url.pathname;
    const json = body => request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (pathname.startsWith("/src/") || pathname.startsWith("/@") || pathname.startsWith("/node_modules/") || pathname === "/" || pathname.startsWith("/assets/")) return request.continue();
    if (url.origin !== new URL(base).origin) return request.abort();
    requests.push(`${request.method()} ${pathname}`);
    if (pathname === "/dashboard") return json({ stats: { totalInputs: 2 }, today: { inputs_today: 1 }, recentActivity: [], coach: {} });
    if (pathname === "/coach") return json({ windowDays: 30, sample: { totalInputs: 2, totalDiagnoses: 1 }, priorities: [], limitations: ["UI fixture"] });
    if (pathname === "/settings/llm") return json({ provider: "custom", providers: { custom: { baseUrl: "", models: { flash: "", pro: "" } } } });
    if (pathname === "/settings/files") return json({ paths: { vocabulary: "", reviewLog: "", askNotesDir: "", handbookReports: "" } });
    if (pathname === "/ask/notes") return json({ directory: "UI fixture", notes: [] });
    if (pathname === "/handbook") return json({ days: 90, stats: { total_inputs: 2, total_diagnoses: 1 }, frequencies: [{ error_type: "Articles", count: 1 }], examples: [], pagination: { offset: 0, limit: 20, hasMore: false, total: 0 } });
    if (pathname === "/review/due") return json({ cards: [{ id: 101, source_type: "vocab", ...entry, vocab_details: entry }] });
    if (pathname === "/review/check") return json({ correct: true, persistence: { saved: false } });
    if (pathname === "/review/grade") return json({ correct: true, next: { intervalDays: 6 }, persistence: { saved: true } });
    if (pathname === "/vocab/words") return json({ words: [], sourceAvailable: true, total: 0, totalSaved: 0, offset: 0, limit: 25, hasMore: false, overview: { due: 0, overdue: 0, dueToday: 0, retained: 0, wellRetained: 0, distribution: {} } });
    if (pathname === "/word/lookup") return json({ data: entry });
    if (pathname === "/grammar") return json({ result: { originalText: "I suggested him to join.", correction: "I suggested that he join.", refine: "I suggested he join.", diagnoses: [], remember: "suggest + that clause" }, persistence: { saved: false, requiresConfirmation: true } });
    if (pathname === "/ask") { await new Promise(resolve => setTimeout(resolve, 500)); return json({ data: { answer: "Use a specific example to explain your idea.", related: ["How can I practise this?"] } }); }
    if (pathname === "/ask/save") { await new Promise(resolve => setTimeout(resolve, 500)); return json({ saved: true, turnCount: 1, vaultFile: "UI fixture.md" }); }
    if (pathname === "/tts/speak") return request.respond({ status: 200, contentType: "audio/wav", body: Buffer.alloc(44) });
    return json({});
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  async function capture(name, widths = [1440, 768, 390, 320]) {
    for (const width of widths) {
      await page.setViewport({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const audit = await page.evaluate(() => {
        const visible = el => el.getClientRects().length > 0;
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          unnamed: [...document.querySelectorAll("button")].filter(visible).filter(el => !el.getAttribute("aria-label") && !el.textContent.trim()).map(el => el.className),
          short: [...document.querySelectorAll("button")].filter(visible).filter(el => el.getBoundingClientRect().height < 43.5).map(el => ({ className: el.className, height: el.getBoundingClientRect().height })),
        };
      });
      assert.equal(audit.overflow, false, `${name}/${width} overflows`);
      assert.deepEqual(audit.unnamed, [], `${name}/${width} unnamed controls`);
      assert.deepEqual(audit.short, [], `${name}/${width} small targets`);
      checks.push({ name, width, ...audit });
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
    }
  }
  async function route(name) {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`${base}/#${name}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("main h1");
  }
  for (const name of ["grammar", "translation", "word-lookup", "word-review", "word-library", "practice", "ask", "dashboard", "handbook", "coach", "settings"]) {
    await route(name);
    await capture(name);
  }
  await page.focus("#settings-tab-models");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.$eval("#settings-tab-markdown", el => el.getAttribute("aria-selected")), "true");
  assert.equal(await page.$eval("#settings-tab-markdown", el => getComputedStyle(el).outlineStyle), "solid");
  await capture("settings-markdown");
  await page.keyboard.press("Home");
  assert.equal(await page.$eval("#settings-tab-models", el => el.tabIndex), 0);
  await route("word-lookup");
  await page.type("#word-lookup-input", "follow up");
  await page.click(".lookup-row .primary");
  await page.waitForSelector(".word-details");
  await capture("word-result");
  const utilityStyles = await page.$$eval(".icon-button", buttons => buttons.map(el => {
    const style = getComputedStyle(el), rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, radius: style.borderRadius, icon: getComputedStyle(el.querySelector("svg")).width };
  }));
  for (const style of utilityStyles) assert.deepEqual(style, { width: 44, height: 44, radius: "50%", icon: "18px" });
  await page.focus(".audio-btn");
  await page.keyboard.press("Tab");
  await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift");
  assert.equal(await page.$eval(".audio-btn", el => getComputedStyle(el).outlineStyle), "solid");
  await page.click(".audio-btn");
  assert.equal(await page.$eval(".audio-btn", el => el.disabled && el.getAttribute("aria-busy") === "true"), true);
  await page.screenshot({ path: path.join(output, "audio-pending.png"), fullPage: true });
  await page.waitForFunction(() => !document.querySelector(".audio-btn").disabled);
  await page.click(".copy-btn");
  await page.waitForSelector(".copy-btn.is-copied");
  await page.screenshot({ path: path.join(output, "copy-success.png"), fullPage: true });
  await page.evaluate(() => {
    window.__failAudio = true;
    speechSynthesis.speak = utterance => setTimeout(() => utterance.onerror?.(new Event("error")), 10);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("UI fixture: clipboard denied")) } });
    document.execCommand = () => false;
  });
  await page.click(".audio-btn");
  await page.waitForSelector(".audio-error");
  await page.click(".copy-btn");
  await page.waitForSelector(".copy-btn.is-failed");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, "utility-errors.png"), fullPage: true });
  // The floating action belongs to the selected content, with the existing modal workflow.
  await page.evaluate(() => {
    document.activeElement?.blur();
    const range = document.createRange(); range.selectNodeContents(document.querySelector(".word-heading h3"));
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await page.waitForSelector(".selection-lookup-trigger");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, "selection-action.png"), fullPage: true });
  await page.click(".selection-lookup-trigger");
  await page.waitForSelector(".selection-lookup-dialog[open]");
  await capture("selection-dialog");
  await page.keyboard.press("Escape");
  assert.equal(await page.$(".selection-lookup-dialog[open]"), null);
  await route("word-review");
  await page.type("#review-answer", "follow up");
  await page.click(".review-check");
  await page.waitForSelector(".review-verdict");
  await capture("review-result");
  await route("grammar");
  await page.type("#grammar-input", "I suggested him to join.");
  await page.click(".composer-actions .primary");
  await page.waitForSelector(".correction-detail");
  await capture("grammar-result");
  await route("ask");
  await page.type("#ask-input", "Explain the present perfect.");
  await page.click(".ask-composer-actions .primary");
  assert.equal(await page.$eval(".ask-composer-actions .primary", el => el.getAttribute("aria-busy")), "true");
  await page.waitForSelector(".ask-answer");
  await capture("ask-result");
  await page.click(".ask-save-menu > summary");
  await page.click(".ask-save-action button");
  const saving = await page.$eval(".ask-save-action button", el => ({ busy: el.getAttribute("aria-busy"), saved: el.dataset.saved, disabled: el.disabled }));
  assert.deepEqual(saving, { busy: "true", saved: "false", disabled: true });
  await page.waitForSelector('.ask-save-action button[data-saved="true"]');
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.evaluate(() => document.querySelector(".ask-composer-actions .primary").insertAdjacentHTML("afterbegin", '<span class="loading-spinner"></span>'));
  assert.equal(await page.$eval(".loading-spinner", el => getComputedStyle(el).animationName), "none");
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify({ checks, utilityStyles, errors, requests, boundary: "All business APIs intercepted; playback simulated; no live provider or persistence verification." }, null, 2));
  console.log(`UI consistency: ${checks.length} responsive captures passed; keyboard, audio pending/error, copy success/error, save states, selection dialog and reduced motion passed.`);
} finally {
  await browser?.close();
  await server.close();
}
