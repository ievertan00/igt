import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import configLoader from "../lib/config-loader.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const config = configLoader.load();
const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);

if (!fs.existsSync(resolvedDbPath)) {
  console.error("Error: Database file not found. Run IGT first to collect data.");
  process.exit(1);
}

const db = new Database(resolvedDbPath);

// Ensure vocab table exists (in case server hasn't run yet)
db.exec(`
  CREATE TABLE IF NOT EXISTS vocab (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input_id INTEGER,
    original_word TEXT NOT NULL,
    better_word TEXT NOT NULL,
    context TEXT,
    explanation TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    quiz_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_vocab_quiz ON vocab(quiz_count, correct_count);
`);

const args = process.argv.slice(2);

// ── List mode ──────────────────────────────────────────────────────────────────
if (args.includes("--list")) {
  const items = db.prepare("SELECT * FROM vocab ORDER BY added_at DESC LIMIT 50").all();
  if (items.length === 0) {
    console.log("\n📚 No vocabulary items saved yet.");
    console.log("   Word Choice and Idiomatic Expression errors are auto-saved here during grammar checks.\n");
  } else {
    console.log(`\n📚 Vocabulary List (${items.length} saved)\n`);
    for (const item of items) {
      const acc = item.quiz_count > 0
        ? `${Math.round((item.correct_count / item.quiz_count) * 100)}% (${item.quiz_count} quizzes)`
        : "not quizzed yet";
      console.log(`  ❌ "${item.original_word}"  →  ✅ "${item.better_word}"`);
      console.log(`     Context:  "${item.context}"`);
      if (item.explanation) console.log(`     Note:     ${item.explanation}`);
      console.log(`     Accuracy: ${acc}\n`);
    }
  }
  db.close();
  process.exit(0);
}

// ── Quiz mode ──────────────────────────────────────────────────────────────────
// Prioritise: never-quizzed first, then lowest accuracy, then oldest
const items = db.prepare(`
  SELECT * FROM vocab
  WHERE better_word IS NOT NULL AND original_word IS NOT NULL
  ORDER BY
    quiz_count ASC,
    CASE WHEN quiz_count > 0 THEN CAST(correct_count AS REAL) / quiz_count ELSE 1 END ASC,
    added_at ASC
  LIMIT 20
`).all();

if (items.length === 0) {
  console.log("\n📚 No vocabulary items yet.");
  console.log("   Run some grammar checks — Word Choice errors are automatically saved here.");
  console.log("   Use 'vocab --list' to see your saved words.\n");
  db.close();
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function runQuiz() {
  console.log("\n" + "=".repeat(52));
  console.log("  📚 IGT Vocabulary Builder");
  console.log("=".repeat(52));
  console.log(`\n  ${items.length} word(s) to review.\n`);

  let correct = 0;
  const missed = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    console.log("─".repeat(52));
    console.log(`  📖 ${i + 1} / ${items.length}`);
    console.log(`\n  Context:  "${item.context}"`);
    console.log(`\n  Original: "${item.original_word}"`);

    const answer = await ask("\n  Better word/phrase? > ");
    const isCorrect = answer.trim().toLowerCase() === item.better_word.trim().toLowerCase();

    if (isCorrect) {
      correct++;
      console.log(`\n  ✅ Correct!  →  "${item.better_word}"`);
    } else {
      missed.push(item);
      console.log(`\n  ❌ Not quite.  Answer: "${item.better_word}"`);
    }

    if (item.explanation) {
      console.log(`  💡 ${item.explanation}`);
    }
    console.log("");

    db.prepare(`
      UPDATE vocab SET quiz_count = quiz_count + 1, correct_count = correct_count + ?
      WHERE id = ?
    `).run(isCorrect ? 1 : 0, item.id);
  }

  // Summary
  const pct = Math.round((correct / items.length) * 100);
  console.log("=".repeat(52));
  console.log(`  📊 Score: ${correct} / ${items.length}  (${pct}%)`);

  if (missed.length > 0) {
    console.log("\n  📝 Review these:\n");
    for (const item of missed) {
      console.log(`  ❌ "${item.original_word}"  →  ✅ "${item.better_word}"`);
    }
  }

  console.log("");
  if      (pct === 100) console.log("  🌟 Perfect round!");
  else if (pct >= 80)   console.log("  👍 Great work — keep it up.");
  else if (pct >= 50)   console.log("  💪 Getting there. Review the ones you missed.");
  else                  console.log("  📚 Keep practicing — repetition is the key.");

  console.log("");
  rl.close();
  db.close();
}

runQuiz().then(() => process.exit(0));
