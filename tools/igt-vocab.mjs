import fs from "fs";
import path from "path";
import readline from "readline";
import { ui, paint, colors } from "../lib/ui.mjs";

const NOTE_FILE = "D:\\Library\\-06ObsidianVault\\02_Knowledge\\IGT_Data_Warehouse\\IGT Vocabulary.md";

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
function renderEntry(f) {
  const label = (t) => paint(colors.gray, t.padEnd(10));
  let content = "";
  
  if (f.pos)     content += `  ${label("PoS")}${paint(colors.gray, f.pos)}\n`;
  if (f.meaning) content += `  ${label("Meaning")}${paint(colors.white, f.meaning)}\n`;
  if (f.zh)      content += `  ${label("中文")}${paint(colors.green, f.zh)}\n`;
  if (f.example) content += `  ${label("Example")}${paint(colors.cyan, f.example)}\n`;
  if (f.note)    content += `  ${label("Note")}${paint(colors.brightCyan, f.note)}\n`;
  if (f.memory)  content += `  ${label("Memory")}${paint(colors.yellow, f.memory)}\n`;
  if (f.added)   content += `  ${label("Added")}${paint(colors.gray, f.added)}`;

  console.log(ui.box(paint(colors.bold + colors.yellow, f.word), content.trimEnd(), { width: 70 }));
}

// ── Main ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const entries = parseAllEntries();

if (entries.length === 0) {
  console.log(`\n  ${paint(colors.yellow, "No vocabulary saved yet.")}  Use ${paint(colors.cyan, "/add <word>")} to add words.\n`);
  process.exit(0);
}

// ── List mode ─────────────────────────────────────────────────────────────────
if (args.includes("--list") || args.includes("list")) {
  ui.header("Vocabulary", `${entries.length} word(s) saved`);
  console.log("");
  for (const e of entries) {
    renderEntry(e);
    console.log("");
  }
  process.exit(0);
}

// ── Quiz mode ─────────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

rl.on("SIGINT", () => {
  console.log(`\n  ${paint(colors.gray, "Quiz ended.")}\n`);
  rl.close();
  process.exit(0);
});

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function runQuiz() {
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  ui.header("Vocabulary Quiz", `${shuffled.length} word(s) · Ctrl+C to quit`);

  let known = 0;
  const missed = [];

  for (let i = 0; i < shuffled.length; i++) {
    const e = shuffled[i];
    const label = (t) => paint(colors.gray, t.padEnd(10));
    let content = "";
    
    if (e.meaning) content += `  ${label("Meaning")}${paint(colors.white, e.meaning)}\n`;
    if (e.zh)      content += `  ${label("中文")}${paint(colors.green, e.zh)}\n`;
    if (e.example) content += `  ${label("Example")}${paint(colors.cyan, e.example)}\n`;
    if (e.note)    content += `  ${label("Note")}${paint(colors.brightCyan, e.note)}\n`;
    if (e.memory)  content += `  ${label("Memory")}${paint(colors.yellow, e.memory)}`;

    console.log(`\n  ${paint(colors.gray, `${i + 1} / ${shuffled.length}`)}  ${paint(colors.bold + colors.yellow, e.word)}  ${paint(colors.gray, e.pos || "")}`);
    console.log("");
    
    const reveal = await ask(`  ${paint(colors.gray, "Your meaning? (Enter to reveal)")}  `);
    process.stdout.write("\x1b[1A\x1b[2K");
    
    console.log(ui.box(paint(colors.bold + colors.yellow, e.word), content.trimEnd(), { width: 70 }));
    console.log("");

    const grade = await ask(`  ${paint(colors.gray, "Did you know it?")} ${paint(colors.white, "[y/n]")}  `);
    if (grade.trim().toLowerCase() !== "n") {
      known++;
      console.log(`  ${paint(colors.green, "✓ Got it")}`);
    } else {
      missed.push(e);
      console.log(`  ${paint(colors.yellow, "✗ Review again")}`);
    }
  }

  // Summary
  const pct = Math.round((known / shuffled.length) * 100);
  console.log("");
  ui.header("Quiz Result", `${known} / ${shuffled.length} (${pct}%)`);
  
  if (missed.length > 0) {
    console.log(`\n  ${paint(colors.yellow, "Words to revisit:")}`);
    for (const e of missed) console.log(`    ${paint(colors.yellow, e.word)}  ${paint(colors.gray, e.meaning || "")}`);
  }
  
  console.log("");
  if      (pct === 100) console.log(`  ${paint(colors.green, "Perfect round!")}`);
  else if (pct >= 80)   console.log(`  ${paint(colors.green, "Great work — keep it up.")}`);
  else if (pct >= 50)   console.log(`  ${paint(colors.yellow, "Getting there. Review the ones you missed.")}`);
  else                  console.log(`  ${paint(colors.yellow, "Keep practicing — repetition is the key.")}`);
  console.log("");
  rl.close();
}

runQuiz().then(() => process.exit(0));
