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
    let askRequestBody;
    let askSaveBody;
    let reviewGradeBody;
    let practiceGenerateBody;
    const handbookRequests = [];
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      const path = new URL(request.url()).pathname;
      if (path === "/runtime") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ runtime: "local", storage: { database: "sqlite", assets: "markdown" } }) });
      } else if (path === "/dashboard") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ stats: { totalInputs: 2, dueCounts: { vocab: 1 } }, today: { inputs_today: 1 }, recentActivity: [], coach: { focus: null } }) });
      } else if (path === "/coach") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ windowDays: 30, sample: { totalInputs: 2, totalDiagnoses: 1 }, priorities: [], limitations: ["mocked browser smoke data"] }) });
      } else if (path === "/coach/analyze" && request.method() === "POST") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ windowDays: 30, sample: { totalInputs: 3, totalDiagnoses: 2 }, priorities: [], limitations: ["forced refresh completed"] }) });
      } else if (path === "/handbook") {
        const params = new URL(request.url()).searchParams;
        handbookRequests.push(params.get("errorType") || "");
        const selected = params.get("errorType") || null;
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ days: 90, stats: { total_inputs: 2, total_diagnoses: 1 }, frequencies: [{ error_type: "Articles", count: 2 }], selected, examples: selected ? [{ original_text: "I bought book.", correction: "I bought a book.", explanation: "Use an article before a singular countable noun." }] : [] }) });
      } else if (path === "/review/due") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ cards: [{ id: 1, word: "consolidate", zh: "巩固；合并", meaning: "combine into one", example: "We consolidated the notes.", pos: "verb" }] }) });
      } else if (path === "/review/grade" && request.method() === "POST") {
        reviewGradeBody = JSON.parse(request.postData() || "{}");
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ correct: true, judgement: "self-report", next: { intervalDays: 2 } }) });
      } else if (path === "/grammar" && request.method() === "POST") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ result: { originalText: "I suggested him to join.", correction: "I suggested that he join.", refine: "I suggested he join.", diagnoses: [], remember: ["suggest + that clause"] }, persistence: { saved: false, requiresConfirmation: true } }) });
      } else if (path === "/grammar/save" && request.method() === "POST") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ persistence: { saved: true, entryId: "smoke-entry" } }) });
      } else if (path === "/translation" && request.method() === "POST") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { translation: "Could you clarify the deadline?" } }) });
      } else if (path === "/word/lookup") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { word: "consolidate", pos: "verb", meaning: "combine into one", zh: "巩固；合并", example: "We consolidated the notes." } }) });
      } else if (path === "/word/add" && request.method() === "POST") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ persistence: { saved: true } }) });
      } else if (path === "/practice/generate" && request.method() === "POST") {
        practiceGenerateBody = JSON.parse(request.postData() || "{}");
        const question = { id: "sentence-smoke", kind: "sentence", prompt_zh: "请说明截止日期", difficulty: practiceGenerateBody.difficulty, style: practiceGenerateBody.style, context: practiceGenerateBody.context };
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { mode: practiceGenerateBody.mode, questions: [question] } }) });
      } else if (path === "/practice/evaluate" && request.method() === "POST") {
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { score: 88, reference_answer: "Could you clarify the deadline?", corrected_answer: "Could you clarify the deadline?", feedback_zh: "表达清楚。" }, persistence: { saved: true } }) });
      } else if (path === "/ask" && request.method() === "POST") {
        askRequestBody = JSON.parse(request.postData() || "{}");
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { answer: "Use the present perfect for a present connection." } }) });
      } else if (path === "/ask/save" && request.method() === "POST") {
        askSaveBody = JSON.parse(request.postData() || "{}");
        await request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ saved: true, vaultFile: "Present perfect.md", turnCount: 1 }) });
      } else {
        await request.continue();
      }
    });
    await page.goto("http://127.0.0.1:4173/#dashboard", { waitUntil: "networkidle0" });
    assert.match(await page.title(), /IGT/);
    assert.equal(await page.$eval(".brand", (node) => node.textContent), "IGT");
    await page.waitForFunction(() => document.body.textContent.includes("Local · markdown + sqlite"));
    assert.equal(await page.$$eval(".group-label", (nodes) => nodes.length), 4);
    await page.click(".group-label");
    assert.equal(await page.$$(".nav-child").then((nodes) => nodes.length), 5);
    await page.click(".group-label");
    assert.equal(await page.$$(".nav-child").then((nodes) => nodes.length), 8);
    await page.click("a[href='#grammar']");
    assert.match(await page.$eval("h1", (node) => node.textContent), /把一句话交给 IGT/);
    assert.deepEqual(await page.$$eval(".group-label.active", (nodes) => nodes.map((node) => node.textContent)), ["语言工具"]);
    assert.equal(await page.$eval("textarea", (node) => node.labels?.[0]?.textContent), "你的英文表达");
    await page.focus("textarea");
    assert.equal(await page.$eval(":focus", (node) => node.tagName), "TEXTAREA");
    await page.setViewport({ width: 390, height: 844 });
    assert.equal(await page.$eval(".menu-toggle", (node) => node.getAttribute("aria-expanded")), "false");
    await page.click(".menu-toggle");
    assert.equal(await page.$eval(".menu-toggle", (node) => node.getAttribute("aria-expanded")), "true");
    await page.click(".nav-child");
    assert.equal(await page.$eval(".menu-toggle", (node) => node.getAttribute("aria-expanded")), "false");
    await page.click(".menu-toggle");
    await page.click(".nav-group .nav-child:nth-of-type(3)");
    await page.waitForFunction(() => location.hash === "#translation");
    assert.equal(await page.$eval(".menu-toggle", (node) => node.getAttribute("aria-expanded")), "false");
    await page.goto("http://127.0.0.1:4173/#coach", { waitUntil: "networkidle0" });
    assert.match(await page.$eval("h1", (node) => node.textContent), /你的下一轮学习计划/);
    for (const route of ["translation", "word-lookup", "word-review", "practice", "ask", "handbook", "coach"]) {
      await page.goto(`http://127.0.0.1:4173/#${route}`, { waitUntil: "networkidle0" });
      await page.waitForSelector("h1", { timeout: 3000 });
      const heading = await page.$("h1");
      if (!heading) console.log(`body for #${route}:`, (await page.$eval("body", (node) => node.textContent)).slice(0, 240));
      assert.ok(heading, `missing heading for #${route}`);
    }
    await page.goto("http://127.0.0.1:4173/#ask", { waitUntil: "networkidle0" });
    assert.equal(await page.$eval("textarea", (node) => node.labels?.[0]?.textContent), "你的问题");
    await page.type("textarea", "How should I use the present perfect?");
    await page.click("button.primary");
    await page.waitForFunction(() => document.body.textContent.includes("Use the present perfect"));
    assert.deepEqual(askRequestBody.messages, []);
    assert.equal(askRequestBody.question, "How should I use the present perfect?");
    await page.click("button.secondary");
    await page.waitForFunction(() => document.body.textContent.includes("已保存到 Ask Markdown"));
    assert.equal(askSaveBody.messages.length, 1);
    assert.equal(askSaveBody.messages[0].question, "How should I use the present perfect?");
    await page.goto("http://127.0.0.1:4173/#grammar", { waitUntil: "networkidle0" });
    await page.type("textarea", "I suggested him to join.");
    await page.click("button.primary");
    await page.waitForFunction(() => document.body.textContent.includes("I suggested that he join."));
    await page.click("button.secondary");
    await page.waitForFunction(() => document.body.textContent.includes("已保存到 Review log"));
    await page.goto("http://127.0.0.1:4173/#translation", { waitUntil: "networkidle0" });
    await page.type("textarea", "请说明截止日期");
    await page.click("button.primary");
    await page.waitForFunction(() => document.body.textContent.includes("Could you clarify the deadline?"));
    await page.goto("http://127.0.0.1:4173/#word-lookup", { waitUntil: "networkidle0" });
    assert.equal(await page.$eval("input", (node) => node.labels?.[0]?.textContent), "查询单词或短语");
    await page.type("input", "consolidate");
    await page.click("button.primary");
    await page.waitForFunction(() => document.body.textContent.includes("consolidate"));
    const lookupButtons = await page.$$("button.primary");
    await lookupButtons[1].click();
    await page.waitForFunction(() => document.body.textContent.includes("已保存到 Vocabulary Markdown"));
    await page.goto("http://127.0.0.1:4173/#practice", { waitUntil: "networkidle0" });
    await page.click("button.primary");
    await page.waitForFunction(() => document.body.textContent.includes("请说明截止日期"));
    assert.equal(practiceGenerateBody.mode, "sentence");
    await page.type("textarea", "Could you clarify the deadline?");
    await page.click("button.primary");
    await page.waitForFunction(() => document.body.textContent.includes("88"));
    await page.reload({ waitUntil: "networkidle0" });
    assert.equal(await page.$('.switches'), null);
    await page.click('input[name="practice-style"][value="formal"]');
    await page.click('input[name="practice-context"][value="work"]');
    await page.click("button.primary");
    await page.waitForFunction(() => document.body.textContent.includes("请说明截止日期"));
    assert.equal(practiceGenerateBody.style, "formal");
    assert.equal(practiceGenerateBody.context, "work");
    await page.goto("http://127.0.0.1:4173/#coach", { waitUntil: "networkidle0" });
    await page.click("button.secondary");
    await page.waitForFunction(() => document.body.textContent.includes("forced refresh completed"));
    await page.goto("http://127.0.0.1:4173/#handbook", { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.body.textContent.includes("Articles"));
    await page.click(".handbook-list button");
    await page.waitForFunction(() => document.body.textContent.includes("Use an article"));
    assert.ok(handbookRequests.includes("Articles"));
    await page.goto("http://127.0.0.1:4173/#word-review", { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.body.textContent.includes("巩固；合并"));
    assert.equal(await page.$$eval(".panel h2", (nodes) => nodes.at(-1)?.textContent), "巩固；合并");
    await page.click("button.primary");
    assert.equal(await page.$$eval(".panel h2", (nodes) => nodes.at(-1)?.textContent), "consolidate");
    await page.click(".review-actions button");
    await page.waitForFunction(() => document.body.textContent.includes("今日复习完成"));
    assert.equal(reviewGradeBody.rating, "again");
    console.log("web smoke ok");
  } finally {
    await browser.close();
  }
} finally {
  await server.httpServer.close();
}
