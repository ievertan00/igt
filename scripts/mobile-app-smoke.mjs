// ClearWrite Mobile acceptance smoke.
//
// Two independent layers:
//   1. Local Runtime static hosting: /mobile/ must resolve to the standalone
//      mobile build (and never to the desktop SPA fallback).
//   2. Rendered UI at phone widths: no horizontal overflow, touch-target sizes,
//      safe-area/IME handling, system dark mode, navigation/back, draft
//      persistence and the Android share bridge.
//
// Synthetic API payloads only. No database, no model calls, no Local Runtime.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";
import { createServer } from "vite";
import { serveStatic } from "../lib/server/static.mjs";

function response() {
  return {
    status: null, headers: {}, body: "",
    writeHead(status, headers) { this.status = status; this.headers = headers || {}; },
    end(body) { this.body = body?.toString() || ""; },
  };
}

function staticHostingChecks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "igt-mobile-static-"));
  const mobile = path.join(dir, "mobile");
  const web = path.join(dir, "web");
  fs.mkdirSync(path.join(mobile, "assets"), { recursive: true });
  fs.mkdirSync(web, { recursive: true });
  fs.writeFileSync(path.join(mobile, "index.html"), "<!doctype html><title>ClearWrite Mobile</title><div id=root></div>");
  fs.writeFileSync(path.join(mobile, "assets", "app.js"), "window.__mobileAsset = true;");
  fs.writeFileSync(path.join(web, "index.html"), "<!doctype html><title>ClearWrite Desktop</title>");
  try {
    const index = response();
    assert.equal(serveStatic({ method: "GET", url: "/mobile/" }, index, { mobileRoot: mobile }), true);
    assert.equal(index.status, 200);
    assert.match(index.body, /ClearWrite Mobile/);
    assert.match(index.headers["Content-Type"], /text\/html/);

    const asset = response();
    assert.equal(serveStatic({ method: "GET", url: "/mobile/assets/app.js" }, asset, { mobileRoot: mobile }), true);
    assert.equal(asset.status, 200);
    assert.match(asset.body, /__mobileAsset/);
    assert.match(asset.headers["Content-Type"], /text\/javascript/);

    const fallback = response();
    assert.equal(serveStatic({ method: "GET", url: "/mobile/review/deep/link" }, fallback, { mobileRoot: mobile }), true);
    assert.match(fallback.body, /ClearWrite Mobile/, "mobile SPA fallback must not serve the desktop index");

    const desktop = response();
    assert.equal(serveStatic({ method: "GET", url: "/" }, desktop, { root: web, mobileRoot: mobile }), true);
    assert.match(desktop.body, /ClearWrite Desktop/);

    const api = response();
    assert.equal(serveStatic({ method: "GET", url: "/dashboard" }, api, { root: web, mobileRoot: mobile }), false);

    const traversal = response();
    assert.equal(serveStatic({ method: "GET", url: "/mobile/../package.json" }, traversal, { mobileRoot: mobile }), true);
    assert.equal(traversal.status, 404);
    return { staticHosting: "ok", checks: 6 };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const metric = { recall: { value: null, correct: 0, n: 0 }, translation: { value: null, n: 0 }, diagnosed: { count: 0, n: 0 } };
const pagination = { total: 0, limit: 10, offset: 0, hasMore: false };
const FIXTURES = {
  "/runtime": { runtime: "local", storage: { database: "sqlite", assets: "markdown" } },
  "/status-message": { content: "" },
  "/dashboard": { days: 30, summary: [], events: [], pagination, coverage: [], undated: 0, patterns: [], effort: { daily: [] } },
  "/dashboard/growth": {
    filters: { start: "", end: "", module: "all", category: "all", errorType: "all", status: "all" },
    taxonomy: {}, asOf: new Date().toISOString(),
    inventory: { words: 0, grammar: 0, notes: 0, reports: 0 },
    metrics: metric, previous: { filters: {}, metrics: metric },
    categories: [], errorTypes: [], series: {}, comparisons: { modules: [], types: [] },
    retention: { total: 0, distribution: {}, available: true },
    diagnosis: { patterns: [], recall: metric.recall, writingChecks: 0 },
    priorities: [], recent: [], total: 0, undated: 0, coverage: [],
  },
  "/dashboard/records": { records: [], total: 0, offset: 0, limit: 10, hasMore: false },
  "/dashboard/record": { record: null, history: [] },
  "/dashboard/practice-log": { count: 0, markdown: "" },
  "/review/due": { cards: [] },
  "/review/check": { correct: true, answer: "", request_id: "fixture" },
  "/review/grade": { ok: true, next_due: "" },
  "/vocab/seed": { ok: true },
  "/vocab/words": { words: [], total: 0, totalSaved: 0, sourceAvailable: true, limit: 20, offset: 0, hasMore: false, overview: {} },
  "/vocab/history": { records: [], total: 0, offset: 0, hasMore: false },
  "/word/lookup": { word: "follow up on", phonetic: "", definitions: [], examples: [], translations: [], phrases: [] },
  "/word/add": { ok: true },
  "/ask/notes": { notes: [] },
  "/ask/notes/read": { notes: [], content: "" },
  "/ask/notes/delete": { ok: true },
  "/ask": { answer: "Fixture answer", question: "" },
  "/ask/save": { ok: true },
  "/grammar": {
    result: {
      originalText: "She go to work by train every day.",
      correction: "She goes to work by train every day.",
      refine: "She takes the train to work every day.",
      diagnoses: [{ error_type: "Subject–verb agreement", explanation: "Use goes with she in the present simple." }],
    },
    persistence: { saved: false, requiresConfirmation: true },
  },
  "/grammar/save": { persistence: { saved: true } },
  "/translation": { translation: "She takes the train to work every day.", notes: "" },
  "/practice/generate": { questions: [] },
  "/practice/evaluate": { score: 0, verdict: "", corrected_answer: "", feedback_zh: "", strengths_zh: [], improvements_zh: [], reference_answer: "" },
  "/handbook": { days: 90, search: "", errorType: "", diagnosis: "all", coverage: {}, categories: [], pagination, entries: [] },
  "/handbook/reports": [],
  "/handbook/rule": { ok: true },
  "/coach": { days: 90, checks: 0, patterns: [], coverage: {} },
  "/coach/reports": [],
  "/coach/explain": { explanation: "" },
  "/coach/report": { markdown: "" },
  "/settings/llm": { profiles: [], defaultProfile: "" },
  "/settings/files": { vocabulary: "", corrections: "", notes: "", practiceLog: "", reports: "" },
  "/settings/llm/test": { ok: true },
};

// Optional --screenshots=DIR writes real browser captures for visual review.
const screenshotArg = process.argv.find((arg) => arg.startsWith("--screenshots="));
const screenshotDir = screenshotArg ? path.resolve(process.cwd(), screenshotArg.slice("--screenshots=".length)) : null;

const WIDTHS = [320, 360, 390, 430];
const ROUTES = [
  "/home", "/write", "/words", "/practice", "/ask", "/review",
  "/me", "/me/overview", "/me/handbook", "/me/coach", "/me/notes", "/settings",
];
const IMMERSIVE = new Set(["/ask", "/review"]);

function resolveChrome() {
  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit && fs.existsSync(explicit)) return explicit;
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 3 || !fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && /^(chrome\.exe|chrome|headless_shell|chrome-headless-shell\.exe)$/.test(entry.name)) found.push(full);
      else if (entry.isDirectory()) walk(full, depth + 1);
    }
  };
  walk(path.join(os.homedir(), ".cache", "puppeteer"), 0);
  return found.sort().at(-1);
}

async function attachFixtures(page, origin) {
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    try {
      const url = new URL(request.url());
      if (url.origin !== origin) { await request.abort(); return; }
      // With base "/mobile/" every app asset is under that prefix; everything
      // else on this origin is a Local Runtime endpoint and gets a fixture.
      if (url.pathname.startsWith("/mobile/")) { await request.continue(); return; }
      const body = FIXTURES[url.pathname] ?? { ok: true };
      await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    } catch (error) {
      if (!request.isInterceptResolutionHandled()) {
        await request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: error.message }) });
      }
    }
  });
}

const hosting = staticHostingChecks();
const executablePath = resolveChrome();
if (!executablePath) throw new Error("No Chrome/Chromium found. Set PUPPETEER_EXECUTABLE_PATH or install a Puppeteer browser.");

const server = await createServer({
  configFile: "apps/mobile/vite.config.ts",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
  logLevel: "error",
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const base = `${origin}/mobile/`;
const browser = await puppeteer.launch({ headless: true, executablePath, args: ["--no-sandbox"] });

const failures = [];
const pageErrors = [];
let renders = 0;
let darkMode = null;
let interactions = null;

try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await attachFixtures(page, origin);

  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    for (const route of ROUTES) {
      await page.goto(`${base}#${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".app .screen", { timeout: 15000 });
      await page.waitForFunction((hash) => location.hash === hash, { timeout: 5000 }, `#${route}`);
      await new Promise((resolve) => setTimeout(resolve, 90));
      renders += 1;
      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const vw = doc.clientWidth;
        const overflow = doc.scrollWidth - vw;
        const offenders = [];
        if (overflow > 1) {
          for (const el of document.querySelectorAll("body *")) {
            const rect = el.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;
            const style = getComputedStyle(el);
            if (style.position === "fixed" || style.visibility === "hidden" || style.display === "none") continue;
            if (rect.right <= vw + 1 && rect.left >= -1) continue;
            let parent = el.parentElement;
            let scrollable = false;
            while (parent && parent !== document.body) {
              if (/(auto|scroll)/.test(getComputedStyle(parent).overflowX)) { scrollable = true; break; }
              parent = parent.parentElement;
            }
            if (scrollable) continue;
            offenders.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 60), left: Math.round(rect.left), right: Math.round(rect.right) });
          }
        }
        const nav = document.querySelector(".bottom-nav");
        const navItems = [...document.querySelectorAll(".bottom-nav .nav-item")].map((el) => {
          const rect = el.getBoundingClientRect();
          return { w: Math.round(rect.width), h: Math.round(rect.height), current: el.getAttribute("aria-current") };
        });
        const smallTargets = [];
        const zoomRisks = [];
        for (const el of document.querySelectorAll("button, a[href], [role='button'], summary, input, select, textarea")) {
          const rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none") continue;
          if (Math.min(rect.width, rect.height) < 24) {
            smallTargets.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 60), w: Math.round(rect.width), h: Math.round(rect.height) });
          }
        }
        for (const el of document.querySelectorAll("input, textarea, select")) {
          const rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          const type = (el.type || "").toLowerCase();
          const textEntry = el.tagName === "TEXTAREA" || ["text", "search", "email", "tel", "url", "password", "number", ""].includes(type);
          if (textEntry && parseFloat(getComputedStyle(el).fontSize) < 16) zoomRisks.push({ tag: el.tagName.toLowerCase(), fontSize: getComputedStyle(el).fontSize });
        }
        return {
          vw, overflow, offenders: offenders.slice(0, 6), navItems,
          navPointerEvents: nav ? getComputedStyle(nav).pointerEvents : null,
          immersive: document.querySelector(".app")?.classList.contains("app--no-nav") || false,
          viewportMeta: document.querySelector('meta[name="viewport"]')?.getAttribute("content") || "",
          smallTargets: smallTargets.slice(0, 6), zoomRisks: zoomRisks.slice(0, 6),
          activeNav: navItems.findIndex((item) => item.current === "page"),
        };
      });
      const checks = {
        noHorizontalOverflow: result.overflow <= 1,
        fiveNavigationTargets: result.navItems.length === 5,
        navigationTargetsLargeEnough: result.navItems.every((item) => item.w >= 44 && item.h >= 44),
        wcagTargetMinimum: result.smallTargets.length === 0,
        noIosZoomRisk: result.zoomRisks.length === 0,
        viewportFitCover: result.viewportMeta.includes("viewport-fit=cover"),
        immersiveHidesNav: IMMERSIVE.has(route) ? result.immersive && result.navPointerEvents === "none" : !result.immersive,
      };
      const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
      if (failed.length) failures.push({ width, route, failed, overflow: result.overflow, offenders: result.offenders, smallTargets: result.smallTargets, zoomRisks: result.zoomRisks });
    }
  }

  // ---- single-width behaviour checks on a freshly loaded document ----
  await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(`${origin}/mobile/?smoke=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app .screen", { timeout: 15000 });
  await page.waitForFunction(() => typeof window.__igtInsets === "function" && typeof window.__igtTheme === "function", { timeout: 5000 });

  // The layout is independent, but the palette must stay aligned with the
  // desktop ClearWrite tokens (DESIGN.md §2 / apps/web/src/visual-system.css).
  const lightPalette = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const read = (name) => root.getPropertyValue(name).trim();
    return {
      canvas: read("--canvas"), surface: read("--surface"), ink: read("--ink"),
      line: read("--line"), primary: read("--primary"), brand: read("--brand"),
      brandInk: read("--brand-ink"), primarySoft: read("--primary-soft"),
      successSoft: read("--success-soft"), danger: read("--danger"),
    };
  });
  assert.deepEqual(lightPalette, {
    canvas: "#F6F8FB", surface: "#FFFFFF", ink: "#101827",
    line: "#E5ECF4", primary: "#101827", brand: "#2FBE63",
    brandInk: "#0E7C46", primarySoft: "#EDFBF2",
    successSoft: "#ECFDF5", danger: "#B91C1C",
  }, "mobile palette drifted from the ClearWrite web tokens");

  // System dark mode is applied by the native shell callback, not by a CSS
  // media query alone, so the shell stays authoritative on Android.
  await page.evaluate(() => window.__igtTheme("dark"));
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark", { timeout: 3000 });
  // Buttons animate `background` for .16s; sample after the transition settles.
  await new Promise((resolve) => setTimeout(resolve, 260));
  darkMode = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const hero = document.querySelector(".card--hero");
    const heroButton = document.querySelector(".card--hero .btn--secondary");
    return {
      theme: document.documentElement.getAttribute("data-theme"),
      canvas: root.getPropertyValue("--canvas").trim(),
      ink: root.getPropertyValue("--ink").trim(),
      primary: root.getPropertyValue("--primary").trim(),
      brand: root.getPropertyValue("--brand").trim(),
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
      heroInk: hero ? getComputedStyle(hero).color : null,
      heroBackground: hero ? getComputedStyle(hero).backgroundImage : null,
      heroButton: heroButton ? getComputedStyle(heroButton).backgroundColor : null,
    };
  });
  assert.equal(darkMode.theme, "dark");
  assert.equal(darkMode.canvas, "#0F1626");
  assert.equal(darkMode.ink, "#F6F8FB");
  assert.equal(darkMode.themeColor, "#0F1626");
  // Night mode is derived from the same slate / brand-green hues. Hero cards
  // stay a dark green with light text and a contrasting light action button.
  assert.equal(darkMode.primary, "#2FBE63");
  assert.equal(darkMode.brand, "#4ADE80");
  assert.equal(darkMode.heroInk, "rgb(246, 248, 251)");
  assert.match(darkMode.heroBackground, /rgb\(14, 90, 51\)/);
  assert.equal(darkMode.heroButton, "rgb(246, 248, 251)");
  await page.evaluate(() => window.__igtTheme("light"));
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light", { timeout: 3000 });

  // Safe-area insets and the soft keyboard are owned by the native shell.
  await page.evaluate(() => window.__igtInsets(24, 0, 18, 0));
  const insetTop = await page.evaluate(() => document.documentElement.style.getPropertyValue("--inset-top"));
  assert.equal(insetTop, "24px");
  await page.evaluate(() => document.documentElement.setAttribute("data-igt-ime", "true"));
  const imeHidden = await page.evaluate(() => getComputedStyle(document.querySelector(".bottom-nav")).pointerEvents);
  assert.equal(imeHidden, "none");
  await page.evaluate(() => document.documentElement.setAttribute("data-igt-ime", "false"));
  const imeVisible = await page.evaluate(() => getComputedStyle(document.querySelector(".bottom-nav")).pointerEvents);
  assert.equal(imeVisible, "auto");

  // Bottom navigation + Android back handling.
  await page.evaluate(() => location.hash = "#/home");
  await page.waitForFunction(() => location.hash === "#/home", { timeout: 3000 });
  await page.evaluate(() => document.querySelectorAll(".bottom-nav .nav-item")[3].click());
  await page.waitForFunction(() => location.hash === "#/words", { timeout: 3000 });
  const active = await page.$eval(".bottom-nav .nav-item[aria-current='page']", (el) => el.textContent.trim());
  assert.ok(active.length > 0, "active destination must be marked for screen readers");
  const backResult = await page.evaluate(() => ({ handled: window.__igtBack(), hash: location.hash }));
  assert.equal(backResult.handled, true);
  assert.equal(backResult.hash, "#/home");

  // Drafts survive a WebView reload; shared text from another app lands in the composer.
  await page.evaluate(() => location.hash = "#/write");
  await page.waitForSelector("textarea.field-textarea", { timeout: 5000 });
  await page.type("textarea.field-textarea", "Draft survives a reload");
  const persisted = await page.evaluate(() => localStorage.getItem("igt.mobile.draft.write") || "");
  assert.match(persisted, /Draft survives a reload/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("textarea.field-textarea", { timeout: 10000 });
  const restored = await page.$eval("textarea.field-textarea", (el) => el.value);
  assert.match(restored, /Draft survives a reload/);

  await page.evaluate(() => { location.hash = "#/home"; });
  await page.waitForFunction(() => location.hash === "#/home", { timeout: 3000 });
  await page.waitForFunction(() => typeof window.__igtShared === "function", { timeout: 5000 });
  await page.evaluate(() => window.__igtShared("Shared from Android"));
  await page.waitForFunction(() => location.hash === "#/write", { timeout: 5000 });
  await page.waitForSelector("textarea.field-textarea", { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector("textarea.field-textarea")?.value === "Shared from Android", { timeout: 5000 });

  interactions = {
    darkMode: darkMode.theme, insetTop, imeHidden, imeVisible,
    backHandled: backResult.handled, draftRestored: true, shareIntake: true,
  };

  // Real browser captures at a representative phone size. Purely additive:
  // without --screenshots this smoke test only performs assertions.
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    const shot = async (name) => {
      await new Promise((resolve) => setTimeout(resolve, 240));
      await page.screenshot({ path: path.join(screenshotDir, `${name}.png`) });
    };
    const open = async (route) => {
      await page.goto(`${base}#${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction((hash) => location.hash === hash, { timeout: 5000 }, `#${route}`);
      await page.waitForSelector(".app .screen", { timeout: 5000 });
    };

    await page.evaluate(() => window.__igtTheme?.("light"));
    await open("/home");
    await shot("01-today-light");
    await page.evaluate(() => window.__igtTheme?.("dark"));
    await shot("02-today-dark");
    await page.evaluate(() => window.__igtTheme?.("light"));

    await open("/write");
    await page.waitForSelector("textarea.field-textarea", { timeout: 5000 });
    await page.click("textarea.field-textarea");
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.type("She go to work by train every day.");
    await page.click(".dock-actions .btn--primary");
    await page.waitForSelector(".result-text--strong", { timeout: 8000 });
    await shot("03-writing-result");

    await open("/words");
    await shot("04-vocabulary");
    await open("/practice");
    await shot("05-practice");
    await open("/me");
    await shot("06-my-learning");
    await open("/ask");
    await shot("07-ask-immersive");
    interactions.screenshots = screenshotDir;
  }
} finally {
  await browser.close();
  await server.close();
}

const report = { hosting, renders, widths: WIDTHS, routes: ROUTES.length, darkMode, interactions, pageErrors, failures };
console.log(JSON.stringify(report, null, 2));
console.log(`\nMobile app smoke: ${renders} renders, ${failures.length} failed layout checks, ${pageErrors.length} page errors.`);
if (failures.length || pageErrors.length) process.exitCode = 1;
