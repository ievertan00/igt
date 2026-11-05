import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import configLoader from "../shared/config-loader.mjs";
import { coachReportDisplayMarkdown } from "../domain/coach-report-display.mjs";

const fail = (status, message) => Object.assign(new Error(message), { status, code: "COACH_REPORT_STORAGE" });
function reportDirectory(directory) {
  if (directory) return path.resolve(directory);
  const config = configLoader.load();
  return path.resolve(config.CoachReportsDir || config.ReportPath || path.join(process.cwd(), "output", "coach-reports"));
}
export function reportMarkdown(report) {
  const markdown = coachReportDisplayMarkdown(report);
  return `# English proficiency diagnostic report\n\nGenerated: ${report.generatedAt}\n\nLanguage: ${report.language}\n\nWindow: ${report.days ? `Last ${report.days} days` : "All history"}\n\n${report.totalChecks} saved records; ${report.evidence.length} records supplied to the model. Sampled: ${report.sampled ? "yes" : "no"}. Truncated: ${report.truncated ? "yes" : "no"}.\n\n${markdown}\n`;
}
export function saveCoachReport(report, { directory } = {}) {
  const dir = reportDirectory(directory);
  const savedId = createHash("sha256").update(JSON.stringify([report.generatedAt, report.version, report.language, report.markdown])).digest("hex").slice(0, 24);
  const savedPath = path.join(dir, `${savedId}.md`);
  const stored = { ...report, savedId, savedPath };
  fs.mkdirSync(dir, { recursive: true });
  // Deterministic names make repeated reads of a cached report idempotent.
  for (const [extension, content] of [["md", reportMarkdown(report)], ["json", JSON.stringify(stored, null, 2)]]) {
    const target = path.join(dir, `${savedId}.${extension}`);
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, content, "utf8");
    fs.renameSync(temporary, target);
  }
  return stored;
}
export function listCoachReports({ directory } = {}) {
  const dir = reportDirectory(directory);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => /^[a-f0-9]{24}\.json$/.test(name)).flatMap(name => {
    try {
      const item = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      return [{ savedId: name.slice(0, -5), generatedAt: item.generatedAt, language: item.language, days: item.days, totalChecks: item.totalChecks }];
    } catch { return []; }
  }).sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
}
export function readCoachReport(savedId, { directory } = {}) {
  if (!/^[a-f0-9]{24}$/.test(savedId)) throw fail(400, "Invalid saved report.");
  const target = path.join(reportDirectory(directory), `${savedId}.json`);
  if (!fs.existsSync(target)) throw fail(404, "The saved report was not found.");
  return { ...JSON.parse(fs.readFileSync(target, "utf8")), savedPath: target.replace(/\.json$/, ".md") };
}
