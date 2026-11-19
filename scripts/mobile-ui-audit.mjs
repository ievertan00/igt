// Mobile baseline audit: renders the Web client at phone widths and reports
// horizontal overflow, collapsed-navigation behaviour, topbar geometry, safe-area
// token resolution, and interactive hit areas. Synthetic API payloads only; no
// database, no Local Runtime, no model calls.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";
import { createServer } from "vite";

/* Puppeteer's bundled-browser pin can drift from the browser actually installed in the
   cache, so prefer an explicit path, then the pinned one, then any cached build. */
function resolveChrome() {
  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit && fs.existsSync(explicit)) return explicit;
  try {
    const pinned = puppeteer.executablePath();
    if (pinned && fs.existsSync(pinned)) return pinned;
  } catch { /* fall through to the cache scan */ }
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

const WIDTHS = [320, 360, 390, 430];
/* #word is not a route (it falls back to Grammar); #word-lookup is the lookup page.
   The four My learning sub-pages with the floating-scroll rail are included so their
   narrow-screen layout stays covered by the baseline audit. */
const ROUTES = ["#grammar", "#dashboard", "#word-lookup", "#word-library", "#practice", "#ask", "#ask?view=notes", "#handbook", "#coach"];

const fixtures = {
  "/runtime": { runtime: "local", storage: { database: "sqlite", assets: "markdown" } },
  "/status-message": { content: "" },
  "/dashboard": { days: 30, summary: [], events: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false }, coverage: [], undated: 0, patterns: [] },
  "/dashboard/growth": (() => {
    const metric = { recall: { value: null, correct: 0, n: 0 }, translation: { value: null, n: 0 }, diagnosed: { count: 0, n: 0 } };
    return {
      filters: { start: "2026-10-18", end: "2026-11-17", module: "all", category: "all", errorType: "all", status: "all" },
      taxonomy: {}, asOf: new Date().toISOString(),
      inventory: { words: 0, grammar: 0, notes: 0, reports: 0 },
      metrics: metric, previous: { filters: { start: "2026-10-18", end: "2026-11-16" }, metrics: metric },
      categories: [], errorTypes: [], series: {}, comparisons: { modules: [], types: [] },
      retention: { total: 0, distribution: {}, available: true },
      diagnosis: { patterns: [], recall: metric.recall, writingChecks: 0 },
      priorities: [], recent: [], total: 0, undated: 0, coverage: [],
    };
  })(),
  "/dashboard/records": { records: [], total: 0, offset: 0, limit: 10, hasMore: false },
  "/dashboard/practice-log": { count: 0, markdown: "" },
  "/coach": { days: 90, checks: 0, patterns: [], coverage: {} },
  "/coach/reports": [],
  "/handbook": { days: 90, search: "", errorType: "", diagnosis: "all", coverage: {}, categories: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false }, entries: [] },
  "/handbook/reports": [],
  "/review/due": { cards: [] },
  "/vocab/words": { words: [], total: 0, totalSaved: 0, sourceAvailable: true, limit: 25, offset: 0, hasMore: false, overview: {} },
  "/vocab/history": { records: [], total: 0, offset: 0, hasMore: false },
  "/ask/notes": { notes: [] },
};

const server = await createServer({
  configFile: "apps/web/vite.config.ts",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
  logLevel: "error",
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const executablePath = resolveChrome();
if (!executablePath) throw new Error("No Chrome/Chromium found. Set PUPPETEER_EXECUTABLE_PATH or run npm install to download one.");
const browser = await puppeteer.launch({ headless: true, executablePath, args: ["--no-sandbox"] });

const report = [];
let failures = 0;
try {
  const page = await browser.newPage();
  const pageErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url().slice(0, 110)} ${request.failure()?.errorText ?? ""}`));
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    try {
      const url = new URL(request.url());
      if (url.origin !== base) { await request.abort(); return; }
      const body = fixtures[url.pathname];
      if (body !== undefined) {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      } else if (url.pathname.startsWith("/settings/")) {
        await request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fixture model unavailable" }) });
      } else {
        await request.continue();
      }
    } catch (error) {
      if (!request.isInterceptResolutionHandled()) {
        await request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: error.message }) });
      }
    }
  });

  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    // The first route defines the standard workspace width for this breakpoint.
    let referenceWorkspaceWidth = null;
    for (const route of ROUTES) {
      await page.goto(`${base}/${route}`, { waitUntil: "domcontentloaded" });
      try {
        await page.waitForSelector(".topbar", { timeout: 12000 });
      } catch (error) {
        const diagnostic = await page.evaluate(() => ({
          readyState: document.readyState,
          rootChildren: document.getElementById("root")?.children.length ?? -1,
          bodyText: document.body.innerText.slice(0, 260),
        }));
        report.push({ width, route, renderFailed: error.message, diagnostic, pageErrors: [...pageErrors], failedRequests: [...failedRequests] });
        failures += 1;
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const vw = doc.clientWidth;
        const overflow = doc.scrollWidth - vw;
        const offenders = [];
        if (overflow > 1) {
          for (const el of document.querySelectorAll("body *")) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            const style = getComputedStyle(el);
            if (style.position === "fixed" || style.visibility === "hidden") continue;
            if (rect.right > vw + 1 || rect.left < -1) {
              offenders.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 70), left: Math.round(rect.left), right: Math.round(rect.right) });
            }
          }
        }
        const topbar = document.querySelector(".topbar");
        const iconTargets = [];
        for (const el of document.querySelectorAll(".icon-button, .menu-toggle")) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (getComputedStyle(el).display === "none") continue;
          iconTargets.push({ cls: String(el.className || "").slice(0, 50), w: Math.round(rect.width), h: Math.round(rect.height) });
        }
        const smallTargets = new Map();
        const wcagViolations = [];
        for (const el of document.querySelectorAll("button, a[href], summary, [role='button']")) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none") continue;
          /* WCAG 2.2 SC 2.5.8 (AA): every target is at least 24x24 CSS px. DESIGN.md intentionally
             keeps dense chips at 36-40px and only requires 44px for icon buttons. */
          if (Math.min(rect.width, rect.height) < 24) {
            wcagViolations.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 60), text: (el.textContent || "").trim().slice(0, 40), w: Math.round(rect.width), h: Math.round(rect.height) });
          }
          if (Math.min(rect.width, rect.height) >= 44) continue;
          const key = `${el.tagName.toLowerCase()}.${String(el.className || "").split(" ").filter(Boolean).slice(0, 2).join(".")}`;
          const entry = smallTargets.get(key) || { count: 0, w: Math.round(rect.width), h: Math.round(rect.height) };
          entry.count += 1;
          smallTargets.set(key, entry);
        }
        /* iOS Safari zooms the whole page when a text field under 16px receives focus. Native
           pickers (select, date, checkbox, radio) do not enter text editing and are exempt. */
        const zoomRisks = [];
        for (const el of document.querySelectorAll("input, textarea, select")) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const type = (el.type || "").toLowerCase();
          const isTextEntry = el.tagName === "TEXTAREA" || ["text", "search", "email", "tel", "url", "password", "number", ""].includes(type);
          if (!isTextEntry) continue;
          const fontSize = parseFloat(getComputedStyle(el).fontSize);
          if (fontSize < 16) zoomRisks.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 60), type, fontSize });
        }
        /* My learning must use the same standard gutter as every other page, and floating
           controls must be fixed overlays rather than a reserved side rail. */
        const workspaceEl = document.querySelector("main.workspace");
        const workspaceRect = workspaceEl?.getBoundingClientRect();
        const fabPositions = [...document.querySelectorAll(".page-scroll-controls, .floating-action-dock, .handbook-notes-dock")]
          .map((el) => ({ cls: String(el.className || "").slice(0, 50), position: getComputedStyle(el).position }));
        const rootStyle = getComputedStyle(doc);
        return {
          viewportWidth: vw,
          workspaceWidth: workspaceRect ? Math.round(workspaceRect.width) : null,
          workspaceLeft: workspaceRect ? Math.round(workspaceRect.left) : null,
          workspaceRight: workspaceRect ? Math.round(workspaceRect.right) : null,
          fabPositions,
          overflow,
          offenders: offenders.slice(0, 8),
          topbarHeight: topbar ? Math.round(topbar.getBoundingClientRect().height) : null,
          topbarLeft: topbar ? Math.round(topbar.getBoundingClientRect().left) : null,
          topbarRight: topbar ? Math.round(topbar.getBoundingClientRect().right) : null,
          scrollPaddingTop: rootStyle.scrollPaddingTop,
          safeLeft: rootStyle.getPropertyValue("--safe-left").trim(),
          safeRight: rootStyle.getPropertyValue("--safe-right").trim(),
          safeBottom: rootStyle.getPropertyValue("--safe-bottom").trim(),
          viewportMeta: document.querySelector('meta[name="viewport"]')?.getAttribute("content") || "",
          iconTargets,
          smallTargets: [...smallTargets.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10),
          wcagViolations: wcagViolations.slice(0, 10),
          zoomRisks: zoomRisks.slice(0, 10),
        };
      });

      if (referenceWorkspaceWidth === null && result.workspaceWidth) referenceWorkspaceWidth = result.workspaceWidth;
      const checks = {
        noHorizontalOverflow: result.overflow <= 1,
        workspaceWidthMatchesSite: result.workspaceWidth === referenceWorkspaceWidth,
        fabsAreFixedOverlays: result.fabPositions.every((f) => f.position === "fixed"),
        viewportFitCover: result.viewportMeta.includes("viewport-fit=cover"),
        safeTokensDefined: Boolean(result.safeLeft && result.safeRight && result.safeBottom),
        topbarFullBleed: result.topbarLeft === 0 && result.topbarRight === result.viewportWidth,
        iconTargetsLargeEnough: result.iconTargets.every((t) => t.w >= 44 && t.h >= 44),
        wcagTargetSizeMinimum: result.wcagViolations.length === 0,
        noIosZoomRisk: result.zoomRisks.length === 0,
      };
      const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
      if (failed.length) failures += 1;
      report.push({ width, route, ...result, checks, failed });

      // Collapsed navigation must open, expose every destination, and close again.
      if (route === "#grammar") {
        const before = await page.evaluate(() => {
          const toggle = document.querySelector(".menu-toggle");
          if (!toggle || getComputedStyle(toggle).display === "none") return { applicable: false };
          toggle.click();
          return { applicable: true };
        });
        let nav = before;
        if (before.applicable) {
          // React state is asynchronous; measure only after the open class lands.
          await page.waitForFunction(() => document.querySelector(".top-nav")?.classList.contains("is-open"), { timeout: 3000 }).catch(() => {});
          nav = await page.evaluate(() => {
            const open = document.querySelector(".top-nav");
            const links = [...document.querySelectorAll(".top-nav a, .top-nav summary")];
            const rects = links.map((el) => el.getBoundingClientRect().height);
            const toggle = document.querySelector(".menu-toggle");
            return {
              applicable: true, isOpen: open?.classList.contains("is-open"), linkCount: links.length,
              visible: rects.filter((h) => h > 0).length,
              minHeight: Math.round(Math.min(...rects)), expanded: toggle?.getAttribute("aria-expanded"),
            };
          });
          await page.evaluate(() => document.querySelector(".menu-toggle")?.click());
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
        const navChecks = {
          togglesOpen: nav.applicable ? nav.isOpen === true : true,
          allDestinationsVisible: nav.applicable ? nav.visible === nav.linkCount : true,
          destinationsTallEnough: nav.applicable ? nav.minHeight >= 44 : true,
          ariaExpanded: nav.applicable ? nav.expanded === "true" : true,
        };
        const navFailed = Object.entries(navChecks).filter(([, ok]) => !ok).map(([name]) => name);
        if (navFailed.length) failures += 1;
        report.push({ width, route: "#grammar:menu", nav, navChecks, navFailed });
      }
    }
  }

  // Simulate a notched device: the centralised tokens must resolve to real insets,
  // the topbar must stay full-bleed, and its content plus the workspace must clear the notch.
  await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  let safeArea, safeAreaPassed = true;
  try {
    const cdp = await page.createCDPSession();
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, left: 44, right: 44, bottom: 34 } });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".topbar", { timeout: 12000 });
    safeArea = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const topbar = document.querySelector(".topbar");
      const barStyle = getComputedStyle(topbar);
      return {
        safeLeft: root.getPropertyValue("--safe-left").trim(),
        safeRight: root.getPropertyValue("--safe-right").trim(),
        safeBottom: root.getPropertyValue("--safe-bottom").trim(),
        topbarLeft: Math.round(topbar.getBoundingClientRect().left),
        topbarRight: Math.round(topbar.getBoundingClientRect().right),
        topbarPaddingLeft: barStyle.paddingLeft,
        topbarPaddingRight: barStyle.paddingRight,
        brandLeft: Math.round(document.querySelector(".brand").getBoundingClientRect().left),
        workspaceLeft: Math.round(document.querySelector(".workspace").getBoundingClientRect().left),
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    safeAreaPassed = safeArea.safeLeft === "44px" && safeArea.safeRight === "44px" && safeArea.safeBottom === "34px"
      && safeArea.topbarLeft === 0 && safeArea.topbarRight === safeArea.viewportWidth
      && safeArea.brandLeft >= 44 && safeArea.workspaceLeft >= 44;
    if (!safeAreaPassed) failures += 1;
  } catch (error) {
    safeArea = { supported: false, error: error.message };
  }
  report.push({ safeArea, safeAreaPassed });
  report.push({ pageErrors, failedRequests });
} finally {
  await browser.close();
  await server.close();
}

console.log(JSON.stringify(report, null, 2));
const overflowEntries = report.filter((r) => r.route && !r.nav && r.overflow > 1);
const errorCount = report.at(-1)?.pageErrors?.length ?? 0;
console.log(`\nSummary: ${WIDTHS.length * ROUTES.length} renders, ${overflowEntries.length} with horizontal overflow, ${failures} with failed baseline checks, ${errorCount} page errors.`);
if (failures || errorCount) process.exitCode = 1;
