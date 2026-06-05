// Minimal markdown → ANSI renderer for /ask answers.
// Handles: ## / ### headings, bullets (- / *), blockquotes (>), code fences,
// inline **bold** and `code`. Plain paragraphs are word-wrapped via printLine.

import { colors, paint } from "../../cli/ui/index.mjs";
import { printLine, cols } from "../../cli/commands/render.mjs";

function applyInline(text) {
  // Order matters: code spans first (they may contain ** characters).
  let out = text.replace(/`([^`]+)`/g, (_, code) => paint(colors.cyan, code));
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, bold) => paint(colors.bold, bold));
  return out;
}

function emitHeading(level, text) {
  const styled = applyInline(text);
  if (level === 2) {
    process.stdout.write("\n" + paint(colors.bold + colors.yellow, styled) + "\n");
  } else if (level === 3) {
    process.stdout.write("\n" + paint(colors.bold + colors.cyan, styled) + "\n");
  } else {
    process.stdout.write("\n" + paint(colors.bold, styled) + "\n");
  }
}

function emitBullet(text) {
  const styled = applyInline(text);
  process.stdout.write(`  ${paint(colors.gray, "•")} ${styled}\n`);
}

function emitQuote(text) {
  const styled = applyInline(text);
  process.stdout.write(paint(colors.gray, `  │ ${styled}`) + "\n");
}

function emitParagraph(text) {
  const styled = applyInline(text);
  const w = cols();
  // Word-wrap manually (printLine takes a single color; we already styled inline).
  const words = styled.split(" ");
  let line = "";
  for (const word of words) {
    const cand = line ? `${line} ${word}` : word;
    // Visible length excluding ANSI escapes — approximate by stripping CSI sequences.
    const visible = cand.replace(/\x1b\[[0-9;]*m/g, "");
    if (visible.length > w && line) {
      process.stdout.write(line + "\n");
      line = word;
    } else {
      line = cand;
    }
  }
  if (line) process.stdout.write(line + "\n");
}

function visibleLen(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

// Markdown alignment row (e.g. | --- | :--: |) — only ever the second line.
function isSeparatorRow(rows, rIdx) {
  return rIdx === 1 && rows[1] && rows[1][0] && rows[1][0].includes('-');
}

// Word-wrap a styled prefix + body to the terminal width, indenting continuation
// lines so the wrapped value stays visually attached to its label.
function emitWrapped(prefix, body, indent) {
  const w = cols();
  const cont = " ".repeat(indent);
  let line = prefix;
  for (const word of body.split(" ")) {
    const cand = line === cont || line === prefix ? line + word : `${line} ${word}`;
    if (visibleLen(cand) > w && line.trim() !== "") {
      process.stdout.write(line + "\n");
      line = cont + word;
    } else {
      line = cand;
    }
  }
  if (line.trim() !== "") process.stdout.write(line + "\n");
}

// Fallback for tables too wide for the terminal: render each data row as a stacked
// block of "Header: value" lines so columns never wrap into an unreadable grid.
function emitTableVertical(rows) {
  const headers = rows[0] || [];
  const hasSep = isSeparatorRow(rows, 1);
  const dataRows = rows.slice(hasSep ? 2 : 1);
  process.stdout.write("\n");
  dataRows.forEach((row, idx) => {
    row.forEach((cell, cIdx) => {
      const label = headers[cIdx] ? applyInline(headers[cIdx]) : `Col ${cIdx + 1}`;
      emitWrapped(`  ${paint(colors.gray, label + ":")} `, applyInline(cell), 4);
    });
    if (idx < dataRows.length - 1) process.stdout.write("\n");
  });
  process.stdout.write("\n");
}

function emitTable(lines) {
  const rows = lines.map(line => {
    return line.trim().split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
  });

  const widths = [];
  rows.forEach((row, rIdx) => {
    if (isSeparatorRow(rows, rIdx)) return;
    row.forEach((cell, cIdx) => {
      const visible = visibleLen(applyInline(cell));
      widths[cIdx] = Math.max(widths[cIdx] || 0, visible);
    });
  });

  // Grid width = 2-space indent + each column (cell + 2 padding) + column borders.
  const gridWidth = 2 + widths.reduce((a, w) => a + w + 2, 0) + (widths.length + 1);
  if (gridWidth > cols()) {
    emitTableVertical(rows);
    return;
  }

  process.stdout.write("\n");
  rows.forEach((row, rIdx) => {
    if (isSeparatorRow(rows, rIdx)) {
      const sep = widths.map(w => paint(colors.gray, '-'.repeat(w + 2))).join(paint(colors.gray, '|'));
      process.stdout.write(`  ${paint(colors.gray, '|')}${sep}${paint(colors.gray, '|')}\n`);
      return;
    }
    const padded = row.map((cell, cIdx) => {
      const styledCell = applyInline(cell);
      const visible = visibleLen(styledCell);
      const pad = (widths[cIdx] || 0) - visible;
      return ` ${styledCell}${" ".repeat(Math.max(0, pad))} `;
    });
    process.stdout.write(`  ${paint(colors.gray, '|')}${padded.join(paint(colors.gray, '|'))}${paint(colors.gray, '|')}\n`);
  });
  process.stdout.write("\n");
}

function renderMarkdown(md) {
  if (!md) return;
  const lines = String(md).split(/\r?\n/);
  let inFence = false;
  let paragraph = [];
  let tableLines = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      emitParagraph(paragraph.join(" "));
      paragraph = [];
    }
  };

  const flushTable = () => {
    if (tableLines.length > 0) {
      emitTable(tableLines);
      tableLines = [];
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushTable();
  };

  for (const rawLine of lines) {
    const line = rawLine;

    if (/^\s*```/.test(line)) {
      flushAll();
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      process.stdout.write(paint(colors.cyan, "  " + line) + "\n");
      continue;
    }

    if (line.trim() === "") {
      flushAll();
      continue;
    }

    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushParagraph();
      tableLines.push(line.trim());
      continue;
    }

    flushTable();

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) { flushParagraph(); emitHeading(3, h3[1]); continue; }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) { flushParagraph(); emitHeading(2, h2[1]); continue; }
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1) { flushParagraph(); emitHeading(2, h1[1]); continue; }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) { flushParagraph(); emitBullet(bullet[1]); continue; }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) { flushParagraph(); emitQuote(quote[1]); continue; }

    paragraph.push(line.trim());
  }
  flushAll();
}

function emitRelated(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  process.stdout.write("\n" + paint(colors.gray, "Related") + "\n");
  for (const q of items) process.stdout.write(`  ${paint(colors.gray, "→")} ${paint(colors.gray, q)}\n`);
}

function emitSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return;
  process.stdout.write("\n" + paint(colors.bold + colors.yellow, "Sources") + "\n");
  for (const s of sources) {
    const label = `${s.article} — ${s.section}`;
    process.stdout.write(`  ${paint(colors.gray, "→")} ${paint(colors.gray, label)}\n`);
  }
}

export function renderAskResponse(response) {
  if (!response) return;
  renderMarkdown(response.answer || "");
  emitRelated(response.related);
  emitSources(response.sources);
}
