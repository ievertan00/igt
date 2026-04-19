import fs from "fs";
import path from "path";
import readline from "readline";
import initializeLLMProviders from "../lib/llm-init.mjs";

const VAULT_DIR = "D:\\Library\\-06ObsidianVault\\02_Knowledge\\IGT_Data_Warehouse";
const NOTE_FILE = path.join(VAULT_DIR, "IGT Vocabulary.md");

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const c = {
  reset:    "\x1b[0m",
  bold:     "\x1b[1m",
  cyan:     "\x1b[36m",
  yellow:   "\x1b[33m",
  green:    "\x1b[32m",
  darkCyan: "\x1b[96m",
  gray:     "\x1b[90m",
  white:    "\x1b[97m",
};
const paint = (color, text) => `${color}${text}${c.reset}`;

// ── Spinner ───────────────────────────────────────────────────────────────────
const FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
let spinnerTimer = null;
let spinnerIdx = 0;

function startSpinner(msg) {
  process.stdout.write("\n");
  spinnerTimer = setInterval(() => {
    process.stdout.write(`\r  ${paint(c.cyan, FRAMES[spinnerIdx++ % FRAMES.length])}  ${paint(c.gray, msg)}`);
  }, 80);
}

function stopSpinner() {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
    process.stdout.write("\r\x1b[2K");
  }
}

// ── Prompt helper ─────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function abort(msg = "Cancelled.") {
  stopSpinner();
  rl.close();
  console.log(`\n  ${paint(c.gray, msg)}\n`);
  process.exit(0);
}

rl.on("SIGINT", () => abort());
process.on("SIGINT", () => abort());

function ask(prompt) {
  return new Promise((resolve, reject) => {
    rl.question(prompt, ans => resolve(ans.trim()));
  });
}

// ── Parse LLM output ─────────────────────────────────────────────────────────
function parseEntry(raw) {
  const get = (key) => {
    const m = raw.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`));
    return m ? m[1].trim() : null;
  };
  const wordMatch = raw.match(/^###?\s*(.+)/m);
  return {
    word:    wordMatch ? wordMatch[1].trim() : null,
    pos:     get("PoS"),
    meaning: get("Meaning"),
    zh:      get("中文"),
    example: get("Example"),
    note:    get("Note"),
  };
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderEntry(f) {
  const label = (t) => paint(c.gray, t.padEnd(10));
  const SEP   = paint(c.gray, "  ──────────────────────────────────────────");
  console.log(SEP);
  if (f.word)    console.log(`  ${label("Word")}${paint(c.bold + c.yellow, f.word)}`);
  if (f.pos)     console.log(`  ${label("PoS")}${paint(c.gray, f.pos)}`);
  if (f.meaning) console.log(`  ${label("Meaning")}${paint(c.white, f.meaning)}`);
  if (f.zh)      console.log(`  ${label("中文")}${paint(c.green, f.zh)}`);
  if (f.example) console.log(`  ${label("Example")}${paint(c.cyan, f.example)}`);
  if (f.note)    console.log(`  ${label("Note")}${paint(c.darkCyan, f.note)}`);
  console.log(SEP);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const word = process.argv.slice(2).join(" ").trim();

if (!word) {
  console.error(`\n  ${paint(c.yellow, "Usage: /vocab <word or phrase>")}\n`);
  process.exit(1);
}

const SYSTEM_PROMPT = `You are a concise English vocabulary assistant. When given a word or phrase, output a vocabulary entry in exactly this markdown format with no extra text:

### {word}
**PoS:** {part of speech}
**Meaning:** {one-line definition in English}
**中文:** {concise Chinese translation or explanation}
**Example:** {one natural sentence using the word}
**Note:** {one short usage tip or common mistake}`;

const llmManager = initializeLLMProviders();

startSpinner("Looking up vocabulary…");
let raw;
try {
  raw = await llmManager.generateWithFallback(word, SYSTEM_PROMPT, { taskType: "grammar" });
} catch (err) {
  stopSpinner();
  console.error(`\n  ${paint(c.yellow, "Error:")} ${err.message}\n`);
  rl.close();
  process.exit(1);
}
stopSpinner();

const fields = parseEntry(raw.trim());
console.log("");
renderEntry(fields);
console.log("");

// ── Step 1: confirm save ──────────────────────────────────────────────────────
const saveAns = await ask(`  ${paint(c.gray, "Save to vault?")} ${paint(c.white, "[Y/n]")}  `);
if (saveAns.toLowerCase() === "n") {
  console.log(`\n  ${paint(c.gray, "Discarded.")}\n`);
  rl.close();
  process.exit(0);
}

// ── Step 2: optional memory hook ─────────────────────────────────────────────
console.log("");
const hook = await ask(`  ${paint(c.gray, "Memory hook?")} ${paint(c.gray, "(press Enter to skip)")}  `);
rl.close();

// ── Build markdown block ──────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
let mdBlock = `\n${raw.trim()}\n`;
if (hook) mdBlock += `**Memory:** ${hook}\n`;
mdBlock += `*Added: ${today}*\n`;

if (!fs.existsSync(NOTE_FILE)) {
  fs.writeFileSync(NOTE_FILE, "# IGT Vocabulary\n", "utf8");
}
fs.appendFileSync(NOTE_FILE, mdBlock, "utf8");

console.log(`\n  ${paint(c.green, "✓")} ${paint(c.gray, "Saved to")} ${paint(c.white, "IGT Vocabulary.md")}\n`);
