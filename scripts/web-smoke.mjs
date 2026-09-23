import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { preview } from "vite";

const server = await preview({
  root: "apps/web",
  configFile: "apps/web/vite.config.ts",
  preview: { host: "127.0.0.1", port: 4173 },
});
try {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Users\\Evertan\\.cache\\puppeteer\\chrome\\win64-153.0.8010.36\\chrome-win64\\chrome.exe",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      const path = new URL(request.url()).pathname;
      if (path === "/dashboard") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ stats: { totalInputs: 2, dueCounts: { vocab: 1 } }, today: { inputs_today: 1 }, recentActivity: [], coach: { focus: null } }) });
      } else if (path === "/coach") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ windowDays: 30, sample: { totalInputs: 2, totalDiagnoses: 1 }, priorities: [], limitations: ["mocked browser smoke data"] }) });
      } else if (path === "/handbook") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ days: 90, stats: { total_inputs: 2, total_diagnoses: 1 }, frequencies: [], selected: null, examples: [] }) });
      } else if (path === "/review/due") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ cards: [] }) });
      } else {
        await request.continue();
      }
    });
    await page.goto("http://127.0.0.1:4173/#dashboard", { waitUntil: "networkidle0" });
    assert.match(await page.title(), /IGT/);
    assert.equal(await page.$eval(".brand", (node) => node.textContent), "IGT");
    await page.click("a[href='#grammar']");
    assert.match(await page.$eval("h1", (node) => node.textContent), /把一句话交给 IGT/);
    await page.setViewport({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/#coach", { waitUntil: "networkidle0" });
    assert.match(await page.$eval("h1", (node) => node.textContent), /你的下一轮学习计划/);
    for (const route of ["translation", "word-lookup", "word-review", "practice", "ask", "handbook", "coach"]) {
      await page.goto(`http://127.0.0.1:4173/#${route}`, { waitUntil: "networkidle0" });
      await page.waitForSelector("h1", { timeout: 3000 });
      const heading = await page.$("h1");
      if (!heading) console.log(`body for #${route}:`, (await page.$eval("body", (node) => node.textContent)).slice(0, 240));
      assert.ok(heading, `missing heading for #${route}`);
    }
    console.log("web smoke ok");
  } finally {
    await browser.close();
  }
} finally {
  await server.httpServer.close();
}
