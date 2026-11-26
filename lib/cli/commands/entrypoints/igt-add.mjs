import readline from "readline";
import configLoader from "../../../../lib/shared/config-loader.mjs";
import { api } from "../../api-client.mjs";
import { ui, paint, colors, Spinner, wrapText, wrapCJK, currentTheme, applyTheme } from "../../../../lib/cli/ui/index.mjs";

const config = configLoader.load();
applyTheme(config.Theme || "auto");
const c = colors;

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

// ── Render ────────────────────────────────────────────────────────────────────
function renderEntry(f) {
  if (process.send && f.word) {
    process.send({ type: "english-expression", text: [f.word, f.example1 || f.example].filter(Boolean).join(". ") });
  }
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
const requestedWord = process.argv.slice(2).join(" ").trim();

if (!requestedWord) {
  console.error(`\n  ${paint(colors.yellow, "Usage: /add <word or phrase>  (or /add word1, word2, …)")}\n`);
  process.exit(1);
}

startSpinner("Looking up vocabulary…");
let result;
try {
  result = await api.lookupWord(requestedWord);
} catch (err) {
  stopSpinner();
  console.error(`\n  ${paint(c.yellow, "Error:")} ${err.message}\n`);
  rl.close();
  process.exit(1);
}
stopSpinner();

const entry = result.data;
if (result.translated) console.log(`\n  ${paint(c.gray, `Translated "${requestedWord}" to "${entry.word}".`)}`);

// Render into the shape the local terminal card expects.
const display = {
  word: entry.word,
  pos: [entry.pos, entry.phonetic].filter(Boolean).join(" · "),
  meaning: entry.meaning, zh: entry.zh, synonyms: entry.synonyms,
  collocations: entry.collocations, example1: entry.example, example2: entry.example2,
  example3: entry.example3, note: entry.note,
};

// The Runtime already checked saved entries, including canonicalized base forms.
if (result.existing) {
  console.log(`\n  ${paint(c.yellow, `"${entry.word}" is already in your vocabulary.`)}\n`);
  renderEntry(display);
  if (process.send && entry.word) {
    process.send({ type: "english-expression", text: [entry.word, entry.example].filter(Boolean).join(". ") });
  }
  console.log("");
  rl.close();
  process.exit(0);
}

console.log("");
renderEntry(display);
console.log("");

// ── Step 1: optional memory hook ─────────────────────────────────────────────
const hook = await ask(`  ${paint(c.gray, "Memory hook?")} ${paint(c.gray, "(press Enter to skip)")}  `);

// ── Step 2: confirm save ──────────────────────────────────────────────────────
console.log("");
const saveAns = await ask(`  ${paint(c.gray, "Save to vault?")} ${paint(c.white, "[Y/n]")}  `);
if (saveAns.toLowerCase() === "n") {
  console.log(`\n  ${paint(c.gray, "Discarded.")}\n`);
  rl.close();
  process.exit(0);
}
rl.close();

// The Runtime writes authoritative Markdown and creates the SRS card in one call.
let saved;
try {
  saved = await api.addWord({
    ...entry,
    note: [entry.note, hook ? `Memory: ${hook}` : ""].filter(Boolean).join("\n"),
  });
} catch (err) {
  console.error(`\n  ${paint(c.yellow, "Could not save entry:")} ${err.message}\n`);
  process.exit(1);
}
if (saved.persistence?.saved) {
  console.log(`\n  ${paint(c.green, "✓")} ${paint(c.gray, "Saved to")} ${paint(c.white, "IGT Vocabulary.md")}`);
  console.log(`  ${paint(c.green, "✓")} ${paint(c.gray, "SRS vocab card added for review")}`);
} else {
  console.log(`\n  ${paint(c.yellow, "Entry was not saved (already exists).")}`);
}
if (process.send && entry.word) {
  process.send({ type: "english-expression", text: [entry.word, entry.example].filter(Boolean).join(". ") });
}
console.log("");
