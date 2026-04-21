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

export function box(title, content, options = {}) {
  const width = options.width || 60;
  const color = options.color || colors.gray;
  const padding = options.padding || 2;
  
  const top = paint(color, "┌─ " + title + " " + "─".repeat(Math.max(0, width - title.length - 4)) + "┐");
  const bottom = paint(color, "└" + "─".repeat(width - 2) + "┘");
  
  const lines = content.split("\n");
  const paddedLines = lines.map(line => {
    const visibleLength = line.replace(/\x1b\[[0-9;]*m/g, "").length;
    const rightPadding = " ".repeat(Math.max(0, width - visibleLength - 4));
    return paint(color, "│ ") + " ".repeat(padding) + line + rightPadding.slice(padding) + paint(color, " │");
  });
  
  return [top, ...paddedLines, bottom].join("\n");
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
  Spinner,
  header
};

export default ui;
