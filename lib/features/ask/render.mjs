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

function renderMarkdown(md) {
  if (!md) return;
  const lines = String(md).split(/\r?\n/);
  let inFence = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      emitParagraph(paragraph.join(" "));
      paragraph = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine;

    if (/^\s*```/.test(line)) {
      flushParagraph();
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      process.stdout.write(paint(colors.cyan, "  " + line) + "\n");
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

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
  flushParagraph();
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
