// Vault writer for /ask: writes the compacted consultation as a standalone
// Obsidian note (one file per saved thread) inside the target directory.

import fs from "node:fs";
import path from "node:path";

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

