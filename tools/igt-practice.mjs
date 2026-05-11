import initializeLLMProviders, { configLoader } from "../lib/llm/init.mjs";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import { ui, paint, colors, Spinner, wrapText } from "../lib/ui.mjs";

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

// Data warehouse path (VaultDir for practice)
const baseDir = config.VaultDir 
  ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
  : path.join(projectRoot, "docs");

if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

const HISTORY_FILE = path.join(baseDir, "practice_history.json");

function loadPracticeHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    return Array.isArray(data.questions) ? data.questions : [];
  } catch { return []; }
}

function savePracticeHistory(exercises) {
  const existing = loadPracticeHistory();
  const combined = [...existing, ...exercises.map(e => e.question)];
  fs.writeFileSync(HISTORY_FILE, JSON.stringify({ questions: combined.slice(-200) }, null, 2));
}

function savePracticeSession(exercises, results, meta) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);
  
  // Resolve practice log file path
  let filepath;
  if (config.PracticeFile) {
    filepath = path.isAbsolute(config.PracticeFile) 
      ? config.PracticeFile 
      : path.join(baseDir, config.PracticeFile);
  } else {
    filepath = path.join(baseDir, "practice_log.md");
  }

  // Ensure directory exists
  const fileDir = path.dirname(filepath);
  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }

  const totalCorrect = results.filter(r => r.correct).length;
  const pct = ((totalCorrect / results.length) * 100).toFixed(0);

  let md = `\n## ${dateStr} ${timeStr} — ${meta.level} — ${totalCorrect}/${results.length} (${pct}%)\n\n`;
  md += `> Target errors: ${meta.errorSummary}\n\n`;

  results.forEach((r, i) => {
    const ex = r.exercise;
    const status = r.correct ? "✅" : "❌";
    const typeLabel = ex.type === "multiple-choice" ? "MC" : "FIB";
    md += `### Q${i + 1} ${status} [${typeLabel}] ${ex.question}\n\n`;
    if (ex.type === "multiple-choice" && Array.isArray(ex.options)) {
      const labels = ["A", "B", "C", "D"];
      ex.options.forEach((opt, j) => {
        md += `- ${labels[j]}. ${opt.replace(/^[A-Da-d][.)\s]+\s*/, "")}\n`;
      });
      md += "\n";
    }
    const cleanAnswer = ex.answer.replace(/^[A-Da-d][.)\s]+\s*/, "").trim();
    md += `**Answer**: ${cleanAnswer} — ${ex.explanation}\n\n`;
  });

  md += `---`;

  const isNew = !fs.existsSync(filepath);
  if (isNew) {
    fs.writeFileSync(filepath, `# IGT Practice Log\n${md}`, "utf8");
  } else {
    fs.appendFileSync(filepath, `\n${md}`, "utf8");
  }
  return path.basename(filepath);
}

// Parse arguments
const args = process.argv.slice(2);
let errorTypeArg = null;
let count = null;
let level = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--type" && args[i + 1]) {
    errorTypeArg = args[i + 1];
    i++;
  } else if (arg.startsWith("--type=")) {
    errorTypeArg = arg.split("=")[1];
  } else if (arg.startsWith("--count=")) {
    count = parseInt(arg.split("=")[1]);
  } else if (arg.startsWith("--level=")) {
    level = arg.split("=")[1].toUpperCase();
  } else if (!arg.startsWith("--")) {
    // Positional argument for error type (legacy support)
    if (!errorTypeArg) errorTypeArg = arg;
  }
}

// Validate CEFR level
const validLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];
if (level && !validLevels.includes(level)) {
  console.error(`Error: Invalid CEFR level "${level}". Valid levels: ${validLevels.join(", ")}`);
  process.exit(1);
}

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
    return result ? [result] : [{ error_type: errorType, count: 0 }];
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

// Fetch linguistic context (recurring traps and recent failures) for the requested error types
function getLinguisticContext(errorTypes) {
  let contextText = "";
  
  for (const type of errorTypes) {
    const errorTypeName = type.error_type;
    contextText += `\n### Error Type: ${errorTypeName}\n`;
    
    // 1. Get Top 3 Recurring "Traps" (most frequent rules/explanations)
    const recurringTraps = db.prepare(`
      SELECT a.rule, COUNT(*) as count
      FROM advice a
      JOIN diagnoses d ON a.input_id = d.input_id
      WHERE d.error_type = ? AND a.rule IS NOT NULL AND a.rule != ''
      GROUP BY a.rule
      ORDER BY count DESC
      LIMIT 3
    `).all(errorTypeName);
    
    if (recurringTraps.length > 0) {
      contextText += "Recurring Traps:\n";
      recurringTraps.forEach((trap, i) => {
        contextText += `- ${trap.rule} (appeared ${trap.count} times)\n`;
      });
    }
    
    // 2. Get 2 Most Recent Failures
    const recentFailures = db.prepare(`
      SELECT i.original_text, i.correction
      FROM inputs i
      JOIN diagnoses d ON d.input_id = i.id
      WHERE d.error_type = ?
      ORDER BY i.timestamp DESC
      LIMIT 2
    `).all(errorTypeName);
    
    if (recentFailures.length > 0) {
      contextText += "Recent Failures:\n";
      recentFailures.forEach((fail, i) => {
        contextText += `- Original: "${fail.original_text}" -> Corrected: "${fail.correction}"\n`;
      });
    }
  }
  
  return contextText || "No previous history found for these error types.";
}

// Helper function to sanitize JSON string from LLM responses
function sanitizeJsonString(str) {
  // Remove any control characters that might break JSON parsing
  str = str.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Fix common issue: unescaped quotes within string values
  // This is a simplified approach - finds patterns like "text "more text" and fixes them
  str = str.replace(/(?<=[^\\])"(?=[^",\]}:\s])/g, '\\"');
  
  return str;
}

// Generate exercises as structured JSON with answers
async function generateExercises(errorTypes, count, level, usedQuestions = []) {
  const errorList = errorTypes.map(e => `- ${e.error_type}`).join("\n");
  const linguisticSummary = getLinguisticContext(errorTypes); // Inject context
  
  // Limit usedQuestions to last 20 to keep context window small and reduce latency
  const recentQuestions = usedQuestions.slice(-20).join("\n");

  // Load prompt from config or use default
  let prompt;
  if (config.Prompts && config.Prompts.PracticeExercisePrompt) {
    prompt = config.Prompts.PracticeExercisePrompt
      .replace(/\{\{count\}\}/g, count)
      .replace(/\{\{errorList\}\}/g, errorList)
      .replace(/\{\{level\}\}/g, level || "B1")
      .replace(/\{\{linguisticSummary\}\}/g, linguisticSummary)
      .replace(/\{\{usedQuestions\}\}/g, recentQuestions || "None yet."); // Replace placeholder
  } else {
    // Fallback to inline prompt for backward compatibility
    prompt = `Generate ${count} grammar practice exercises focusing on these error types:
${errorList}

LINGUISTIC CONTEXT (RECURRING TRAPS & RECENT FAILURES):
${linguisticSummary}

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

  // Extract JSON array more robustly - find first [ and last ]
  const firstBracket = cleanedText.indexOf('[');
  const lastBracket = cleanedText.lastIndexOf(']');
  
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleanedText = cleanedText.substring(firstBracket, lastBracket + 1);
  } else {
    // If no array found, check if response is wrapped in an object
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        const obj = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        // Extract array from common wrapper keys
        if (obj.exercises && Array.isArray(obj.exercises)) {
          cleanedText = JSON.stringify(obj.exercises);
        } else if (obj.data && Array.isArray(obj.data)) {
          cleanedText = JSON.stringify(obj.data);
        } else if (obj.questions && Array.isArray(obj.questions)) {
          cleanedText = JSON.stringify(obj.questions);
        } else if (obj.items && Array.isArray(obj.items)) {
          cleanedText = JSON.stringify(obj.items);
        }
      } catch (e) {
        // Not valid JSON, continue with original text
      }
    }
  }

  // Additional cleanup: escape problematic characters in explanations
  // This handles cases where LLM includes unescaped quotes
  cleanedText = cleanedText.replace(/\\'/g, "'");

  // Sanitize JSON string - escape unescaped quotes within string values
  // This is a simple heuristic to fix common JSON formatting issues
  cleanedText = sanitizeJsonString(cleanedText);

  // Fix over-escaped quotes: LLM often returns \" when it should be "
  // This is the main issue - remove backslash escapes from quotes
  cleanedText = cleanedText.replace(/\\"/g, '"');

  try {
    return JSON.parse(cleanedText);
  } catch (parseError) {
    throw parseError;
  }
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

const BOX_WIDTH = 72;
const BOX_INNER_WIDTH = BOX_WIDTH - 6; // subtract borders (│ , │) + padding

// Format exercise for display
function displayExercise(exercise, index, total) {
  const typeLabel = exercise.type === "multiple-choice" ? "Multiple Choice" : "Fill in the Blank";
  ui.header(`Exercise ${index}/${total}`, typeLabel);

  let content = "";
  if (exercise.type === "multiple-choice") {
    content = `${paint(colors.white, wrapText(exercise.question, BOX_INNER_WIDTH))}\n\n`;
    const labels = ["A", "B", "C", "D"];
    for (let i = 0; i < exercise.options.length; i++) {
      const cleaned = exercise.options[i].replace(/^[A-Da-d][.)\s]+\s*/, "");
      content += `  ${paint(colors.cyan, labels[i])}. ${paint(colors.white, cleaned)}\n`;
    }
  } else {
    content = `${paint(colors.white, wrapText(exercise.question, BOX_INNER_WIDTH))}`;
  }

  console.log(ui.box("QUESTION", content.trimEnd(), { width: BOX_WIDTH }));
  console.log("");
}

// Display result after answering
function displayResult(exercise, isCorrect) {
  const cleanAnswer = exercise.answer.replace(/^[A-Da-d][.)\s]+\s*/, "").trim();
  
  let content = "";
  if (isCorrect) {
    content = `${paint(colors.green, "✅ Correct!")}\n\n`;
  } else {
    content = `${paint(colors.red, "❌ Incorrect.")} ${paint(colors.gray, "The correct answer is: ")}${paint(colors.bold + colors.green, cleanAnswer)}\n\n`;
  }
  content += `${paint(colors.yellow, "💡 ")}${paint(colors.white, wrapText(exercise.explanation, BOX_INNER_WIDTH - 4, 4))}`;

  console.log(ui.box("FEEDBACK", content, { width: BOX_WIDTH, color: isCorrect ? colors.green : colors.red }));
  console.log("");
}

// Export for testing
export { generateExercises, getErrorTypes, getLinguisticContext, gradeAnswer };

// Main practice loop
async function runPractice() {
  console.log("\n" + "=".repeat(50));
  console.log("🎯 IGT Practice Mode");
  console.log("=".repeat(50) + "\n");

  // Ask for CEFR level if not provided
  let selectedLevel = level;
  if (!selectedLevel) {
    console.log("Available CEFR Levels:");
    console.log("  A1 - Beginner (basic phrases, simple sentences)");
    console.log("  A2 - Elementary (everyday expressions, routine tasks)");
    console.log("  B1 - Intermediate (main points of clear standard input)");
    console.log("  B2 - Upper Intermediate (complex text, fluent interaction)");
    console.log("  C1 - Advanced (implicit meaning, flexible expression)");
    console.log("  C2 - Proficient (effortless understanding, precise expression)");
    console.log("");
    
    while (true) {
      const levelInput = await askQuestion("Select CEFR level (A1/A2/B1/B2/C1/C2): ");
      const trimmedLevel = levelInput.trim().toUpperCase();
      
      if (validLevels.includes(trimmedLevel)) {
        selectedLevel = trimmedLevel;
        break;
      } else {
        console.log("⚠️  Invalid level. Please enter one of: A1, A2, B1, B2, C1, C2");
      }
    }
  }

  // Ask for number of questions if not provided
  let selectedCount = count;
  if (!selectedCount) {
    while (true) {
      const countInput = await askQuestion("Number of questions (1-50, default 5): ");
      const trimmedInput = countInput.trim();
      
      if (trimmedInput === "") {
        selectedCount = 5;
        break;
      }
      
      const parsedCount = parseInt(trimmedInput);
      if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 50) {
        console.log("⚠️  Please enter a number between 1 and 50.");
      } else {
        selectedCount = parsedCount;
        break;
      }
    }
  }

  console.log(`\n📊 CEFR Level: ${selectedLevel}`);
  console.log(`📝 Number of Questions: ${selectedCount}\n`);

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

  // Load practice history for deduplication
  const usedQuestions = loadPracticeHistory();
  if (usedQuestions.length > 0) {
    console.log(`📚 Loaded ${usedQuestions.length} previously practiced questions (will avoid repeats)`);
  }

  // Generate exercises
  const spinner = new Spinner("Generating exercises...");
  spinner.start();

  let exercises;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
      exercises = await generateExercises(errorTypes, selectedCount, selectedLevel, usedQuestions);
      spinner.stop();
      break; // Success, exit loop
    } catch (error) {
      retryCount++;
      if (retryCount > maxRetries) {
        spinner.stop();
        console.error("\n❌ Error generating exercises:", error.message);
        console.error("\n💡 Tip: Try again with fewer questions or a different error type.");
        db.close();
        rl.close();
        process.exit(1);
      } else {
        // Wait a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
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

  ui.header("Session Summary", `Performance assessment for CEFR ${selectedLevel}`);

  let summaryContent = `🎯 Final Score: ${paint(colors.bold + colors.white, totalCorrect + "/" + totalAnswered)} (${paint(colors.brightGreen, finalPct + "%")})\n\n`;

  
  const numericPct = parseInt(finalPct);
  let feedback = "";
  if (numericPct >= 90) {
    feedback = `🌟 ${paint(colors.brightGreen, "Excellent!")} You have a strong grasp of these points.`;
  } else if (numericPct >= 70) {
    feedback = `👍 ${paint(colors.green, "Good job!")} Keep practicing to improve further.`;
  } else if (numericPct >= 50) {
    feedback = `💪 ${paint(colors.yellow, "Keep it up!")} Review the rules and try again.`;
  } else {
    feedback = `📚 ${paint(colors.brightRed, "Needs focus.")} Consider reviewing the grammar rules.`;
  }
  summaryContent += wrapText(feedback, BOX_INNER_WIDTH);

  console.log(ui.box("SUMMARY", summaryContent, { width: BOX_WIDTH, color: colors.yellow }));
  console.log("");

  // Show wrong answers
  const wrongAnswers = results.filter(r => !r.correct);
  if (wrongAnswers.length > 0) {
    console.log(`  ${paint(colors.bold + colors.red, "📝 Review your mistakes:")}\n`);
    for (const r of wrongAnswers) {
      const cleanAnswer = r.exercise.answer.replace(/^[A-Da-d][.)\s]+\s*/, "").trim();
      
      let mistakeContent = `${paint(colors.white, wrapText(r.exercise.question, BOX_INNER_WIDTH))}\n\n`;
      
      const answerLabel = "Correct answer: ";
      mistakeContent += `  ${paint(colors.gray, answerLabel)}${paint(colors.bold + colors.green, wrapText(cleanAnswer, BOX_INNER_WIDTH - answerLabel.length - 2, answerLabel.length + 2).trim())}\n\n`;
      
      mistakeContent += `  ${paint(colors.yellow, "💡 ")}${paint(colors.white, wrapText(r.exercise.explanation, BOX_INNER_WIDTH - 5, 5).trim())}`;

      console.log(ui.box("MISTAKE", mistakeContent, { width: BOX_WIDTH, color: colors.red }));
      console.log("");
      }
      }

      // Weakest area from historical data
      const weakest = db.prepare(`
      SELECT error_type, COUNT(*) as total
      FROM diagnoses
      GROUP BY error_type
      ORDER BY total DESC
      LIMIT 1
      `).get();
      if (weakest) {
      let weakestText = `📌 Historically weakest area: ${paint(colors.bold + colors.brightRed, weakest.error_type)} (${weakest.total} total errors)`;
      console.log(ui.box("INSIGHT", wrapText(weakestText, BOX_INNER_WIDTH), { width: BOX_WIDTH, color: colors.magenta }));
      }


  // Save session to data warehouse and update history
  try {
    const sessionFile = savePracticeSession(exercises, results, { level: selectedLevel, errorSummary });
    savePracticeHistory(exercises);
    console.log(`\n💾 Session saved: ${sessionFile}`);
  } catch (e) {
    console.log(`\n⚠️  Could not save session: ${e.message}`);
  }

  console.log("");

  db.close();
  rl.close();
}

// Run if executed directly
const isMain = process.argv[1] && (process.argv[1].endsWith('igt-practice.mjs') || process.argv[1].includes('igt-practice.mjs'));

if (isMain) {
  runPractice().then(() => {
    process.exit(0);
  });
}

