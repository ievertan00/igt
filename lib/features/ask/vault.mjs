// Vault writer for /ask: writes the compacted consultation as a standalone
// Obsidian note (one file per saved thread) inside the target directory.

import fs from "node:fs";
import path from "node:path";
import { chineseAskTitle } from "./metadata.mjs";

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

export function saveToVault(targetDir, response, { timestamp = new Date(), preserveExisting = false, saveId = "" } = {}) {
  const title = chineseAskTitle(response.title);
  if (!title) throw Object.assign(new Error("A Chinese AI title is required before saving an Ask note."), { status: 503, code: "ASK_CHINESE_TITLE_REQUIRED" });
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const { dateStr, timeStr } = formatTimestamp(timestamp);

  // Shared normalization keeps the frontmatter title and filename identical.
  const titlePart = title;

  const filename = `${titlePart}.md`;
  const notePath = path.join(targetDir, filename);

  const answer = (response.answer || "").trim();
  const related = Array.isArray(response.related) ? response.related : [];

  let md = `**Date**: ${dateStr} ${timeStr}\n\n`;
  if (response.category && Array.isArray(response.tags)) {
    md = `---\ntitle: ${JSON.stringify(title)}\ntags: ${JSON.stringify(response.tags)}\ncategory: ${JSON.stringify(response.category)}\nmetadataSource: ${JSON.stringify(response.metadataSource || "fallback")}\n---\n\n` + md;
  }
  if (saveId) md += `<!-- igt-ask-save:${saveId} -->\n\n`;
  if (answer) md += `${answer}\n\n`;
  if (related.length > 0) {
    md += `**Related**:\n`;
    for (const q of related) md += `- ${q}\n`;
    md += "\n";
  }
  if (Buffer.byteLength(md, "utf8") > 1024 * 1024) {
    throw Object.assign(new Error("This note exceeds the 1 MiB reading limit. Save a shorter consultation."), { status: 413, code: "ASK_NOTE_TOO_LARGE" });
  }
  const libraryBytes = fs.readdirSync(targetDir, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
    .reduce((total, entry) => total + fs.lstatSync(path.join(targetDir, entry.name)).size, 0);
  if (libraryBytes + Buffer.byteLength(md, "utf8") > 10 * 1024 * 1024) {
    throw Object.assign(new Error("The Ask notes folder has reached its 10 MiB reading limit. Choose another notes folder."), { status: 413, code: "ASK_LIBRARY_FULL" });
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

