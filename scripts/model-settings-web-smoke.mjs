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
const aiRequests = [];
let settingsWrites = 0;
try {
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.on("dialog", dialog => dialog.accept());
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
        if (request.method() === "POST") settingsWrites++;
        let status = 200;
        let response;
        await dispatch({ method: request.method(), url: url.pathname, on(event, cb) { if (event === "data") cb(body); if (event === "end") cb(); } }, {
          writeHead(code) { status = code; }, end(raw) { response = JSON.parse(raw); },
        });
        return json(response, status);
      }
      const fixtures = {
        "/ask": { data: { question: "Why?", answer: "A useful explanation.", title: "A useful explanation", related: [], tags: [] } },
        "/ask/notes": { notes: [] },
        "/grammar": { result: { originalText: "Keep this unfinished sentence.", correction: "Keep this unfinished sentence.", diagnoses: [], refine: "Keep this sentence." } },
        "/review/due": { cards: [] },
        "/vocab/words": { words: [], total: 0, totalSaved: 0, sourceAvailable: true, hasMore: false },
        "/coach": { days: 90, checks: 0, patterns: [], coverage: { grammar: 0, excludedOtherSources: 0, unclassified: 0, undated: 0 } },
        "/settings/files": { paths: { vocabulary: "", reviewLog: "", askNotesDir: "", handbookReports: "" } },
        "/coach/reports": [],
        "/practice/generate": { data: { questions: [{ id: "fixture-only", prompt_zh: "我每天练习英语。", reference_answer: "I practise English every day.", difficulty: "standard", context: "home", style: "neutral" }] } },
      };
      if (["/ask", "/grammar", "/practice/evaluate"].includes(url.pathname)) aiRequests.push({ path: url.pathname, profileId: request.headers()["x-igt-model-profile"] });
      return json(fixtures[url.pathname] || {});
    } catch (e) { errors.push(e.message); await request.abort(); }
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${base}/#settings`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".model-card");
  assert.equal(await page.$$eval(".model-card", es => es.length), 1, "fresh settings shows only the live current setup card");
  assert.equal(await page.$eval(".model-card-title", e => e.childNodes[0].textContent.trim()), "Current setup", "card title is the profile name, default badge lives next to it");
  assert.equal(await page.$eval("#add-model-name", e => e.value), "");
  assert.equal(await page.$eval("#add-model-key", e => e.value), "");
  assert.ok(!(await page.content()).includes("fixture-secret"));
  // Add a new single-model configuration through the inline form.
  await page.type("#add-model-name", "Local studio");
  await page.type("#add-model-id", "local-fast");
  await page.type("#add-model-base-url", "http://localhost:1234/v1");
  await page.click(".model-add-actions .primary");
  await page.waitForFunction(() => document.querySelector(".settings-status")?.textContent.includes("saved and applied"));
  const localId = await page.$eval(".model-card.is-active", e => e.dataset.profileId);
  assert.ok(localId && localId !== "current");
  assert.equal(await page.$$eval(".model-card", es => es.length), 2);
  assert.equal(manager.config.CustomFlashModel, "local-fast", "saving applies the new single model");
  assert.equal(manager.config.CustomProModel, "local-fast", "single model mirror fills the pro slot");
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".model-card");
  assert.equal(await page.$eval(".model-card.is-active", e => e.dataset.profileId), localId, "saved model stays active after reload");
  assert.equal(await page.$eval("#add-model-key", e => e.placeholder), "Enter API key", "new setup retains no other profile's credentials");
  // Saving another model must not overwrite the first configuration.
  await page.type("#add-model-name", "Local studio variant");
  await page.type("#add-model-id", "local-v2-fast");
  await page.type("#add-model-base-url", "http://localhost:1234/v1");
  await page.click(".model-add-actions .primary");
  await page.waitForFunction(() => document.querySelector(".settings-status")?.textContent.includes("saved and applied"));
  const variantId = await page.$eval(".model-card.is-active", e => e.dataset.profileId);
  assert.notEqual(variantId, localId, "saving a new model from an existing configuration must not overwrite it");
  assert.equal(await page.$$eval(".model-card", es => es.length), 3);
  // Editing another card keeps its model and does not switch the active setup.
  await page.click(`.model-card[data-profile-id="${localId}"] .model-card-actions .secondary`);
  await page.waitForSelector("#edit-model-id");
  assert.equal(await page.$eval("#edit-model-id", e => e.value), "local-fast", "previous model remains selectable and unchanged");
  await page.click("#edit-model-cancel");
  await page.waitForFunction(() => !document.querySelector(".model-edit-dialog"));
  // Re-edit the base current card and make it the default again. Editing without
  // the default checkbox must not activate the card.
  await page.click(`.model-card[data-profile-id="current"] .model-card-actions .secondary`);
  await page.waitForSelector("#edit-model-id");
  assert.equal(await page.$eval("#edit-model-id", e => e.value), "writing-fast");
  assert.equal(await page.$eval("#edit-model-default", e => e.checked), false, "editing a non-default model does not activate it");
  await page.click("#edit-model-default");
  await page.click("#edit-model-save");
  await page.waitForFunction(() => document.querySelector(".settings-status")?.textContent.includes("saved and applied"));
  assert.equal(await page.$eval(".model-card.is-active", e => e.dataset.profileId), "current", "setting the default re-activates the base setup");
  assert.equal(manager.config.CustomFlashModel, "writing-fast");
  // Delete the variant from the pool; the active card survives.
  await page.click(`.model-card[data-profile-id="${variantId}"] .model-card-delete`);
  await page.waitForSelector(".handbook-delete-confirm");
  await page.click(".handbook-delete-confirm .handbook-delete-submit");
  await page.waitForFunction(() => document.querySelectorAll(".model-card").length === 2 && !document.querySelector(".handbook-delete-confirm"));

  await page.goto(`${base}/#grammar`, { waitUntil: "networkidle0" });
  await page.type("#grammar-input", "Keep this unfinished sentence.");
  const writesBeforeSwitch = settingsWrites;
  await selectModel(localId);
  await page.waitForFunction(id => document.querySelector("#workspace-model").value === id, {}, localId);
  assert.equal(await page.$eval("#grammar-input", e => e.value), "Keep this unfinished sentence.");
  assert.equal(config.CustomFlashModel, "writing-fast", "page choice leaves the runtime default unchanged");
  await page.click(".grammar-composer .primary");
  await page.waitForFunction(() => document.querySelector(".grammar-page.has-result"));
  assert.equal(aiRequests.at(-1).profileId, localId);
  await page.goto(`${base}/#ask`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#ask-input");
  assert.equal(await page.$eval("#workspace-model", e => e.value), "current", "Ask is independent of Writing");
  assert.equal(await page.$eval("#workspace-model", e => Boolean(e.closest(".ask-composer-actions"))), true);
  await page.type("#ask-input", "Why?");
  await selectModel(localId);
  assert.equal(await page.$eval("#ask-input", e => e.value), "Why?");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#workspace-model") && !document.querySelector("#workspace-model").disabled);
  assert.equal(await page.$eval("#workspace-model", e => e.value), localId, "Ask choice persists across reload");
  await selectModel("current");
  await page.type("#ask-input", "Why?");
  await page.click(".ask-submit-actions .primary");
  await page.waitForSelector(".ask-answer");
  assert.equal(aiRequests.at(-1).profileId, "current", "Ask sends its own choice to the API");
  await page.goto(`${base}/#grammar`, { waitUntil: "networkidle0" });
  assert.equal(await page.$eval("#workspace-model", e => e.value), localId, "changing Ask leaves Writing unchanged");
  await selectModel("current");
  await page.waitForFunction(() => document.querySelector("#workspace-model").value === "current" && !document.querySelector("#workspace-model").disabled);
  assert.equal(config.CustomFlashModel, "writing-fast");

  await page.focus("#workspace-model");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#workspace-model").value !== "current" && !document.querySelector("#workspace-model").disabled);
  assert.equal(await page.$eval("#workspace-model", e => e.value), localId, "menu supports keyboard switching");
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
  await page.waitForSelector("#add-model-name");
  assert.equal(new URL(page.url()).hash, "#settings", "menu footer opens model settings");

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    for (const route of ["settings", "grammar", "translation", "word-lookup", "word-review", "word-library", "practice", "coach", "ask"]) {
      await page.goto(`${base}/#${route}`, { waitUntil: "networkidle0" });
      const hasModel = !["settings", "word-review", "word-library"].includes(route);
      await page.waitForSelector(route === "settings" ? "#add-model-name" : hasModel ? "#workspace-model" : "main h1");
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
  for (const route of ["grammar", "translation", "word-lookup", "practice", "coach", "ask"]) {
    await page.goto(`${base}/#${route}`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.querySelector("#workspace-model") && !document.querySelector("#workspace-model").disabled);
    await selectModel(localId);
    await page.waitForFunction(() => document.querySelector("#workspace-model").value !== "current" && !document.querySelector("#workspace-model").disabled);
    assert.equal(config.CustomFlashModel, "writing-fast");
    assert.equal(config.CustomProModel, "writing-pro");
    await page.goto(`${base}/#${route === "ask" ? "grammar" : "ask"}`, { waitUntil: "networkidle0" });
    assert.equal(await page.$eval("#workspace-model", e => e.value), "current", `${route} choice does not affect another page`);
    await page.goto(`${base}/#${route}`, { waitUntil: "networkidle0" });
    assert.equal(await page.$eval("#workspace-model", e => e.value), localId, `${route} retains its own choice`);
    await selectModel("current");
    await page.waitForFunction(() => document.querySelector("#workspace-model").value === "current" && !document.querySelector("#workspace-model").disabled);
  }
  assert.equal(settingsWrites, writesBeforeSwitch, "page switches never activate a global model");
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
  console.log(`Model Settings browser checks passed: save/edit, Ask toolbar, independent page choices, reload persistence, per-request profile headers, preserved input, keyboard menus and five viewport widths. Screenshots: ${output}`);
} finally {
  await browser?.close();
  await server.close();
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
}
