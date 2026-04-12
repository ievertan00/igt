import initializeLLMProviders, { configLoader } from "../lib/llm-init.mjs";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// Load config via unified config loader and initialize LLM providers
const llmManager = initializeLLMProviders();
const config = llmManager.config;

// Load database
const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);

if (!fs.existsSync(resolvedDbPath)) {
  console.error("Error: Database file not found. Run IGT first to collect data.");
  process.exit(1);
}

const db = new Database(resolvedDbPath, { readonly: true });

// Parse arguments
const args = process.argv.slice(2);
const errorTypeArg = args.find(a => !a.startsWith("--"));
const countArg = args.find(a => a.startsWith("--count="));
const count = countArg ? parseInt(countArg.split("=")[1]) : 5;

// Get user's most common errors or specific error type
function getErrorTypes(errorType) {
  if (errorType) {
    const result = db.prepare(`
      SELECT d.error_type, COUNT(*) as count
      FROM diagnoses d
      JOIN inputs i ON d.input_id = i.id
      WHERE d.error_type LIKE '%' || ? || '%'
      GROUP BY d.error_type
      ORDER BY count DESC
      LIMIT 1
    `).get(errorType);
    return result ? [result] : [];
  } else {
    return db.prepare(`
      SELECT d.error_type, COUNT(*) as count
      FROM diagnoses d
      JOIN inputs i ON d.input_id = i.id
      GROUP BY d.error_type
      ORDER BY count DESC
      LIMIT 3
    `).all();
  }
}

// Generate exercises as structured JSON with answers
async function generateExercises(errorTypes, count) {
  const errorList = errorTypes.map(e => `- ${e.error_type}`).join("\n");

  // Load prompt from config or use default
  let prompt;
  if (config.Prompts && config.Prompts.PracticeExercisePrompt) {
    prompt = config.Prompts.PracticeExercisePrompt
      .replace(/\{\{count\}\}/g, count)
      .replace(/\{\{errorList\}\}/g, errorList);
  } else {
    // Fallback to inline prompt for backward compatibility
    prompt = `Generate ${count} grammar practice exercises focusing on these error types:
${errorList}

IMPORTANT RULES:
1. Create ENTIRELY NEW sentences. DO NOT use or reference any previous user input examples.
2. Each exercise must be either multiple-choice (4 options) or fill-in-the-blank.
3. Use common, everyday topics (e.g., work, school, travel, daily life).
4. Vary the difficulty slightly, starting easier.

Output Format (STRICT JSON, no other text):

[
  {
    "type": "multiple-choice",
    "question": "She ___ to the store yesterday.",
    "options": ["go", "goes", "went", "going"],
    "answer": "went",
    "explanation": "Past tense is required because of 'yesterday'."
  },
  {
    "type": "fill-in-the-blank",
    "question": "He is ___ honest man.",
    "answer": "an",
    "explanation": "'An' is used before vowel sounds."
  }
]

Rules for multiple-choice:
- Provide exactly 4 options labeled A, B, C, D in the options array
- The "answer" field should be the exact text of the correct option

Rules for fill-in-the-blank:
- Use ___ (three underscores) to indicate the blank
- The "answer" field should be the exact word(s) to fill in

Return ONLY the JSON array, no markdown formatting, no explanation.`;
  }

  const text = await llmManager.generateWithFallback(prompt, "", {
    taskType: "practice"
  });
  
  // Clean up markdown code blocks if present
  let cleanedText = text.replace(/^```json\s*/i, "").replace(/```$/g, "").trim();
  cleanedText = cleanedText.replace(/^```\s*/i, "").replace(/```$/g, "").trim();

  return JSON.parse(cleanedText);
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

function askQuestion(question) {
  return new Promise((resolve) => {
    if (rl.closed) {
      resolve("");
      return;
    }
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Grade user answer against correct answer
function gradeAnswer(exercise, userAnswer) {
  const user = userAnswer.trim().toLowerCase();
  // Clean the answer in case it has a leading label
  const correct = exercise.answer.replace(/^[A-Da-d][.)\s]+\s*/, "").trim().toLowerCase();

  if (exercise.type === "multiple-choice") {
    // Accept option letter (A/B/C/D) or the answer text
    const options = (exercise.options || []).map(o => o.replace(/^[A-Da-d][.)\s]+\s*/, "").trim());
    const optionLetters = ["a", "b", "c", "d"];

    // Check if user entered a letter
    if (user.length === 1 && optionLetters.includes(user)) {
      const selectedIndex = optionLetters.indexOf(user);
      const selectedOption = options[selectedIndex]?.toLowerCase();
      return selectedOption === correct;
    }

    // Check if user entered the full answer text
    return user === correct;

  } else if (exercise.type === "fill-in-the-blank") {
    // Exact match or common variant handling
    if (user === correct) return true;

    // Allow minor differences (e.g., extra spaces)
    const normalize = (s) => s.replace(/\s+/g, " ").trim();
    if (normalize(user) === normalize(correct)) return true;

    return false;
  }

  return false;
}

// Format exercise for display
function displayExercise(exercise, index, total) {
  console.log("\n" + "─".repeat(50));
  console.log(`📝 Exercise ${index}/${total}`);
  console.log("─".repeat(50));

  if (exercise.type === "multiple-choice") {
    console.log(`\n[Multiple Choice] ${exercise.question}\n`);
    const labels = ["A", "B", "C", "D"];
    for (let i = 0; i < exercise.options.length; i++) {
      // Strip any existing leading label (e.g., "A. ", "B) ", "a. ")
      const cleaned = exercise.options[i].replace(/^[A-Da-d][.)\s]+\s*/, "");
      console.log(`  ${labels[i]}. ${cleaned}`);
    }
    console.log("");
  } else {
    console.log(`\n[Fill in the Blank] ${exercise.question}\n`);
  }
}

// Display result after answering
function displayResult(exercise, isCorrect) {
  // Clean answer for display
  const cleanAnswer = exercise.answer.replace(/^[A-Da-d][.)\s]+\s*/, "").trim();

  if (isCorrect) {
    console.log("\n✅ Correct!\n");
  } else {
    console.log(`\n❌ Incorrect. The correct answer is: **${cleanAnswer}**\n`);
  }
  console.log(`💡 ${exercise.explanation}\n`);
}

// Main practice loop
async function runPractice() {
  console.log("\n" + "=".repeat(50));
  console.log("🎯 IGT Practice Mode");
  console.log("=".repeat(50) + "\n");

  // Get error types
  let errorTypes;
  if (errorTypeArg) {
    console.log(`📌 Focusing on: ${errorTypeArg}`);
    errorTypes = getErrorTypes(errorTypeArg);
    if (errorTypes.length === 0) {
      console.log(`No data found for "${errorTypeArg}". Using general exercises.`);
      errorTypes = getErrorTypes(null);
    }
  } else {
    console.log("📊 Analyzing your most common errors...");
    errorTypes = getErrorTypes(null);
  }

  if (errorTypes.length === 0) {
    console.log("\n⚠️  No diagnosis data found. Run some grammar checks first!");
    db.close();
    rl.close();
    process.exit(0);
  }

  const errorSummary = errorTypes.map(e => `${e.error_type} (${e.count}x)`).join(", ");
  console.log(`🎯 Target errors: ${errorSummary}`);

  // Generate exercises
  console.log("\n📝 Generating exercises...\n");

  let exercises;
  try {
    exercises = await generateExercises(errorTypes, count);
  } catch (error) {
    console.error("\n❌ Error generating exercises:", error.message);
    db.close();
    rl.close();
    process.exit(1);
  }

  if (!Array.isArray(exercises) || exercises.length === 0) {
    console.log("\n⚠️  Failed to generate exercises.");
    db.close();
    rl.close();
    process.exit(1);
  }

  console.log(`✅ Generated ${exercises.length} exercises\n`);

  // Present exercises
  let correctCount = 0;
  const results = [];

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    displayExercise(ex, i + 1, exercises.length);

    // Get user answer (no skipping allowed)
    let userAnswer;
    while (true) {
      if (ex.type === "multiple-choice") {
        userAnswer = await askQuestion("Your answer (A/B/C/D): ");
      } else {
        userAnswer = await askQuestion("Your answer: ");
      }
      if (userAnswer && userAnswer.trim().length > 0) break;
      console.log("⚠️  Please provide an answer to continue.");
    }

    // Grade
    const isCorrect = gradeAnswer(ex, userAnswer);
    if (isCorrect) correctCount++;
    results.push({ exercise: ex, correct: isCorrect });

    // Show result
    displayResult(ex, isCorrect);

    // Progress
    const answered = results.length;
    const pct = ((correctCount / answered) * 100).toFixed(0);
    console.log(`📊 Score: ${correctCount}/${answered} (${pct}%)`);
  }

  // Summary
  const totalAnswered = results.length;
  const totalCorrect = results.filter(r => r.correct).length;
  const finalPct = totalAnswered > 0 ? ((totalCorrect / totalAnswered) * 100).toFixed(0) : 0;

  console.log("\n" + "=".repeat(50));
  console.log("📋 Session Summary");
  console.log("=".repeat(50));
  console.log(`\n🎯 Final Score: ${totalCorrect}/${totalAnswered} (${finalPct}%)\n`);

  // Show wrong answers
  const wrongAnswers = results.filter(r => !r.correct);
  if (wrongAnswers.length > 0) {
    console.log("📝 Review your mistakes:\n");
    for (const r of wrongAnswers) {
      const cleanAnswer = r.exercise.answer.replace(/^[A-Da-d][.)\s]+\s*/, "").trim();
      console.log(`  • ${r.exercise.question}`);
      console.log(`    Correct answer: ${cleanAnswer}`);
      console.log(`    💡 ${r.exercise.explanation}\n`);
    }
  }

  // Performance feedback
  const pct = parseInt(finalPct);
  if (pct >= 90) {
    console.log("🌟 Excellent! You have a strong grasp of these grammar points.");
  } else if (pct >= 70) {
    console.log("👍 Good job! Keep practicing to improve further.");
  } else if (pct >= 50) {
    console.log("💪 Keep it up! Review the rules and try again.");
  } else {
    console.log("📚 Consider reviewing the grammar rules for these error types.");
  }

  console.log("");

  db.close();
  rl.close();
}

// Run
runPractice().then(() => {
  process.exit(0);
});
