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
    termFg:     "#cccccc",
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
    termFg:     "#383a42",
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
    termFg:     "#839496",             // Solarized base0 — primary content text
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
    termFg:     "#dcddde",             // Discord text color
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
    termFg:     "#d4d4d4",             // VS Code editor text color
  },
  // tokyo-night: Tokyo Night theme colors
  "tokyo-night": {
    ...baseColors,
    yellow:     rgb(224, 175, 104),    // Warning
    green:      rgb(158, 206, 106),    // Secondary Accent
    cyan:       rgb(125, 207, 255),    // Cyan (#7dcfff)
    magenta:    rgb(187, 154, 247),    // Magenta (#bb9af7)
    blue:       rgb(122, 162, 247),    // Primary Accent
    red:        rgb(247, 118, 142),    // Error
    gray:       rgb( 86,  95, 137),    // Muted
    brightCyan: rgb(125, 207, 255),
    statusBg:   rgbBg( 65,  72, 104),  // Border
    statusFg:   rgb(192, 202, 245),    // Foreground
    termBg:     "#1a1b26",             // Background
    termFg:     "#c0caf5",             // Foreground
  },
  // catppuccin: Catppuccin Mocha theme colors
  catppuccin: {
    ...baseColors,
    yellow:     rgb(249, 226, 175),    // Yellow
    green:      rgb(166, 227, 161),    // Green
    cyan:       rgb(148, 226, 213),    // Teal (#94e2d5)
    magenta:    rgb(203, 166, 247),    // Mauve (#cba6f7)
    blue:       rgb(137, 180, 250),    // Blue
    red:        rgb(243, 139, 168),    // Red
    gray:       rgb(108, 112, 134),    // Overlay0 (#6c7086)
    brightCyan: rgb(148, 226, 213),
    statusBg:   rgbBg( 49,  50,  68),  // Surface
    statusFg:   rgb(205, 214, 244),    // Foreground
    termBg:     "#1e1e2e",             // Background
    termFg:     "#cdd6f4",             // Foreground
  },
  // gruvbox: Gruvbox Soft theme colors
  gruvbox: {
    ...baseColors,
    yellow:     rgb(250, 189,  47),    // Warning
    green:      rgb(184, 187,  38),    // Secondary
    cyan:       rgb(142, 192, 124),    // Aqua (#8ec07c)
    magenta:    rgb(211, 134, 155),    // Purple (#d3869b)
    blue:       rgb(131, 165, 152),    // Primary
    red:        rgb(251,  73,  52),    // Error
    gray:       rgb(146, 131, 116),    // Muted
    brightCyan: rgb(142, 192, 124),
    statusBg:   rgbBg( 80,  73,  69),  // Border
    statusFg:   rgb(235, 219, 178),    // Foreground
    termBg:     "#32302f",             // Background
    termFg:     "#ebdbb2",             // Foreground
  },
  // nord-light: Nord Light theme colors
  "nord-light": {
    ...baseColors,
    yellow:     rgb(235, 203, 139),    // Warning
    green:      rgb(163, 190, 140),    // Secondary Accent
    cyan:       rgb(129, 161, 193),    // Cyan/Muted
    magenta:    rgb(180, 142, 173),    // Purple (#B48EAD)
    blue:       rgb( 94, 129, 172),    // Primary Accent
    red:        rgb(191,  97, 106),    // Error
    gray:       rgb(129, 161, 193),    // Muted
    brightCyan: rgb(129, 161, 193),
    statusBg:   rgbBg(216, 222, 233),  // Border
    statusFg:   rgb( 46,  52,  64),    // Foreground
    termBg:     "#eceff4",             // Background
    termFg:     "#2e3440",             // Foreground
  },
  // tokyo-night-light: Tokyo Night Light theme colors
  "tokyo-night-light": {
    ...baseColors,
    yellow:     rgb(143,  94,  21),    // Warning
    green:      rgb( 51,  99,  92),    // Secondary Accent
    cyan:       rgb( 15,  98, 120),    // Tokyo Night Light Cyan (#0f6278)
    magenta:    rgb(152,  74, 164),    // Tokyo Night Light Purple (#984aa4)
    blue:       rgb( 52,  84, 138),    // Primary Accent
    red:        rgb(140,  67,  81),    // Error
    gray:       rgb(122, 129, 142),    // Muted
    brightCyan: rgb( 15,  98, 120),
    statusBg:   rgbBg(150, 153, 163),  // Border
    statusFg:   rgb( 52,  59,  88),    // Foreground
    termBg:     "#d5d6db",             // Background
    termFg:     "#343b58",             // Foreground
  },
  // catppuccin-latte: Catppuccin Latte theme colors
  "catppuccin-latte": {
    ...baseColors,
    yellow:     rgb(223, 142,  29),    // Yellow
    green:      rgb( 64, 160,  43),    // Green
    cyan:       rgb(  4, 164, 186),    // Teal (#04a4ba)
    magenta:    rgb(136,  57, 239),    // Mauve (#8839ef)
    blue:       rgb( 30, 102, 245),    // Blue
    red:        rgb(210,  15,  57),    // Red
    gray:       rgb(156, 160, 176),    // Overlay0 (#9ca0b0)
    brightCyan: rgb(  4, 164, 186),
    statusBg:   rgbBg(204, 208, 218),  // Surface
    statusFg:   rgb( 76,  79, 105),    // Foreground
    termBg:     "#eff1f5",             // Background
    termFg:     "#4c4f69",             // Foreground
  },
  // academic: Soft Academic Dark-on-Light theme colors
  academic: {
    ...baseColors,
    yellow:     rgb(160, 106,   0),    // Heading (Deep Ochre)
    green:      rgb( 46, 125,  50),    // Secondary Accent (Sage Green)
    cyan:       rgb( 59,  92, 204),    // Quote Text (Soft Indigo)
    magenta:    rgb( 59,  92, 204),    // Quote Text (Soft Indigo)
    blue:       rgb( 40,  85, 217),    // Accent Blue (Royal Blue)
    red:        rgb(210,  15,  57),    // Red (Standard High Contrast Red)
    gray:       rgb(154, 123, 216),    // Muted Text (Dusty Lavender)
    brightCyan: rgb( 59,  92, 204),
    statusBg:   rgbBg(110, 110, 110),  // Border (Warm Gray)
    statusFg:   rgb( 43,  43,  43),    // Main Text (Charcoal)
    termBg:     "#f7f4ed",             // Background (Warm Paper)
    termFg:     "#2b2b2b",             // Main Text (Charcoal)
  },
};
