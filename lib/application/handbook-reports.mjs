import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { reportHtml } from "../features/handbook/html.mjs";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const reportName = /^handbook_(\d{4}-\d{2}-\d{2})_([a-z][a-z0-9-]{0,39})\.md$/i;
const maxBytes = 2 * 1024 * 1024;
const fail = (status, message) => Object.assign(new Error(message), { status, code: "HANDBOOK_REPORT_ERROR" });
const hash = (markdown) => crypto.createHash("sha256").update(markdown).digest("hex");
export const handbookReportDirectory = (config = {}) => path.resolve(projectRoot, config.ReportPath || ".");

function readFile(root, name) {
  const realRoot = fs.realpathSync(root);
  const file = path.join(realRoot, name);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || path.dirname(fs.realpathSync(file)) !== realRoot) throw fail(400, "This report is unavailable.");
  if (stat.size > maxBytes) throw fail(413, "This report is too large to preview.");
  return fs.readFileSync(file, "utf8");
}

function snapshotFor(root, name, markdown) {
  try {
    const value = JSON.parse(readFile(root, name.replace(/\.md$/, ".snapshot.json")));
    if (value.version !== 1 || value.markdownHash !== hash(markdown) || !Number.isInteger(value.days) || value.days < 0 || !Number.isFinite(Date.parse(value.generatedAt)) || !Array.isArray(value.categories)) return null;
    if (!value.categories.every((row) => typeof row.errorType === "string" && Number.isInteger(row.count) && row.count >= 0)) return null;
    return value;
  } catch { return null; }
}

export function listHandbookReports(config = {}) {
  const root = handbookReportDirectory(config);
  if (!fs.existsSync(root)) return { reports: [] };
  const reports = fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const match = entry.name.match(reportName);
    if (!entry.isFile() || !match) return [];
    try {
      const stat = fs.statSync(path.join(root, entry.name));
      return [{ id: entry.name, date: match[1], provider: match[2], modifiedAt: stat.mtime.toISOString(), bytes: stat.size }];
    } catch { return []; }
  }).sort((a, b) => b.date.localeCompare(a.date) || b.modifiedAt.localeCompare(a.modifiedAt) || a.id.localeCompare(b.id));
  return { reports: reports.slice(0, 500), truncated: reports.length > 500 };
}

export function readHandbookReport(id, config = {}) {
  if (typeof id !== "string" || !reportName.test(id)) throw fail(400, "Choose a valid Handbook report.");
  try {
    const root = handbookReportDirectory(config);
    const markdown = readFile(root, id);
    return { id, markdown, html: reportHtml(markdown, id), snapshot: snapshotFor(root, id, markdown) };
  } catch (error) {
    if (error.status) throw error;
    throw fail(error.code === "ENOENT" ? 404 : 503, "This report could not be read. Refresh the report list and try again.");
  }
}

export function compareHandbookReports(older, newer, config = {}) {
  const before = readHandbookReport(older, config).snapshot;
  const after = readHandbookReport(newer, config).snapshot;
  if (!before || !after) return { available: false, reason: "These reports do not both have matching structured snapshots. You can still read and export them." };
  if (before.days !== after.days) return { available: false, reason: "These reports cover different time windows. Choose reports with the same time window." };
  if (Date.parse(before.generatedAt) >= Date.parse(after.generatedAt)) return { available: false, reason: "Choose an earlier report to compare with the open report." };
  const left = new Map(before.categories.map((row) => [row.errorType, row.count]));
  const right = new Map(after.categories.map((row) => [row.errorType, row.count]));
  const changes = [...new Set([...left.keys(), ...right.keys()])].sort().map((errorType) => ({ errorType, before: left.get(errorType) || 0, after: right.get(errorType) || 0, delta: (right.get(errorType) || 0) - (left.get(errorType) || 0) }));
  return { available: true, days: after.days, changes, note: "Counts reflect saved observations in each report. Changes in writing volume or topic can change these counts; they do not establish learning improvement." };
}

export function saveHandbookReport({ markdown, provider, date, days, stats, errorFrequency, generatedAt = new Date().toISOString(), format = "markdown" }, config = {}) {
  const id = `handbook_${date}_${provider}.md`;
  if (!reportName.test(id)) throw fail(400, "Invalid report name.");
  const root = handbookReportDirectory(config);
  fs.mkdirSync(root, { recursive: true });
  const write = (name, text) => {
    const file = path.join(root, name);
    if (fs.existsSync(file) && (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink())) throw fail(400, "This report output is unavailable.");
    const temporary = path.join(root, `.${name}.${crypto.randomUUID()}.tmp`);
    try { fs.writeFileSync(temporary, text, { encoding: "utf8", flag: "wx" }); fs.renameSync(temporary, file); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  };
  const snapshot = { version: 1, generatedAt, days, stats, categories: errorFrequency.map((row) => ({ errorType: row.error_type, count: row.count })), markdownHash: hash(markdown) };
  write(id, markdown);
  write(id.replace(/\.md$/, ".snapshot.json"), JSON.stringify(snapshot, null, 2));
  if (format === "html") write(id.replace(/\.md$/, ".html"), reportHtml(markdown, id));
  return { markdownPath: path.join(root, id), htmlPath: format === "html" ? path.join(root, id.replace(/\.md$/, ".html")) : null };
}
