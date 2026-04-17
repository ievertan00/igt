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
const levelArg = args.find(a => a.startsWith("--level="));
const count = countArg ? parseInt(countArg.split("=")[1]) : null;
const level = levelArg ? levelArg.split("=")[1].toUpperCase() : null;

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
async function generateExercises(errorTypes, count, level) {
  const errorList = errorTypes.map(e => `- ${e.error_type}`).join("\n");
  const linguisticSummary = getLinguisticContext(errorTypes); // Inject context

  // Load prompt from config or use default
  let prompt;
  if (config.Prompts && config.Prompts.PracticeExercisePrompt) {
    prompt = config.Prompts.PracticeExercisePrompt
      .replace(/\{\{count\}\}/g, count)
      .replace(/\{\{errorList\}\}/g, errorList)
      .replace(/\{\{level\}\}/g, level || "B1")
      .replace(/\{\{linguisticSummary\}\}/g, linguisticSummary); // Replace placeholder
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

  // Debug: log the raw and cleaned JSON to see what's happening
  console.log("\n[DEBUG] Raw response length:", text.length);
  console.log("[DEBUG] Cleaned JSON preview:", cleanedText.substring(0, 300) + (cleanedText.length > 300 ? "..." : ""));

  try {
    const parsed = JSON.parse(cleanedText);
    return parsed;
  } catch (parseError) {
    // Log full details on parse error for debugging
    console.log("\n[DEBUG] Full cleaned text:");
    console.log(cleanedText);
    console.log("\n[DEBUG] Parse error at position 8:", cleanedText.substring(0, 20));
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

  // Generate exercises
  console.log("\n📝 Generating exercises...\n");

  let exercises;
  let retryCount = 0;
  const maxRetries = 2;
  
  while (retryCount <= maxRetries) {
    try {
      exercises = await generateExercises(errorTypes, selectedCount, selectedLevel);
      break; // Success, exit loop
    } catch (error) {
      retryCount++;
      if (retryCount > maxRetries) {
        console.error("\n❌ Error generating exercises:", error.message);
        console.error("\n💡 Tip: Try again with fewer questions or a different error type.");
        db.close();
        rl.close();
        process.exit(1);
      } else {
        console.log(`\n⚠️  Exercise generation failed, retrying (${retryCount}/${maxRetries})...`);
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

  // Weakest area from historical data
  const weakest = db.prepare(`
    SELECT error_type, COUNT(*) as total
    FROM diagnoses
    GROUP BY error_type
    ORDER BY total DESC
    LIMIT 1
  `).get();
  if (weakest) {
    console.log(`\n📌 Historically weakest area: ${weakest.error_type} (${weakest.total} total errors)`);
  }

  console.log("");

  db.close();
  rl.close();
}

// Run
runPractice().then(() => {
  process.exit(0);
});
