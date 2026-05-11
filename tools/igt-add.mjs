import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import Database from "better-sqlite3";
import initializeLLMProviders, { configLoader } from "../lib/llm/init.mjs";
import { ui, paint, colors, Spinner, wrapText } from "../lib/ui.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const config = configLoader.load();
const c = colors;

const baseDir = config.VaultDir 
  ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
  : path.join(projectRoot, "docs");

const VOCAB_FILE = config.VocabFile || "IGT Vocabulary.md";
const NOTE_FILE = path.isAbsolute(VOCAB_FILE) ? VOCAB_FILE : path.join(baseDir, VOCAB_FILE);

// ── Spinner ───────────────────────────────────────────────────────────────────
let currentSpinner = null;

function startSpinner(msg) {
  currentSpinner = new Spinner(msg);
  currentSpinner.start();
}

function stopSpinner() {
  if (currentSpinner) {
    currentSpinner.stop();
    currentSpinner = null;
  }
}

// ── Prompt helper ─────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function abort(msg = "Cancelled.") {
  stopSpinner();
  rl.close();
  console.log(`\n  ${paint(colors.gray, msg)}\n`);
  process.exit(0);
}

rl.on("SIGINT", () => abort());
process.on("SIGINT", () => abort());

function ask(prompt) {
  return new Promise((resolve, reject) => {
    rl.question(prompt, ans => resolve(ans.trim()));
  });
}

// ── Duplicate check ───────────────────────────────────────────────────────────
function findExistingEntry(word) {
  if (!fs.existsSync(NOTE_FILE)) return null;
  const content = fs.readFileSync(NOTE_FILE, "utf8");
  const lines = content.split("\n");
  const target = word.toLowerCase();
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^###?\s+(.+)/);
    if (m && m[1].trim().toLowerCase() === target) { startIdx = i; break; }
  }
  if (startIdx === -1) return null;
  const block = [];
  for (let i = startIdx; i < lines.length; i++) {
    if (i > startIdx && /^###?\s+/.test(lines[i])) break;
    block.push(lines[i]);
  }
  return block.join("\n");
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
const VFIELD_WIDTH = 52; // 70 box - 6 border/padding - 12 label prefix

function renderEntry(f) {
  const label = (t) => paint(colors.gray, t.padEnd(10));
  let content = "";

  if (f.pos)     content += `  ${label("PoS")}${paint(colors.gray, f.pos)}\n`;
  if (f.meaning) content += `  ${label("Meaning")}${paint(colors.white, wrapText(f.meaning, VFIELD_WIDTH, 12))}\n`;
  if (f.zh)      content += `  ${label("中文")}${paint(colors.green, f.zh)}\n`;
  if (f.example) content += `  ${label("Example")}${paint(colors.cyan, wrapText(f.example, VFIELD_WIDTH, 12))}\n`;
  if (f.note)    content += `  ${label("Note")}${paint(colors.brightCyan, wrapText(f.note, VFIELD_WIDTH, 12))}`;

  console.log(ui.box(paint(colors.bold + colors.yellow, f.word), content.trimEnd(), { width: 70 }));
}

// ── Main ──────────────────────────────────────────────────────────────────────
const word = process.argv.slice(2).join(" ").trim();

if (!word) {
  console.error(`\n  ${paint(colors.yellow, "Usage: /add <word or phrase>")}\n`);
  process.exit(1);
}

const SYSTEM_PROMPT = `You are a concise English vocabulary assistant. When given a word or phrase, output a vocabulary entry in exactly this markdown format with no extra text:

### {word}
**PoS:** {part of speech}
**Meaning:** {one-line definition in English}
**中文:** {concise Chinese translation or explanation}
**Example:** {one natural sentence using the word}
**Note:** {one short usage tip or common mistake}`;

// Check for duplicate before calling the LLM
const existingBlock = findExistingEntry(word);
if (existingBlock) {
  const existing = parseEntry(existingBlock);
  console.log(`\n  ${paint(c.yellow, `"${word}" is already in your vocabulary.`)}\n`);
  renderEntry(existing);
  console.log("");
  rl.close();
  process.exit(0);
}

const llmManager = initializeLLMProviders();
const activeProvider = llmManager.getCurrentProviderName();
const activeModel = llmManager.getCurrentProvider().getModelName(config, "grammar");

startSpinner(`Looking up vocabulary via ${paint(c.cyan, activeProvider)} (${paint(c.gray, activeModel)})…`);
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

console.log(`\n  ${paint(c.green, "✓")} ${paint(c.gray, "Saved to")} ${paint(c.white, "IGT Vocabulary.md")}`);

// Create two SM-2 SRS cards for this word (word→zh and zh→word directions)
if (fields.word && fields.zh) {
  const dbPath = config.DbPath || "igt_data.db";
  const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
  try {
    const db = new Database(resolvedDbPath);
    const mkPrompt = () => ["VOCAB",
      fields.word || "", fields.pos || "", fields.zh || "",
      fields.meaning || "", fields.example || "", fields.note || ""
    ].join("|||");
    db.prepare(`DELETE FROM srs_cards WHERE source_type='vocab' AND (prompt LIKE ? OR prompt LIKE ?)`)
      .run(`VOCAB|||word2zh|||${fields.word}|||%`, `VOCAB|||zh2word|||${fields.word}|||%`);
    const existing = db.prepare(
      `SELECT COUNT(*) AS n FROM srs_cards WHERE source_type='vocab' AND prompt LIKE ?`
    ).get(`VOCAB|||${fields.word}|||%`).n;
    if (existing === 0) {
      db.prepare(
        `INSERT INTO srs_cards (source_type, source_id, prompt, answer, due_date) VALUES ('vocab', 0, ?, ?, date('now'))`
      ).run(mkPrompt(), fields.word);
      console.log(`  ${paint(c.green, "✓")} ${paint(c.gray, "SRS vocab card added for review")}`);
    }
    db.close();
  } catch {}
}
console.log("");

rl.close();
