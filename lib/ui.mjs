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
  // Region ends at rows-3 to leave a one-row gap above the two-line status bar.
  setScrollingRegion: (rows) => `\x1b[1;${rows - 3}r`,
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

export function renderSparkline(values) {
  if (!values || values.length === 0) return "";
  const blocks = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const max = Math.max(...values, 1);
  return values.map(v => blocks[Math.min(7, Math.floor((v / max) * 7))]).join('');
}

export function renderLineChart(values, labels, { color = colors.magenta, height = 5 } = {}) {
  if (!values || values.length === 0) return;
  const max = Math.max(...values, 1);
  const rows = [];
  
  for (let h = height; h >= 1; h--) {
    let row = `  ${String(Math.round((h / height) * max)).padStart(3)} │`;
    for (const v of values) {
      const level = (v / max) * height;
      if (level >= h) {
        row += `  ${paint(color, "█")}`;
      } else if (level >= h - 0.5) {
        row += `  ${paint(color, "▄")}`;
      } else {
        row += "   ";
      }
    }
    rows.push(row);
  }
  
  const separator = "      └" + "───".repeat(values.length);
  const labelRow = "       " + labels.map(l => String(l).slice(-2).padStart(3)).join("");
  
  process.stdout.write(rows.join("\n") + "\n" + separator + "\n" + labelRow + "\n\n");
}

/**
 * Render a two-line fixed status bar at the bottom of the terminal.
 * @param {Object} stats { totalInputs, totalDiagnoses, model }
 * @param {string|Object} message interactive message (e.g. current sentence)
 * @param {number} rows terminal height
 * @param {number} [scrollOffset=0] horizontal scroll offset for long messages
 * @returns {string} The formatted status bar ANSI string
 */
export function renderStatusBar(stats, message, rows, scrollOffset = 0) {
  const realRows = process.stdout.rows || rows || 24;
  const realCols = process.stdout.columns || 80;
  if (!realRows || realRows < 5) return "";
  
  const { totalInputs = 0, totalDiagnoses = 0, model = "N/A" } = stats;
  // Use cols - 2 to be extra safe against wrapping on some terminals
  const cols = realCols - 2;

  // Accept message as a string or { content, author } object.
  const content = typeof message === "string" ? message : (message?.content || "");
  const author = typeof message === "string" ? "" : (message?.author || "");

  // Line 1: Session Stats
  const left = ` IGT | Sessions: ${totalInputs} | Errors: ${totalDiagnoses}`;
  const right = ` Model: ${model} `;
  
  // Truncate statsLine if it exceeds terminal width to prevent wrap.
  // We use realCols - 1 as a safety margin.
  let statsLine;
  if (visibleWidth(left) + visibleWidth(right) + 2 > realCols) {
    statsLine = left.slice(0, realCols - visibleWidth(right) - 5) + "... " + right;
  } else {
    statsLine = left + " ".repeat(Math.max(0, cols - visibleWidth(left) - visibleWidth(right))) + right;
  }
  
  // Use EL trick: Put statsLine inside the background color, and use \x1b[K 
  // to fill the rest of the line with that background color.
  const line1 = colors.bgWhite + colors.black + statsLine + "\x1b[K" + colors.reset;

  // Line 2: Message in bright cyan, optional author in subdued gray
  const msgPart = ` ${content}`;
  const authorPart = author ? `  — ${author}` : "";
  const totalW = visibleWidth(msgPart) + visibleWidth(authorPart);

  let line2;
  if (totalW <= cols) {
    line2 =
      paint(colors.cyan, msgPart) +
      (authorPart ? paint(colors.gray, authorPart) : "") +
      "\x1b[K"; // EL trick again (uses default background)
  } else {
    // Rolling logic: combine items and repeat with a spacer
    const items = [
      { text: msgPart, color: colors.cyan },
      { text: authorPart, color: colors.gray }
    ];
    const spacer = { text: " ".repeat(10), color: "" };
    const stream = [...items, spacer];
    const streamW = stream.reduce((acc, i) => acc + visibleWidth(i.text), 0);
    
    let startCol = scrollOffset % streamW;
    let currentW = 0;
    line2 = "";
    
    // Repeat stream to ensure we have enough content to fill 'cols'
    const repeated = [...stream, ...stream, ...stream]; 
    let skipW = startCol;
    let started = false;

    for (const item of repeated) {
      let text = item.text;
      if (!started) {
        const itemW = visibleWidth(text);
        if (skipW >= itemW) {
          skipW -= itemW;
          continue;
        }
        // Start within this item: find char offset corresponding to skipW
        let charIdx = 0;
        let wSkipped = 0;
        for (const char of text) {
          const cw = visibleWidth(char);
          if (wSkipped + cw > skipW) break;
          wSkipped += cw;
          charIdx += char.length;
        }
        text = text.slice(charIdx);
        started = true;
      }
      
      let toAdd = "";
      for (const char of text) {
        const cw = visibleWidth(char);
        if (currentW + cw > cols) break;
        toAdd += char;
        currentW += cw;
      }
      line2 += item.color ? paint(item.color, toAdd) : toAdd;
      if (currentW >= cols) break;
    }
    line2 += "\x1b[K"; // Fill remaining space with EL
  }

  // Use a strictly safe row index (never beyond terminal height)
  const r0 = Math.max(1, realRows - 2); // The gap line
  const r1 = Math.max(1, realRows - 1);
  const r2 = realRows;

  // \x1b[?7l = Disable wrap, \x1b[?25l = Hide cursor
  // \x1b[?7h = Enable wrap, \x1b[?25h = Show cursor
  return (
    "\x1b7" +     // Save cursor
    "\x1b[?7l" +  // Disable auto-wrap
    "\x1b[?25l" + // Hide cursor
    `\x1b[${r0};1H` + ansi.clearLine + 
    `\x1b[${r1};1H` + ansi.clearLine + line1 +
    `\x1b[${r2};1H` + ansi.clearLine + line2 +
    "\x1b[?25h" + // Show cursor
    "\x1b[?7h" +  // Enable auto-wrap
    "\x1b8"       // Restore cursor
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
  renderSparkline,
  renderStatusBar,
};

export default ui;
