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

export function saveToVault(targetDir, response, { timestamp = new Date(), preserveExisting = false } = {}) {
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

  // Web saves can contain individual answers or whole discussions. Never let
  // these snapshots overwrite each other or an existing CLI note with the same title.
  if (preserveExisting) {
    const body = (value) => value.startsWith("**Date**: ") && value.includes("\n\n") ? value.slice(value.indexOf("\n\n") + 2) : value;
    for (let index = 1; ; index += 1) {
      const candidate = index === 1 ? filename : `${titlePart} (${index}).md`;
      const candidatePath = path.join(targetDir, candidate);
      try {
        fs.writeFileSync(candidatePath, md, { encoding: "utf8", flag: "wx" });
        return candidate;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        const stat = fs.lstatSync(candidatePath);
        if (stat.isFile() && !stat.isSymbolicLink() && body(fs.readFileSync(candidatePath, "utf8")) === body(md)) return candidate;
      }
    }
  }
  fs.writeFileSync(notePath, md, "utf8");
  return filename;
}

