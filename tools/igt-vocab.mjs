import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import configLoader from "../lib/shared/config-loader.mjs";
import { ui, paint, colors, wrapText, wrapCJK, currentTheme, applyTheme } from "../lib/cli/ui/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const config = configLoader.load();
applyTheme(config.Theme || "auto");

const baseDir = config.VaultDir 
  ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
  : path.join(projectRoot, "docs");

const VOCAB_FILE = config.VocabFile || "IGT Vocabulary.md";
const NOTE_FILE = path.isAbsolute(VOCAB_FILE) ? VOCAB_FILE : path.join(baseDir, VOCAB_FILE);

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
    word:         wordMatch ? wordMatch[1].trim() : null,
    pos:          get("PoS"),
    meaning:      get("Meaning"),
    zh:           get("中文"),
    synonyms:     get("Synonyms"),
    collocations: get("Collocations"),
    example1:     get("Example 1"),
    example2:     get("Example 2"),
    example3:     get("Example 3"),
    example:      get("Example"),   // backward compat
    note:         get("Note"),
    memory:       get("Memory"),
    added:        dateMatch ? dateMatch[1].trim() : null,
  };
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderEntry(f) {
  const lines = [];
  const isLight = (currentTheme === "light" || currentTheme.endsWith("light") || currentTheme.endsWith("latte") || currentTheme === "academic");
  const dimColor = isLight ? colors.blue : colors.gray;
  const valueColor = isLight ? colors.black : colors.white;

  // Word (Bold & Yellow, lowercase)
  lines.push(paint(colors.bold + colors.yellow, f.word.toLowerCase()));

  // POS & IPA
  if (f.pos) {
    let posLine = "";
    if (f.pos.includes("·")) {
      const parts = f.pos.split("·").map(s => s.trim());
      const part = parts[0];
      const ipa = parts.slice(1).join(" · ");
      posLine = `${paint(colors.magenta, part)} ${paint(dimColor, "·")} ${paint(dimColor, ipa)}`;
    } else if (f.pos.includes("/")) {
      const slashIdx = f.pos.indexOf("/");
      if (slashIdx > 0) {
        const part = f.pos.slice(0, slashIdx).replace(/·/g, "").trim();
        const ipa = f.pos.slice(slashIdx).trim();
        posLine = `${paint(colors.magenta, part)} ${paint(dimColor, "·")} ${paint(dimColor, ipa)}`;
      } else {
        posLine = paint(colors.magenta, f.pos);
      }
    } else {
      posLine = paint(colors.magenta, f.pos);
    }
    lines.push(posLine);
  }

  // Meaning
  if (f.meaning) {
    lines.push("");
    const label = "Meaning:  ";
    const labelLen = 10;
    const wrapped = wrapText(f.meaning, 62 - labelLen, labelLen);
    const wlines = wrapped.split("\n");
    for (let i = 0; i < wlines.length; i++) {
      if (i === 0) lines.push(paint(dimColor, label) + paint(valueColor, wlines[i]));
      else lines.push(paint(valueColor, wlines[i]));
    }
  }

  // Chinese explanation (中文)
  if (f.zh) {
    lines.push("");
    const label = "中文:  ";
    const labelLen = 7;
    const wrapped = wrapCJK(f.zh, 62 - labelLen, labelLen);
    const wlines = wrapped.split("\n");
    for (let i = 0; i < wlines.length; i++) {
      if (i === 0) lines.push(paint(dimColor, label) + paint(colors.green, wlines[i]));
      else lines.push(paint(colors.green, wlines[i]));
    }
  }

  // Examples (Italic, quoted, dimColor)
  const exList = [f.example1, f.example2, f.example3].filter(Boolean);
  if (!exList.length && f.example) exList.push(f.example);
  if (exList.length) {
    lines.push("");
    for (const ex of exList) {
      const wrappedEx = ex.startsWith('"') && ex.endsWith('"') ? ex : `"${ex}"`;
      for (const wl of wrapText(wrappedEx, 62, 0).split("\n"))
        lines.push(paint(dimColor + colors.italic, wl));
    }
  }

  // Collocations
  if (f.collocations) {
    lines.push("");
    const label = "Collocations:  ";
    const labelLen = 15;
    const wrapped = wrapText(f.collocations, 62 - labelLen, labelLen);
    const wlines = wrapped.split("\n");
    for (let i = 0; i < wlines.length; i++) {
      if (i === 0) lines.push(paint(dimColor, label) + paint(colors.brightMagenta, wlines[i]));
      else lines.push(paint(colors.brightMagenta, wlines[i]));
    }
  }

  // Synonyms
  if (f.synonyms) {
    lines.push("");
    const label = "Synonyms:  ";
    const labelLen = 11;
    const wrapped = wrapText(f.synonyms, 62 - labelLen, labelLen);
    const wlines = wrapped.split("\n");
    for (let i = 0; i < wlines.length; i++) {
      if (i === 0) lines.push(paint(dimColor, label) + paint(colors.cyan, wlines[i]));
      else lines.push(paint(colors.cyan, wlines[i]));
    }
  }

  // Note
  if (f.note) {
    lines.push("");
    const label = "Note:  ";
    const labelLen = 7;
    const wrapped = wrapText(f.note, 62 - labelLen, labelLen);
    const wlines = wrapped.split("\n");
    for (let i = 0; i < wlines.length; i++) {
      if (i === 0) lines.push(paint(dimColor, label) + paint(colors.brightCyan, wlines[i]));
      else lines.push(paint(colors.brightCyan, wlines[i]));
    }
  }

  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  console.log(ui.box("", lines.join("\n"), { width: 70, color: colors.blue }));
}

// ── Main ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const entries = parseAllEntries();

// ── Lookup mode ───────────────────────────────────────────────────────────────
const lookupIdx = args.indexOf("--lookup");
if (lookupIdx !== -1) {
  const word = args[lookupIdx + 1]?.toLowerCase();
  if (word) {
    process.stdout.write(`\n  ${paint(colors.gray, "Retrieving from vault…")} `);
    const found = entries.find(e => e.word?.toLowerCase() === word);
    if (found) {
      process.stdout.write(paint(colors.green, "found\n\n"));
      renderEntry(found);
      console.log("");
    } else {
      process.stdout.write(paint(colors.yellow, "not found\n\n"));
      process.stdout.write(`  ${paint(colors.gray, `"${word}" isn't saved yet. Use /add ${word} to look it up.\n\n`)}`);
    }
  }
  process.exit(0);
}

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

    console.log(`\n  ${paint(colors.gray, `${i + 1} / ${shuffled.length}`)}  ${paint(colors.bold + colors.yellow, e.word)}  ${paint(colors.gray, e.pos || "")}`);
    console.log("");

    const reveal = await ask(`  ${paint(colors.gray, "Your meaning? (Enter to reveal)")}  `);
    process.stdout.write("\x1b[1A\x1b[2K");

    renderEntry(e);
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
