import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { listHandbookReports, readHandbookReport, compareHandbookReports, saveHandbookReport } from "../lib/application/handbook-reports.mjs";
import { reportHtml } from "../lib/features/handbook/html.mjs";
import { registerHandbookRoutes } from "../lib/server/routes/handbook.mjs";
import { dispatch } from "../lib/server/router.mjs";
import { handbookWeek } from "../lib/features/handbook/queries.mjs";

const root = path.join(process.cwd(), "artifacts", "handbook-report-tests", crypto.randomUUID());
const config = { ReportPath: root };
fs.mkdirSync(root, { recursive: true });
test.after(() => {
  if (!path.resolve(root).startsWith(path.join(process.cwd(), "artifacts") + path.sep)) throw new Error("Unsafe test cleanup path");
  fs.rmSync(root, { recursive: true, force: true });
});
const markdown = "# My Handbook\n\n> [!NOTE]- Articles\n> **Remember** a determiner.\n\n| Type | Count |\n| --- | --- |\n| Articles | 2 |\n\n[Reference](https://example.com)\n\n<script>alert('unsafe')</script>";
const save = (date, count, days = 90) => saveHandbookReport({ markdown, date, provider: "gemini", days, stats: { total_inputs: 3, total_diagnoses: count }, errorFrequency: [{ error_type: "Articles", count }], generatedAt: `${date}T10:00:00Z`, format: "html" }, config);
save("2026-10-20", 2);
save("2026-10-21", 1);
const older = "handbook_2026-10-20_gemini.md", newer = "handbook_2026-10-21_gemini.md";
registerHandbookRoutes({ getReportConfig: () => config });

test("reports list only matching Markdown files, newest first", () => {
  fs.writeFileSync(path.join(root, "private.md"), "Not a handbook");
  const result = listHandbookReports(config);
  assert.deepEqual(result.reports.map((row) => row.id), [newer, older]);
  assert.equal(JSON.stringify(result).includes(root), false);
  assert.deepEqual(listHandbookReports({ ReportPath: path.join(root, "missing") }).reports, []);
});

test("saved Markdown, snapshot and offline HTML survive rereading", () => {
  const report = readHandbookReport(newer, config);
  assert.equal(report.markdown, markdown);
  assert.equal(report.snapshot.categories[0].count, 1);
  assert.ok(fs.existsSync(path.join(root, newer.replace(/\.md$/, ".html"))));
  assert.match(report.html, /Content-Security-Policy/);
  assert.match(report.html, /<details><summary>Articles<\/summary>/);
  assert.match(report.html, /<table>/);
  assert.match(report.html, /href="https:\/\/example.com"/);
  assert.equal(report.html.includes("<script>"), false);
  assert.equal(reportHtml("[Bad](javascript:alert(1))").includes('href="javascript:'), false);
});

test("comparisons use verified counts and never infer mastery", () => {
  const comparison = compareHandbookReports(older, newer, config);
  assert.equal(comparison.available, true);
  assert.equal(comparison.changes[0].delta, -1);
  assert.match(comparison.note, /do not establish learning improvement/);
  assert.equal(compareHandbookReports(newer, older, config).available, false);
});

test("legacy and edited reports remain readable without a fabricated comparison", () => {
  const legacy = "handbook_2026-10-19_qwen.md";
  fs.writeFileSync(path.join(root, legacy), "# Legacy report");
  assert.equal(readHandbookReport(legacy, config).snapshot, null);
  assert.equal(compareHandbookReports(legacy, newer, config).available, false);
  const changed = save("2026-10-18", 3);
  fs.appendFileSync(changed.markdownPath, "\nEdited later");
  assert.equal(readHandbookReport(path.basename(changed.markdownPath), config).snapshot, null);
  save("2026-10-17", 3, 30);
  assert.equal(compareHandbookReports("handbook_2026-10-17_gemini.md", newer, config).available, false);
});

test("path traversal, unrelated files and oversized reports are rejected", () => {
  for (const id of ["../private.md", "private.md", "C:\\private.md", "handbook_2026-10-20_gemini.md/other"]) assert.throws(() => readHandbookReport(id, config), { status: 400 });
  const name = "handbook_2026-10-16_gemini.md";
  fs.writeFileSync(path.join(root, name), "a".repeat(2 * 1024 * 1024 + 1));
  assert.throws(() => readHandbookReport(name, config), { status: 413 });
});

test("report routes export attachments and return friendly errors", async () => {
  const request = async (url) => {
    let status, headers, output;
    await dispatch({ method: "GET", url }, { writeHead(code, value) { status = code; headers = value; }, end(value) { output = value; } });
    return { status, headers, output };
  };
  const html = await request(`/handbook/reports/export?id=${newer}&format=html`);
  assert.equal(html.status, 200);
  assert.match(html.headers["Content-Disposition"], /attachment/);
  assert.match(html.output, /<!doctype html>/);
  const md = await request(`/handbook/reports/export?id=${newer}&format=markdown`);
  assert.equal(md.output, markdown);
  const invalid = await request("/handbook/reports/read?id=..%2Fprivate.md");
  assert.equal(invalid.status, 400);
  assert.equal(invalid.output.includes(root), false);
  assert.equal((await request(`/handbook/reports/export?id=${newer}&format=pdf`)).status, 400);
});

test("weekly observations respect Monday boundaries in the learning timezone", () => {
  assert.equal(handbookWeek("2026-10-18T12:00:00Z"), "2026-10-12");
  assert.equal(handbookWeek("2026-10-18T18:00:00Z"), "2026-10-19");
  assert.equal(handbookWeek("invalid"), null);
});
