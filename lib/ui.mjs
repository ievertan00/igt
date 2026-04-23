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

export const ui = {
  colors,
  paint,
  box,
  wrapText,
  Spinner,
  header
};

export default ui;
