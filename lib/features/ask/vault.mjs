// Vault writer for /ask: appends an Obsidian-friendly entry to AskPath.
// The entry is a dated heading + the compacted markdown body verbatim,
// followed by the related-questions list when present.

import fs from "node:fs";
import path from "node:path";

const HEADER = "# IGT Ask Log\n";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTimestamp(date = new Date()) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return { dateStr: `${y}-${m}-${d}`, timeStr: `${h}:${min}` };
}

export function formatVaultEntry(response, { timestamp = new Date() } = {}) {
  const { dateStr, timeStr } = formatTimestamp(timestamp);
  const title = (response.title || response.question || "").trim();
  const answer = (response.answer || "").trim();
  const related = Array.isArray(response.related) ? response.related : [];

  let md = `\n## ${dateStr} ${timeStr} — ${title}\n\n`;
  if (answer) md += `${answer}\n\n`;
  if (related.length > 0) {
    md += `**Related**:\n`;
    for (const q of related) md += `- ${q}\n`;
    md += "\n";
  }
  return md;
}

export function appendToVault(askPath, md) {
  const dir = path.dirname(askPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(askPath)) {
    fs.writeFileSync(askPath, `${HEADER}${md}`, "utf8");
  } else {
    fs.appendFileSync(askPath, md, "utf8");
  }
  return path.basename(askPath);
}

export function saveToVault(targetDir, response, { timestamp = new Date() } = {}) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const { dateStr, timeStr } = formatTimestamp(timestamp);
  const title = (response.title || response.question || "").trim();

  // Sanitize title to remove characters illegal in Windows/macOS/Linux filenames
  let titlePart = title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (titlePart.length > 50) {
    titlePart = titlePart.slice(0, 50).trim();
  }
  if (!titlePart) {
    titlePart = "Ask_Log";
  }

  const filename = `${titlePart}.md`;
  const notePath = path.join(targetDir, filename);

  const answer = (response.answer || "").trim();
  const related = Array.isArray(response.related) ? response.related : [];

  let md = `**Date**: ${dateStr} ${timeStr}\n\n`;
  if (answer) md += `${answer}\n\n`;
  if (related.length > 0) {
    md += `**Related**:\n`;
    for (const q of related) md += `- ${q}\n`;
    md += "\n";
  }

  fs.writeFileSync(notePath, md, "utf8");
  return filename;
}

