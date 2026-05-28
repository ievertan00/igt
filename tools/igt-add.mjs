import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import Database from "better-sqlite3";
import initializeLLMProviders, { configLoader } from "../lib/server/llm/init.mjs";
import { ui, paint, colors, Spinner, wrapText, currentTheme, applyTheme } from "../lib/cli/ui/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const config = configLoader.load();
applyTheme(config.Theme || "auto");
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
    const wrapped = wrapText(f.zh, 62 - labelLen, labelLen);
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
const word = process.argv.slice(2).join(" ").trim();

if (!word) {
  console.error(`\n  ${paint(colors.yellow, "Usage: /add <word or phrase>  (or /add word1, word2, …)")}\n`);
  process.exit(1);
}

const SYSTEM_PROMPT = `You are a concise English vocabulary assistant. When given a word or phrase, output a vocabulary entry in exactly this markdown format with no extra text:

### {word}
**PoS:** {part of speech, followed by a middle dot '·' and the IPA phonetic symbol (e.g., adjective · /ɪˈfem.ər.ral/)}
**Meaning:** {one-line definition in English}
**中文:** {concise Chinese translation or explanation}
**Synonyms:** {3–5 close synonyms, comma-separated}
**Collocations:** {3–5 common collocations or fixed phrases, semicolon-separated}
**Example 1:** {a natural sentence using the word}
**Example 2:** {another natural sentence in a different context}
**Example 3:** {another natural sentence showing a different usage or register}
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
    const existing = db.prepare(
      `SELECT COUNT(*) AS n FROM srs_cards WHERE source_type = 'vocab' AND word = ?`
    ).get(fields.word).n;
    if (existing === 0) {
      db.prepare(`
        INSERT INTO srs_cards
          (source_type, source_id, prompt, answer, due_date, word, pos, zh, meaning, example, note)
        VALUES ('vocab', NULL, ?, ?, date('now'), ?, ?, ?, ?, ?, ?)
      `).run(
        fields.word, fields.word,
        fields.word, fields.pos || "", fields.zh || "",
        fields.meaning || "", fields.example1 || fields.example || "", fields.note || ""
      );
      console.log(`  ${paint(c.green, "✓")} ${paint(c.gray, "SRS vocab card added for review")}`);
    }
    db.close();
  } catch {}
}
console.log("");

rl.close();
