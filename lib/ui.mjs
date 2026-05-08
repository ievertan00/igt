/**
 * Shared UI utilities for IGT tools
 */

export const colors = {
  reset:    "\x1b[0m",
  bold:     "\x1b[1m",
  dim:      "\x1b[2m",
  italic:   "\x1b[3m",
  underline: "\x1b[4m",
  inverse:  "\x1b[7m",
  
  black:    "\x1b[30m",
  red:      "\x1b[31m",
  green:    "\x1b[32m",
  yellow:   "\x1b[33m",
  blue:     "\x1b[34m",
  magenta:  "\x1b[35m",
  cyan:     "\x1b[36m",
  white:    "\x1b[37m",
  
  gray:     "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",
  
  bgBlack:   "\x1b[40m",
  bgRed:     "\x1b[41m",
  bgGreen:   "\x1b[42m",
  bgYellow:  "\x1b[43m",
  bgBlue:    "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan:    "\x1b[46m",
  bgWhite:   "\x1b[47m",
};

export const ansi = {
  saveCursor: "\x1b7",
  restoreCursor: "\x1b8",
  moveBottom: (rows) => `\x1b[${rows - 1};1H`,
  setScrollingRegion: (rows) => `\x1b[1;${rows - 2}r`,
  resetScrollingRegion: "\x1b[r",
  clearLine: "\x1b[2K",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
};

export function paint(color, text) {
  return `${color}${text}${colors.reset}`;
}

// Returns the terminal column width of a string, stripping ANSI codes and
// counting double-wide characters (emoji, CJK, fullwidth) as 2 columns.
function visibleWidth(str) {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, "");
  let w = 0;
  for (const char of plain) {
    const cp = char.codePointAt(0);
    // Supplementary emoji (surrogate pairs in JS string) — each JS char in the
    // pair has codePointAt returning half-pair values; iterating with for...of
    // gives us the full codepoint, so one iteration per emoji regardless.
    if (
      (cp >= 0x1F300 && cp <= 0x1FBFF) || // Misc symbols, emoji, supplemental
      (cp >= 0x2600  && cp <= 0x27BF)  || // Misc symbols (✅ ❌ etc.)
      (cp >= 0x2E80  && cp <= 0x9FFF)  || // CJK unified + radicals + hangul
      (cp >= 0xF900  && cp <= 0xFAFF)  || // CJK compatibility ideographs
      (cp >= 0xFF01  && cp <= 0xFF60)  || // Fullwidth forms
      (cp >= 0xFFE0  && cp <= 0xFFE6)     // Fullwidth signs
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

export function box(title, content, options = {}) {
  const width = options.width || 60;
  const color = options.color || colors.gray;
  const padding = options.padding || 2;

  const titleVW = visibleWidth(title);
  const top = paint(color, "┌─ ") + title + paint(color, " " + "─".repeat(Math.max(0, width - titleVW - 5)) + "┐");
  const bottom = paint(color, "└" + "─".repeat(width - 2) + "┘");

  const lines = content.split("\n");
  const paddedLines = lines.map(line => {
    const vlen = visibleWidth(line);
    const rightPadding = " ".repeat(Math.max(0, width - vlen - 4));
    return paint(color, "│ ") + " ".repeat(padding) + line + rightPadding.slice(padding) + paint(color, " │");
  });

  return [top, ...paddedLines, bottom].join("\n");
}

export function wrapText(text, maxWidth, continuationIndent = 0) {
  const indent = " ".repeat(continuationIndent);
  const lines = [];
  const words = text.split(" ");
  let current = "";
  for (const word of words) {
    if (word.length > maxWidth) {
      if (current.length > 0) { lines.push(current); current = ""; }
      for (let i = 0; i < word.length; i += maxWidth) lines.push(word.slice(i, i + maxWidth));
      continue;
    }
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.join("\n" + indent);
}

const FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

export class Spinner {
  constructor(message) {
    this.message = message;
    this.timer = null;
    this.idx = 0;
  }
  
  start() {
    process.stdout.write("\n");
    this.timer = setInterval(() => {
      process.stdout.write(`\r  ${paint(colors.cyan, FRAMES[this.idx++ % FRAMES.length])}  ${paint(colors.gray, this.message)}`);
    }, 80);
  }
  
  stop(clear = true) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      if (clear) {
        process.stdout.write("\r\x1b[2K\r");
      } else {
        process.stdout.write("\n");
      }
    }
  }
}

export function header(title, subtitle) {
  console.log("");
  console.log(`  ${paint(colors.bold + colors.yellow, "IGT")}  ${paint(colors.white, title)}`);
  if (subtitle) {
    console.log(`  ${paint(colors.gray, subtitle)}`);
  }
  console.log(`  ${paint(colors.gray, "────────────────────────────────────────────────")}`);
}

/**
 * Render an ASCII bar chart. items: [{label:string, value:number}]
 * Scales bars to fit the terminal width.
 */
export function renderBarChart(items, { title = null, color = null, maxWidth = null } = {}) {
  if (!items || items.length === 0) return;
  const termWidth = Math.min(
    maxWidth || 9999,
    Math.max(40, (process.stdout.columns || 80) - 4)
  );
  const labelWidth = Math.min(24, Math.max(...items.map(i => String(i.label).length)));
  const maxVal = Math.max(...items.map(i => i.value), 1);
  const barWidth = termWidth - labelWidth - 10;

  if (title) process.stdout.write(`  ${paint(colors.yellow, title)}\n`);
  for (const item of items) {
    const bars = Math.round((item.value / maxVal) * barWidth);
    const bar = (color ? paint(color, "█".repeat(bars)) : "█".repeat(bars)) +
      paint(colors.gray, "░".repeat(barWidth - bars));
    const label = String(item.label).slice(0, labelWidth).padEnd(labelWidth);
    const valStr = String(item.value.toFixed ? item.value.toFixed(2) : item.value).padStart(6);
    process.stdout.write(`  ${paint(colors.white, label)} ${bar} ${paint(colors.gray, valStr)}\n`);
  }
  process.stdout.write("\n");
}

/**
 * Render a two-line fixed status bar at the bottom of the terminal.
 * @param {Object} stats { totalInputs, totalDiagnoses, model }
 * @param {string} message interactive message (e.g. current sentence)
 * @param {number} rows terminal height
 * @returns {string} The formatted status bar ANSI string
 */
export function renderStatusBar(stats, message, rows) {
  if (!rows || rows < 5) return "";
  const { totalInputs = 0, totalDiagnoses = 0, model = "N/A" } = stats;
  const cols = (process.stdout.columns || 80) - 1;

  // Line 1: Session Stats
  const left = ` IGT | Sessions: ${totalInputs} | Errors: ${totalDiagnoses}`;
  const right = `Model: ${model} `;
  const statsLine = left + " ".repeat(Math.max(0, cols - visibleWidth(left) - visibleWidth(right))) + right;
  const line1 = paint(colors.bgWhite + colors.black, statsLine);

  // Line 2: Message (Interactive sentence)
  const msgPrefix = ` ${message}`;
  const msgLine = msgPrefix + " ".repeat(Math.max(0, cols - visibleWidth(msgPrefix)));
  const line2 = paint(colors.italic + colors.gray, msgLine);

  // Move up by 1 line to avoid "last line" issues on some Windows terminals
  // Line 1 at rows-2, Line 2 at rows-1
  return (
    "\x1b[?25l" + // Hide cursor
    "\x1b7" +     // Save cursor
    `\x1b[${rows - 2};1H` + line1 +
    `\x1b[${rows - 1};1H` + line2 +
    "\x1b8" +     // Restore cursor
    "\x1b[?25h"   // Show cursor
  );
}

export const ui = {
  colors,
  ansi,
  paint,
  box,
  wrapText,
  Spinner,
  header,
  renderBarChart,
  renderStatusBar,
};

export default ui;
