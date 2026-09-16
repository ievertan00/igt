// Semantic ANSI colors only. IGT never changes the terminal's own background
// or foreground, so it remains safe to use in any terminal profile.
export const baseColors = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", italic: "\x1b[3m",
  underline: "\x1b[4m", inverse: "\x1b[7m",
  black: "\x1b[30m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m",
  gray: "\x1b[90m", brightRed: "\x1b[91m", brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m", brightBlue: "\x1b[94m", brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m", brightWhite: "\x1b[97m",
  bgBlack: "\x1b[40m", bgRed: "\x1b[41m", bgGreen: "\x1b[42m", bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m", bgMagenta: "\x1b[45m", bgCyan: "\x1b[46m", bgWhite: "\x1b[47m",
};

const rgb = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;

export const themes = {
  // Default palette for the warm light terminal surface used by IGT.
  auto: {
    ...baseColors,
    // Tuned for IGT's warm light terminal surface: cool ink keeps the
    // vocabulary UI legible while preserving its blue/purple character.
    gray: rgb(74, 77, 88),
    red: rgb(176, 49, 54),
    green: rgb(30, 112, 73),
    yellow: rgb(132, 85, 0),
    blue: rgb(65, 91, 184),
    cyan: rgb(20, 113, 166),
    magenta: rgb(112, 77, 176),
    brightCyan: rgb(20, 113, 166),
    statusFg: rgb(46, 49, 62),
    statusAccent: rgb(137, 215, 238),
    statusMuted: rgb(208, 211, 230),
  },
  // Bright accents are readable on common dark terminal profiles.
  dark: {
    ...baseColors,
    red: baseColors.brightRed,
    green: baseColors.brightGreen,
    yellow: baseColors.brightYellow,
    blue: baseColors.brightBlue,
    magenta: baseColors.brightMagenta,
    cyan: baseColors.brightCyan,
    statusFg: baseColors.brightWhite,
    statusAccent: baseColors.brightCyan,
    statusMuted: baseColors.white,
  },
  // Standard dark ANSI accents are readable on common light profiles.
  light: {
    ...baseColors,
    gray: baseColors.black,
    statusFg: baseColors.black,
    statusAccent: baseColors.cyan,
    statusMuted: baseColors.black,
  },
};
