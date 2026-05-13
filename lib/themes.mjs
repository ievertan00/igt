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

// Helper for RGB Background
export function rgbBg(r, g, b) {
  return `\x1b[48;2;${r};${g};${b}m`;
}

export const themes = {
  // auto: follows terminal defaults; status bar uses standard reverse-video
  auto: {
    ...baseColors,
    statusBg: baseColors.bgWhite,
    statusFg: baseColors.black,
    termBg:   null,  // OSC 111 will reset to terminal's configured default
  },
  // dark: Windows Terminal / iTerm2 dark profile colors
  dark: {
    ...baseColors,
    yellow:     rgb(249, 241, 165),
    green:      rgb( 22, 198,  12),
    cyan:       rgb( 59, 142, 234),
    magenta:    rgb(210,  80, 190),
    blue:       rgb( 59, 120, 255),
    red:        rgb(232,  78,  64),
    gray:       rgb(118, 118, 118),
    brightCyan: rgb( 97, 175, 255),
    statusBg:   rgbBg( 30,  30,  30),
    statusFg:   rgb(204, 204, 204),
    termBg:     "#121212",
  },
  // light: optimised for white/light-gray terminal backgrounds
  light: {
    ...baseColors,
    yellow:     rgb(160, 110,   0),
    green:      rgb(  0, 110,   0),
    cyan:       rgb(  0,  90, 140),
    magenta:    rgb(140,   0, 140),
    blue:       rgb(  0,  60, 200),
    red:        rgb(190,  30,  30),
    gray:       rgb( 90,  90,  90),
    brightCyan: rgb(  0,  90, 140),
    statusBg:   rgbBg(210, 210, 210),
    statusFg:   rgb( 30,  30,  30),
    termBg:     "#f8f8f2",
  },
  // solarized: Ethan Schoonover's Solarized Dark palette
  solarized: {
    ...baseColors,
    yellow:     rgb(181, 137,   0),
    green:      rgb(133, 153,   0),
    cyan:       rgb( 42, 161, 152),
    magenta:    rgb(211,  54, 130),
    blue:       rgb( 38, 139, 210),
    red:        rgb(220,  50,  47),
    gray:       rgb( 88, 110, 117),
    brightCyan: rgb( 42, 161, 152),
    statusBg:   rgbBg(  0,  43,  54),  // base03
    statusFg:   rgb(131, 148, 150),    // base0
    termBg:     "#002b36",             // Solarized base03 — distinctive deep teal
  },
  // obsidian: Discord / GitHub dark aesthetic
  obsidian: {
    ...baseColors,
    yellow:     rgb(250, 200,  60),
    green:      rgb( 67, 210, 140),
    cyan:       rgb(  0, 200, 255),
    magenta:    rgb(210, 100, 220),
    blue:       rgb(114, 137, 218),
    red:        rgb(240,  80,  80),
    gray:       rgb(114, 118, 125),
    brightCyan: rgb(  0, 200, 255),
    statusBg:   rgbBg( 32,  34,  37),  // Discord background
    statusFg:   rgb(220, 221, 222),
    termBg:     "#1a1b26",             // Tokyo Night-inspired dark blue-black
  },
  // vscode: VS Code Dark+ theme colors
  vscode: {
    ...baseColors,
    yellow:     rgb(220, 220, 170),
    green:      rgb(106, 153,  85),
    cyan:       rgb( 79, 193, 255),
    magenta:    rgb(197, 134, 192),
    blue:       rgb( 86, 156, 214),
    red:        rgb(244, 135, 113),
    gray:       rgb(106, 106, 106),
    brightCyan: rgb( 79, 193, 255),
    statusBg:   rgbBg(  0, 122, 204),  // VS Code status bar blue
    statusFg:   rgb(255, 255, 255),
    termBg:     "#1e1e1e",             // VS Code Dark+ exact background
  },
};
