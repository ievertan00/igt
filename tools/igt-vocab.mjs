import fs from "fs";
import path from "path";
import readline from "readline";

const NOTE_FILE = "D:\\Library\\-06ObsidianVault\\02_Knowledge\\IGT_Data_Warehouse\\IGT Vocabulary.md";

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

// ── Parse all entries from the vault file ─────────────────────────────────────
function parseAllEntries() {
  if (!fs.existsSync(NOTE_FILE)) return [];
  const content = fs.readFileSync(NOTE_FILE, "utf8");
  const lines = content.split("\n");
  const entries = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^###?\s+(.+)/);
    if (m) {
      const block = [lines[i]];
      i++;
      while (i < lines.length && !/^###?\s+/.test(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      entries.push(parseEntry(block.join("\n")));
    } else {
      i++;
    }
  }
  return entries.filter(e => e.word);
}

function parseEntry(raw) {
  const get = (key) => {
    const m = raw.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`));
    return m ? m[1].trim() : null;
  };
  const wordMatch = raw.match(/^###?\s*(.+)/m);
  const dateMatch = raw.match(/\*Added:\s*(.+?)\*/);
  return {
    word:    wordMatch ? wordMatch[1].trim() : null,
    pos:     get("PoS"),
    meaning: get("Meaning"),
    zh:      get("中文"),
    example: get("Example"),
    note:    get("Note"),
    memory:  get("Memory"),
    added:   dateMatch ? dateMatch[1].trim() : null,
  };
}

// ── Render ────────────────────────────────────────────────────────────────────
const SEP = paint(c.gray, "  ──────────────────────────────────────────");

function renderEntry(f) {
  const label = (t) => paint(c.gray, t.padEnd(10));
  console.log(SEP);
  if (f.word)    console.log(`  ${label("Word")}${paint(c.bold + c.yellow, f.word)}`);
  if (f.pos)     console.log(`  ${label("PoS")}${paint(c.gray, f.pos)}`);
  if (f.meaning) console.log(`  ${label("Meaning")}${paint(c.white, f.meaning)}`);
  if (f.zh)      console.log(`  ${label("中文")}${paint(c.green, f.zh)}`);
  if (f.example) console.log(`  ${label("Example")}${paint(c.cyan, f.example)}`);
  if (f.note)    console.log(`  ${label("Note")}${paint(c.darkCyan, f.note)}`);
  if (f.memory)  console.log(`  ${label("Memory")}${paint(c.yellow, f.memory)}`);
  if (f.added)   console.log(`  ${label("Added")}${paint(c.gray, f.added)}`);
  console.log(SEP);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const entries = parseAllEntries();

if (entries.length === 0) {
  console.log(`\n  ${paint(c.yellow, "No vocabulary saved yet.")}  Use ${paint(c.cyan, "/add <word>")} to add words.\n`);
  process.exit(0);
}

// ── List mode ─────────────────────────────────────────────────────────────────
if (args.includes("--list") || args.includes("list")) {
  console.log(`\n  ${paint(c.bold + c.white, `Vocabulary — ${entries.length} word(s)`)}\n`);
  for (const e of entries) renderEntry(e);
  console.log("");
  process.exit(0);
}

// ── Quiz mode ─────────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

rl.on("SIGINT", () => {
  console.log(`\n  ${paint(c.gray, "Quiz ended.")}\n`);
  rl.close();
  process.exit(0);
});

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function runQuiz() {
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  console.log(`\n  ${paint(c.bold + c.white, "Vocabulary Quiz")}  ${paint(c.gray, `${shuffled.length} word(s) · Ctrl+C to quit`)}\n`);

  let known = 0;
  const missed = [];

  for (let i = 0; i < shuffled.length; i++) {
    const e = shuffled[i];
    console.log(SEP);
    console.log(`  ${paint(c.gray, `${i + 1} / ${shuffled.length}`)}  ${paint(c.bold + c.yellow, e.word)}  ${paint(c.gray, e.pos || "")}`);
    console.log("");
    await ask(`  ${paint(c.gray, "Your meaning? (Enter to reveal)")}  `);
    process.stdout.write("\x1b[1A\x1b[2K");

    if (e.meaning) console.log(`  ${paint(c.gray, "Meaning".padEnd(10))}${paint(c.white, e.meaning)}`);
    if (e.zh)      console.log(`  ${paint(c.gray, "中文".padEnd(10))}${paint(c.green, e.zh)}`);
    if (e.example) console.log(`  ${paint(c.gray, "Example".padEnd(10))}${paint(c.cyan, e.example)}`);
    if (e.note)    console.log(`  ${paint(c.gray, "Note".padEnd(10))}${paint(c.darkCyan, e.note)}`);
    if (e.memory)  console.log(`  ${paint(c.gray, "Memory".padEnd(10))}${paint(c.yellow, e.memory)}`);
    console.log("");

    const grade = await ask(`  ${paint(c.gray, "Did you know it?")} ${paint(c.white, "[y/n]")}  `);
    if (grade.trim().toLowerCase() !== "n") {
      known++;
      console.log(`  ${paint(c.green, "✓ Got it")}\n`);
    } else {
      missed.push(e);
      console.log(`  ${paint(c.yellow, "✗ Review again")}\n`);
    }
  }

  // Summary
  const pct = Math.round((known / shuffled.length) * 100);
  console.log(SEP);
  console.log(`\n  ${paint(c.bold + c.white, "Score:")} ${paint(c.green, `${known} / ${shuffled.length}`)}  ${paint(c.gray, `(${pct}%)`)}`);
  if (missed.length > 0) {
    console.log(`\n  ${paint(c.yellow, "Words to revisit:")}`);
    for (const e of missed) console.log(`    ${paint(c.yellow, e.word)}  ${paint(c.gray, e.meaning || "")}`);
  }
  console.log("");
  if      (pct === 100) console.log(`  ${paint(c.green, "Perfect round!")}`);
  else if (pct >= 80)   console.log(`  ${paint(c.green, "Great work — keep it up.")}`);
  else if (pct >= 50)   console.log(`  ${paint(c.yellow, "Getting there. Review the ones you missed.")}`);
  else                  console.log(`  ${paint(c.yellow, "Keep practicing — repetition is the key.")}`);
  console.log("");
  rl.close();
}

runQuiz().then(() => process.exit(0));
