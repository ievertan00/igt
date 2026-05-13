// Base colors correspond to standard terminal colors (auto)
export const baseColors = {
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

// Helper for RGB Foreground
export function rgb(r, g, b) {
  return `\x1b[38;2;${r};${g};${b}m`;
}

export const themes = {
  auto: { ...baseColors },
  dark: {
    ...baseColors,
    yellow: rgb(249, 241, 165),
    green: rgb(22, 198, 12),
    cyan: rgb(59, 142, 234),
    magenta: rgb(180, 0, 158),
    blue: rgb(59, 120, 255),
    gray: rgb(118, 118, 118),
    brightCyan: rgb(59, 142, 234),
  },
  light: {
    ...baseColors,
    yellow: rgb(193, 156, 0),
    green: rgb(0, 128, 0),
    cyan: rgb(0, 128, 128),
    magenta: rgb(128, 0, 128),
    blue: rgb(0, 0, 255),
    gray: rgb(128, 128, 128),
    brightCyan: rgb(0, 128, 128),
  },
  solarized: {
    ...baseColors,
    yellow: rgb(181, 137, 0),
    green: rgb(133, 153, 0),
    cyan: rgb(42, 161, 152),
    magenta: rgb(211, 54, 130),
    blue: rgb(38, 139, 210),
    gray: rgb(88, 110, 117),
    brightCyan: rgb(42, 161, 152),
  },
  obsidian: {
    ...baseColors,
    yellow: rgb(238, 193, 46),
    green: rgb(67, 181, 129),
    cyan: rgb(0, 176, 244),
    magenta: rgb(185, 187, 190),
    blue: rgb(114, 137, 218),
    gray: rgb(114, 118, 125),
    brightCyan: rgb(0, 176, 244),
  },
  vscode: {
    ...baseColors,
    yellow: rgb(220, 220, 170),
    green: rgb(106, 153, 85),
    cyan: rgb(79, 193, 255),
    magenta: rgb(197, 134, 192),
    blue: rgb(86, 156, 214),
    gray: rgb(128, 128, 128),
    brightCyan: rgb(79, 193, 255),
  }
};
