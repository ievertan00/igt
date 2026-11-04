import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { preview } from "vite";
import { ConfigLoader } from "../lib/shared/config-loader.mjs";
import { registerLlmSettingsRoutes } from "../lib/server/routes/llm-settings.mjs";
import { dispatch } from "../lib/server/router.mjs";
import { initializeLLMProviders } from "../lib/server/llm/init.mjs";

const output = path.join(process.cwd(), ".cache", "model-settings-ui");
fs.mkdirSync(output, { recursive: true });
const root = fs.mkdtempSync(path.join(output, "fixture-"));
const originalEnv = { ...process.env };
fs.writeFileSync(path.join(root, "igt_config.json"), JSON.stringify({ OllamaFamily: "gemma", GeminiProModel: "unused", QwenProModel: "unused", DeepseekProModel: "unused" }));
fs.writeFileSync(path.join(root, ".env"), "IGT_LLM_PROVIDER=custom\nIGT_CUSTOM_API_BASE=https://example.invalid/v1\nIGT_CUSTOM_FLASH_MODEL=writing-fast\nIGT_CUSTOM_PRO_MODEL=writing-pro\nIGT_CUSTOM_API_KEYS=fixture-secret\n");
process.env.IGT_LLM_PROVIDER = "custom";
const loader = new ConfigLoader(root);
const config = loader.load();
const manager = initializeLLMProviders(config);
registerLlmSettingsRoutes({ config, loader, getLLMManager: async () => manager });
const server = await preview({ configFile: "apps/web/vite.config.ts", preview: { host: "127.0.0.1", port: 0 } });
let browser;
let failSwitch = false;
let delaySwitch;
try {
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  async function selectModel(profileId) {
    await page.click("#workspace-model");
    await page.waitForSelector(".model-menu");
    await page.click(`.model-menu-option[data-profile-id="${profileId}"]`);
  }
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  await page.setRequestInterception(true);
  page.on("request", async request => {
    try {
      const url = new URL(request.url());
      if (url.origin !== base) return request.abort();
      if (url.pathname === "/" || url.pathname.startsWith("/assets/")) return request.continue();
      const json = (data, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(data) });
      if (url.pathname === "/settings/llm") {
        const body = request.postData() || "{}";
        if (JSON.parse(body).action === "activate") {
          if (delaySwitch) await delaySwitch;
          if (failSwitch) return json({ error: { message: "Could not switch models", code: "INTERNAL_ERROR" } }, 500);
        }
        let status = 200;
        let response;
        await dispatch({ method: request.method(), url: url.pathname, on(event, cb) { if (event === "data") cb(body); if (event === "end") cb(); } }, {
          writeHead(code) { status = code; }, end(raw) { response = JSON.parse(raw); },
        });
        return json(response, status);
      }
      const fixtures = {
        "/review/due": { cards: [] },
        "/vocab/words": { words: [], total: 0, totalSaved: 0, sourceAvailable: true, hasMore: false },
        "/coach": { days: 90, checks: 0, patterns: [], coverage: { grammar: 0, excludedOtherSources: 0, unclassified: 0, undated: 0 } },
        "/settings/files": { paths: { vocabulary: "", reviewLog: "", askNotesDir: "", handbookReports: "" } },
        "/coach/reports": [],
        "/practice/generate": { data: { questions: [{ id: "fixture-only", prompt_zh: "我每天练习英语。", reference_answer: "I practise English every day.", difficulty: "standard", context: "home", style: "neutral" }] } },
      };
      return json(fixtures[url.pathname] || {});
    } catch (e) { errors.push(e.message); await request.abort(); }
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${base}/#settings`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#model-profile-name");
  assert.equal(await page.$eval("#model-profile-name", e => e.value), "Current setup");
  assert.equal(await page.$eval("#llm-api-key", e => e.value), "");
  assert.ok(!(await page.content()).includes("fixture-secret"));
  await page.click(".saved-model-controls button");
  for (const [selector, value] of [["#model-profile-name", "Local studio"], ["#llm-endpoint", "http://localhost:1234/v1"], ["#llm-flash-model", "local-fast"], ["#llm-pro-model", "local-pro"]]) await page.type(selector, value);
  await page.click(".llm-form-actions .primary");
  await page.waitForFunction(() => document.querySelector(".settings-status")?.textContent.includes("saved and applied"));
  const localId = await page.$eval("#saved-model-profile", e => e.value);
  assert.ok(localId && localId !== "current");
  assert.equal(await page.$$eval("#saved-model-profile option", es => es.length), 2);
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("#model-profile-name");
  assert.equal(await page.$eval("#saved-model-profile", e => e.value), localId);
  assert.equal(await page.$eval("#llm-api-key", e => e.placeholder), "Enter API key", "new setup retains no other profile's credentials");
  await page.$eval("#llm-flash-model", e => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(e, "local-v2-fast"); e.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.click(".llm-form-actions .primary");
  await page.waitForFunction(() => document.querySelector(".settings-status")?.textContent.includes("saved and applied"));
  const variantId = await page.$eval("#saved-model-profile", e => e.value);
  assert.notEqual(variantId, localId, "saving a new model from an existing configuration must not overwrite it");
  assert.equal(await page.$$eval("#saved-model-profile option", es => es.length), 3);
  await page.select("#saved-model-profile", localId);
  assert.equal(await page.$eval("#llm-flash-model", e => e.value), "local-fast", "previous model remains selectable and unchanged");
  await page.select("#saved-model-profile", "current");
  assert.equal(manager.config.CustomFlashModel, "local-v2-fast", "editing another profile does not activate it");
  assert.equal(await page.$eval("#llm-flash-model", e => e.value), "writing-fast");
  await page.click(".llm-form-actions .model-update");
  await page.waitForFunction(() => document.querySelector(".settings-status")?.textContent.includes("saved and applied"));
  assert.equal(manager.config.CustomFlashModel, "writing-fast");

  await page.goto(`${base}/#grammar`, { waitUntil: "networkidle0" });
  await page.type("#grammar-input", "Keep this unfinished sentence.");
  let release;
  delaySwitch = new Promise(resolve => { release = resolve; });
  await selectModel(localId);
  await page.waitForFunction(() => document.querySelector("#workspace-model").disabled);
  release();
  delaySwitch = undefined;
  await page.waitForFunction(() => !document.querySelector("#workspace-model").disabled);
  assert.equal(await page.$eval("#grammar-input", e => e.value), "Keep this unfinished sentence.");
  assert.equal(config.CustomFlashModel, "local-fast");
  failSwitch = true;
  await selectModel("current");
  await page.waitForSelector(".model-switch-error");
  assert.equal(await page.$eval("#workspace-model", e => e.value), localId, "failed switch retains actual selection");
  assert.equal(config.CustomFlashModel, "local-fast");
  failSwitch = false;
  await page.click(".model-switch-error button");
  await page.waitForFunction(() => !document.querySelector(".model-switch-error"));
  await selectModel("current");
  await page.waitForFunction(() => document.querySelector("#workspace-model").value === "current" && !document.querySelector("#workspace-model").disabled);
  assert.equal(config.CustomFlashModel, "writing-fast");

  await page.focus("#workspace-model");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#workspace-model").value !== "current" && !document.querySelector("#workspace-model").disabled);
  assert.equal(config.CustomFlashModel, "local-fast", "menu supports keyboard switching");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "workspace-model", "focus returns after keyboard switch");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#workspace-model").value === "current" && !document.querySelector("#workspace-model").disabled);

  await page.click("#workspace-model");
  await page.click("h1");
  assert.equal(await page.$(".model-menu"), null, "outside click closes the menu");
  await page.click("#workspace-model");
  await page.keyboard.press("Tab");
  assert.equal(await page.$(".model-menu"), null, "Tab leaves the menu without trapping focus");
  assert.notEqual(await page.evaluate(() => document.activeElement?.id), "workspace-model");
  await page.click("#workspace-model");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#saved-model-profile");
  assert.equal(new URL(page.url()).hash, "#settings", "menu footer opens model settings");

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    for (const route of ["settings", "grammar", "translation", "word-lookup", "word-review", "word-library", "practice", "coach"]) {
      await page.goto(`${base}/#${route}`, { waitUntil: "networkidle0" });
      const hasModel = !["settings", "word-review", "word-library"].includes(route);
      await page.waitForSelector(route === "settings" ? "#saved-model-profile" : hasModel ? "#workspace-model" : "main h1");
      await page.screenshot({ path: path.join(output, `${route}-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route}/${width}: overflow`);
      assert.equal(await page.$(".model-toolbar"), null, "no external model toolbar remains");
      assert.ok(!(await page.$eval("main", e => e.textContent)).includes("Manage models"));
      if (hasModel) {
        assert.equal(await page.$eval("#workspace-model", e => e.value), "current");
        assert.equal(await page.$eval("#workspace-model .model-switcher-name", e => e.textContent), route === "coach" ? "writing-pro" : "writing-fast");
        await page.click("#workspace-model");
        await page.waitForSelector(".model-menu");
        assert.equal(await page.$eval('.model-menu [aria-checked="true"]', e => e.dataset.profileId), "current");
        assert.equal(await page.$eval(".model-menu", e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }), true, `${route}/${width}: menu stays within viewport`);
        await page.screenshot({ path: path.join(output, `${route}-menu-${width}.png`), fullPage: true });
        await page.keyboard.press("Escape");
        assert.equal(await page.$(".model-menu"), null);
        assert.equal(await page.evaluate(() => document.activeElement?.id), "workspace-model");
        if (["grammar", "translation", "word-lookup"].includes(route)) {
          const geometry = await page.$eval("#workspace-model", e => {
            const toolbar = e.closest(".composer-actions, .input-bottom-toolbar");
            const select = e.getBoundingClientRect();
            const button = toolbar.querySelector("button:not(.model-switcher)").getBoundingClientRect();
            return { sameLine: Math.abs((select.top + select.height / 2) - (button.top + button.height / 2)) < 2, before: select.right <= button.left, inside: Boolean(e.closest(".grammar-composer, .express-composer, .lookup-form")) };
          });
          assert.deepEqual(geometry, { sameLine: true, before: true, inside: true }, `${route}/${width}: input toolbar placement`);
        }
      }
    }
  }
  // Verify actual switching in every requested section, including Pro on Coach.
  for (const route of ["grammar", "translation", "word-lookup", "practice", "coach"]) {
    await page.goto(`${base}/#${route}`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.querySelector("#workspace-model") && !document.querySelector("#workspace-model").disabled);
    await selectModel(localId);
    await page.waitForFunction(() => document.querySelector("#workspace-model").value !== "current" && !document.querySelector("#workspace-model").disabled);
    assert.equal(config.CustomFlashModel, "local-fast");
    assert.equal(config.CustomProModel, "local-pro");
    await selectModel("current");
    await page.waitForFunction(() => document.querySelector("#workspace-model").value === "current" && !document.querySelector("#workspace-model").disabled);
  }
  await page.goto(`${base}/#practice`, { waitUntil: "networkidle0" });
  await page.click(".practice-generate");
  await page.waitForSelector("#practice-input");
  await page.type("#practice-input", "I practise English every day.");
  await selectModel(localId);
  await page.waitForFunction(() => document.querySelector("#workspace-model").value !== "current" && !document.querySelector("#workspace-model").disabled);
  assert.equal(await page.$eval("#practice-input", e => e.value), "I practise English every day.");
  assert.equal(await page.$eval("#workspace-model", e => Boolean(e.closest(".practice-input-composer .input-bottom-toolbar"))), true);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `practice question/${width}: overflow`);
    await page.screenshot({ path: path.join(output, `practice-question-${width}.png`), fullPage: true });
  }
  await page.goto(`${base}/#settings`, { waitUntil: "networkidle0" });
  await page.evaluate(() => { localStorage.setItem("clearwrite.learner-language", "zh-CN"); });
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(await page.$eval("h1", e => e.textContent), "模型设置");
  assert.equal(await page.$eval("#settings-tab-models", e => e.textContent.trim()), "模型设置");
  assert.deepEqual(errors, []);
  console.log(`Model Settings browser checks passed: save/reload/edit, masked credentials, pending/failed switches, preserved writing input, all requested sections and five viewport widths. Screenshots: ${output}`);
} finally {
  await browser?.close();
  await server.close();
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
}
