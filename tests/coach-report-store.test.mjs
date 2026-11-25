import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { saveCoachReport, listCoachReports, readCoachReport } from "../lib/application/coach-report-store.mjs";
import { coachReportDisplayMarkdown } from "../lib/domain/coach-report-display.mjs";

test("report display removes citations and their empty table columns while preserving report content", () => {
  const report = { evidence: [{ entryId: "private-id" }], markdown: "Finding [private-id]. Keep [optional].\n\n| Pattern | Evidence |\n| --- | --- |\n| Articles | [S1] |" };
  assert.equal(coachReportDisplayMarkdown(report), "Finding. Keep [optional].\n\n| Pattern |\n| --- |\n| Articles |");
  report.markdown = "| Pattern | Evidence |\n| --- | --- |\n| Articles | An original example [private-id] |";
  assert.match(coachReportDisplayMarkdown(report), /An original example/);
  assert.match(coachReportDisplayMarkdown(report), /Evidence/);
});

test("reports retain source data while exported Markdown omits citations and source records", () => {
  fs.mkdirSync(path.join(process.cwd(), ".cache", "coach-runtime"), { recursive: true });
  const directory = fs.mkdtempSync(path.join(process.cwd(), ".cache", "coach-runtime", "store-test-"));
  const report = { version: "v1", days: 0, language: "zh-CN", generatedAt: "2026-11-03T01:00:00Z", totalChecks: 1, sampled: false, truncated: false,
    markdown: "## 学习报告\n名词需要限定词。[review-private-id]", evidenceIds: ["review-private-id"], evidence: [{ entryId: "review-private-id", timestamp: "2026-11-02", original: "I read book.", correction: "I read a book." }] };
  try {
    const saved = saveCoachReport(report, { directory });
    assert.equal(saveCoachReport({ ...report, cached: true }, { directory }).savedId, saved.savedId);
    assert.equal(listCoachReports({ directory }).length, 1);
    assert.equal(readCoachReport(saved.savedId, { directory }).markdown, report.markdown);
    const markdown = fs.readFileSync(saved.savedPath, "utf8");
    assert.match(markdown, /名词需要限定词。/);
    assert.doesNotMatch(markdown, /\[S1\]|review-private-id|## Source records|I read book\./);
    assert.throws(() => readCoachReport("../outside", { directory }), { status: 400 });
    assert.throws(() => readCoachReport("0".repeat(24), { directory }), { status: 404 });
    const newer = saveCoachReport({ ...report, generatedAt: "2026-11-03T02:00:00Z" }, { directory });
    fs.writeFileSync(path.join(directory, `${"f".repeat(24)}.json`), "broken");
    assert.equal(listCoachReports({ directory })[0].savedId, newer.savedId);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
