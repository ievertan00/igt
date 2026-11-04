import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { createServer } from "vite";
import { buildLearningOverview } from "../lib/application/learning-overview.mjs";
import { buildGrammarHistory } from "../lib/application/grammar-history.mjs";
import { buildCoachPatterns } from "../lib/application/grammar-coach.mjs";

// Isolated UI fixtures: every business request is intercepted; no user data is written.
const output = process.env.IGT_UI_ARTIFACT_DIR || path.join(process.cwd(), "artifacts", "ui-demo-refresh");
fs.mkdirSync(output, { recursive: true });
const server = await createServer({ configFile: "apps/web/vite.config.ts", server: { host: "127.0.0.1", port: 0 } });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}), args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [], checks = [], requests = [];
  const pageWidths = new Map();
  page.on("pageerror", error => errors.push(error.message));
  await page.evaluateOnNewDocument(() => {
    // Deterministic playback permits inspection of the pending state without a TTS service.
    HTMLMediaElement.prototype.play = function () {
      setTimeout(() => window.__failAudio ? this.onerror?.(new Event("error")) : this.onended?.(new Event("ended")), window.__failAudio ? 20 : 2500);
      return Promise.resolve();
    };
  });
  const entry = { word: "follow up", pos: "phrasal verb", phonetic: "/ˈfɒləʊ ʌp/", zh: "跟进", meaning: "to act after an earlier event", example: "I will follow up tomorrow.", example2: "Please follow up on the request.", synonyms: "check back", collocations: "follow up on a request" };
  let longLists = false;
  const notes = Array.from({ length: 18 }, (_, index) => ({ id: `UI note ${index}.md`, title: `UI note ${index}`, modifiedAt: "2026-11-02T00:00:00Z", bytes: 100, content: "# A useful explanation\n\nPractise with a sentence from your own experience.", category: "Grammar", tags: ["Writing"] }));
  const historyEntries = Array.from({ length: 3 }, (_, index) => ({ source: "grammar", entryId: `ui-${index}`, timestamp: new Date(Date.now() - index * 86400000).toISOString(), userInput: "I read book.", correction: "I read a book.", diagnoses: [{ error_type: "Articles", severity: "Minor", explanation: "Use an article before a singular countable noun." }] }));
  const events = historyEntries.map(item => ({ id: item.entryId, source: "review-log", type: "grammar", timestamp: item.timestamp, title: item.userInput, href: `#handbook?entry=${item.entryId}` }));
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url()), pathname = url.pathname;
    const json = body => request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (pathname.startsWith("/src/") || pathname.startsWith("/@") || pathname.startsWith("/node_modules/") || pathname === "/" || pathname.startsWith("/assets/")) return request.continue();
    if (url.origin !== new URL(base).origin) return request.abort();
    requests.push(`${request.method()} ${pathname}`);
    if (pathname === "/dashboard") return json(buildLearningOverview(events, {}, { reviewEntries: historyEntries, coverage: [{ source: "Saved writing", status: "available", note: "UI fixture" }] }));
    if (pathname === "/coach") return json(buildCoachPatterns(historyEntries));
    if (pathname === "/settings/llm") return json({ provider: "custom", providers: { custom: { baseUrl: "", models: { flash: "", pro: "" } } }, profiles: [{ id: "current", name: "Current setup", provider: "custom", baseUrl: "https://example.test/v1", models: { flash: "fixture", pro: "fixture" } }], activeProfileId: "current" });
    if (pathname === "/settings/files") return json({ paths: { vocabulary: "", reviewLog: "", askNotesDir: "", handbookReports: "" } });
    if (pathname === "/ask/notes") return json({ directory: "UI fixture", notes: longLists ? notes : [] });
    if (pathname === "/handbook") return json(buildGrammarHistory(historyEntries));
    if (pathname === "/review/due") return json({ cards: [{ id: 101, source_type: "vocab", ...entry, vocab_details: entry }] });
    if (pathname === "/review/check") return json({ correct: true, persistence: { saved: false } });
    if (pathname === "/review/grade") return json({ correct: true, next: { intervalDays: 6 }, persistence: { saved: true } });
    if (pathname === "/vocab/words") return json({ words: longLists ? Array.from({ length: 25 }, (_, index) => ({ ...entry, id: `word-${index}`, word: `follow up ${index}`, learningStatus: "learning" })) : [], sourceAvailable: true, total: longLists ? 25 : 0, totalSaved: longLists ? 25 : 0, offset: 0, limit: 25, hasMore: false, overview: { due: longLists ? 4 : 0, overdue: 0, dueToday: longLists ? 4 : 0, retained: 0, wellRetained: 0, distribution: {} } });
    if (pathname === "/word/lookup") return json({ data: entry });
    if (pathname === "/grammar") return json({ result: { originalText: "I suggested him to join.", correction: "I suggested that he join.", refine: "I suggested he join.", diagnoses: [], remember: "suggest + that clause" }, persistence: { saved: false, requiresConfirmation: true } });
    if (pathname === "/ask") { await new Promise(resolve => setTimeout(resolve, 500)); return json({ data: { answer: "Use a specific example to explain your idea.", related: ["How can I practise this?"] } }); }
    if (pathname === "/ask/save") { await new Promise(resolve => setTimeout(resolve, 500)); return json({ saved: true, turnCount: 1, vaultFile: "UI fixture.md" }); }
    if (pathname === "/tts/speak") return request.respond({ status: 200, contentType: "audio/wav", body: Buffer.alloc(44) });
    return json({});
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  async function capture(name, widths = [1440, 1024, 768, 390, 320]) {
    for (const width of widths) {
      await page.setViewport({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const audit = await page.evaluate(() => {
        const visible = el => el.getClientRects().length > 0;
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          page: { left: document.querySelector('main').getBoundingClientRect().left, width: document.querySelector('main').getBoundingClientRect().width },
          unnamed: [...document.querySelectorAll("button")].filter(visible).filter(el => !el.getAttribute("aria-label") && !el.textContent.trim()).map(el => el.className),
          short: [...document.querySelectorAll("button")].filter(visible).filter(el => el.getBoundingClientRect().height < 43.5).map(el => ({ className: el.className, height: el.getBoundingClientRect().height })),
        };
      });
      assert.equal(audit.overflow, false, `${name}/${width} overflows`);
      if (!pageWidths.has(width)) pageWidths.set(width, audit.page);
      assert.deepEqual(audit.page, pageWidths.get(width), `${name}/${width} uses the shared page width and gutters`);
      const inputPanel = { grammar: '.grammar-composer', translation: '.panel', 'word-lookup': '.panel', ask: '.ask-composer' }[name];
      if (inputPanel) {
        const panel = await page.$eval(inputPanel, el => ({ left: el.getBoundingClientRect().left, width: el.getBoundingClientRect().width }));
        assert.deepEqual(panel, audit.page, `${name}/${width} input panel fills the shared page width`);
      }
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
  for (const name of ["grammar", "translation", "word-lookup", "word-review", "word-library", "practice", "ask", "ask?view=notes", "dashboard", "handbook", "coach", "settings"]) {
    await route(name);
    const focusTarget = { grammar: '#grammar-input', ask: '#ask-input', 'word-lookup': '#word-lookup-input' }[name];
    if (focusTarget) {
      await page.focus(focusTarget);
      await page.keyboard.press('Tab');
      await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
      const focus = await page.$eval(focusTarget, el => {
        const surface = el.closest('.grammar-composer, .ask-composer') || el;
        const style = getComputedStyle(surface);
        return { active: document.activeElement === el, color: style.outlineColor, width: style.outlineWidth, offset: style.outlineOffset,
          innerOutline: surface === el ? 'none' : getComputedStyle(el).outlineStyle };
      });
      assert.deepEqual(focus, { active: true, color: 'rgb(116, 131, 108)', width: '1px', offset: '-1px', innerOutline: 'none' });
    }
    if (name === 'translation') {
      const selected = await page.$eval('.switches button.selected', el => {
        const style = getComputedStyle(el);
        return { border: style.borderColor, background: style.backgroundColor, width: style.borderWidth };
      });
      assert.deepEqual(selected, { border: 'rgb(116, 131, 108)', background: 'rgb(241, 251, 223)', width: '1px' });
    }
    await capture(name.replace('?view=', '-'));
    if (focusTarget) {
      for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
        await page.setViewport(viewport);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} fits small phone and landscape`);
      }
    }
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
  const utilityStyles = await page.$$eval(".icon-button", buttons => buttons.filter(el => el.getClientRects().length > 0).map(el => {
    const style = getComputedStyle(el), rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, radius: style.borderRadius, icon: getComputedStyle(el.querySelector("svg")).width };
  }));
  for (const style of utilityStyles) assert.deepEqual(style, { width: 44, height: 44, radius: "50%", icon: "18px" });
  await page.focus(".audio-btn");
  await page.keyboard.press("Tab");
  await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift");
  assert.equal(await page.$eval(".audio-btn", el => getComputedStyle(el).outlineStyle), "solid");
  assert.equal(await page.$eval(".audio-btn", el => getComputedStyle(el).outlineColor), "rgb(116, 131, 108)");
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
  await page.keyboard.press('Tab');
  await page.focus('.selection-lookup-trigger');
  assert.equal(await page.$eval('.selection-lookup-trigger', el => getComputedStyle(el).outlineColor), 'rgb(116, 131, 108)');
  assert.equal(await page.$eval('.selection-lookup-trigger', el => getComputedStyle(el).outlineStyle), 'solid');
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
  const ratings = await page.$$eval('.review-rating-button', buttons => buttons.map(el => {
    const style = getComputedStyle(el), rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, background: style.backgroundColor, border: style.borderColor, selected: el.getAttribute('aria-pressed') };
  }));
  assert.equal(ratings.length, 4);
  for (const rating of ratings) assert.deepEqual(rating, ratings[0], 'Recall choices have equal weight and none is preselected');
  assert.equal(ratings[0].selected, 'false');
  await capture("review-result");
  await route("grammar");
  await page.type("#grammar-input", "I suggested him to join.");
  await page.click(".composer-actions .primary");
  await page.waitForSelector(".correction-detail");
  await capture("grammar-result");
  await page.setViewport({ width: 1440, height: 1000 });
  await page.hover('.composer-actions .primary');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.composer-actions .primary .icon-arrow')).transform === 'matrix(1, 0, 0, 1, 3, 0)');
  await page.focus('#grammar-input');
  await page.keyboard.press('Tab');
  assert.equal(await page.$eval('.composer-actions .primary', el => getComputedStyle(el).outlineColor), 'rgb(132, 204, 22)');
  assert.equal(await page.$eval('.composer-actions .primary', el => getComputedStyle(el).outlineWidth), '2px');
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
  // Long-list shortcuts must be reachable, stay clear of the last row, and reuse real routes.
  longLists = true;
  for (const name of ['ask?view=notes', 'word-library']) {
    await page.setViewport({ width: 1440, height: 1000 });
    await route(name);
    if (name.startsWith('ask')) {
      await page.click('[aria-label="Refresh saved notes"]');
      await page.waitForFunction(() => document.querySelectorAll('.ask-note-tile').length === 18);
    } else await page.waitForFunction(() => document.querySelector('.vocabulary-overview-metric strong')?.textContent === '25');
    for (const width of [1440, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForFunction(() => !document.querySelector('.floating-action'));
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForSelector('.floating-action');
      // Wait for the entrance animation before checking its hit target.
      await page.waitForFunction(() => document.querySelector('.floating-action').getAnimations().every(animation => animation.playState === 'finished'));
      const fab = await page.$eval('.floating-action', el => {
        const rect = el.getBoundingClientRect();
        return { height: rect.height, fits: rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight, hit: el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)), href: el.getAttribute('href') };
      });
      assert.equal(fab.height, 52); assert.equal(fab.fits, true); assert.equal(fab.hit, true);
      assert.equal(fab.href, name.startsWith('ask') ? '#ask' : '#word-review');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      assert.equal(await page.evaluate(() => {
        const list = document.querySelector('.ask-note-list, .vocabulary-library-list');
        const fabTop = document.querySelector('.floating-action').getBoundingClientRect().top;
        const footerBottom = Math.max(...[...document.querySelector('.site-footer').children].map(el => el.getBoundingClientRect().bottom));
        return list.getBoundingClientRect().bottom <= fabTop && footerBottom + 8 <= fabTop;
      }), true, `${name}/${width}: the shortcut leaves the final row and footer clear`);
      await page.screenshot({ path: path.join(output, `${name.startsWith('ask') ? 'notes' : 'words'}-fab-${width}.png`), fullPage: false });
    }
    if (name.startsWith('ask')) {
      await page.click('.ask-note-link');
      await page.waitForSelector('.ask-note-dialog[open]');
      assert.equal(await page.$('.floating-action'), null, 'Hide background shortcuts in the reader');
      await page.keyboard.press('Escape');
    }
    await page.click('.floating-action');
    await page.waitForFunction(hash => location.hash === hash, {}, name.startsWith('ask') ? '#ask' : '#word-review');
    assert.equal(await page.$('.floating-action'), null, 'Do not carry shortcuts to another route');
  }
  await route('ask');
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.evaluate(() => document.querySelector(".ask-composer-actions .primary").insertAdjacentHTML("afterbegin", '<span class="loading-spinner"></span>'));
  assert.equal(await page.$eval(".loading-spinner", el => getComputedStyle(el).animationName), "none");
  await page.hover('.ask-composer-actions .primary');
  assert.equal(await page.$eval('.ask-composer-actions .primary', el => getComputedStyle(el).transform), 'none');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify({ checks, utilityStyles, errors, requests, boundary: "All business APIs intercepted; playback simulated; no live provider or persistence verification." }, null, 2));
  console.log(`UI consistency: ${checks.length} responsive captures passed; keyboard, audio pending/error, copy success/error, save states, selection dialog, button motion, equal-weight ratings, long-list shortcuts and reduced motion passed.`);
} finally {
  await browser?.close();
  await server.close();
}
