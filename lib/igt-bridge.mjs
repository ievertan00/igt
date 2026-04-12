import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { classifyErrorType, getErrorTypePath } from "./error-types.mjs";

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load config and input
const configPath = path.join(__dirname, "igt_config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Load system prompt from config or fallback to file
let systemPrompt;
if (config.Prompts && config.Prompts.SystemPrompt) {
  systemPrompt = config.Prompts.SystemPrompt;
} else {
  // Fallback to file-based prompt for backward compatibility
  let systemPromptPath = config.SystemPromptPath || "system_prompt.txt";
  if (!path.isAbsolute(systemPromptPath)) {
    systemPromptPath = path.join(__dirname, systemPromptPath);
  }
  systemPrompt = fs.readFileSync(systemPromptPath, "utf8");
}

// Support multiple API keys with fallback
let apiKey;
if (process.env.GOOGLE_API_KEY) {
  apiKey = process.env.GOOGLE_API_KEY;
} else if (config.ApiKeys && Array.isArray(config.ApiKeys) && config.ApiKeys.length > 0) {
  apiKey = config.ApiKeys[0]; // Use first key by default
} else if (config.ApiKey) {
  apiKey = config.ApiKey; // Fallback to old format
}

const userInput = fs.readFileSync(0, "utf8"); // Read from stdin

// 2. Parse diagnosis output into structured data
function parseDiagnosis(output) {
  const result = {
    diagnoses: [],
    advice: { rule: null, tip: null }
  };

  // Extract Diagnosis section
  const diagnosisMatch = output.match(/\*\*Diagnosis\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  if (diagnosisMatch) {
    const diagnosisText = diagnosisMatch[1].trim();
    
    // Parse individual diagnosis items
    // Matches patterns like "- Article misuse (Minor): ..." or "1. Tense confusion (Major): ..."
    const diagnosisItems = diagnosisText.match(/[-*]?\s*(.+?)\s*\((Minor|Moderate|Major)\)\s*[:：]?\s*(.*)/gi);
    if (diagnosisItems) {
      for (const item of diagnosisItems) {
        const match = item.match(/[-*]?\s*(.+?)\s*\((Minor|Moderate|Major)\)\s*[:：]?\s*(.*)/i);
        if (match) {
          const rawType = match[1].trim().replace(/^-+\s*/, "");
          const classifiedType = classifyErrorType(rawType);
          result.diagnoses.push({
            error_type: getErrorTypePath(classifiedType),
            severity: match[2].trim(),
            explanation: match[3].trim()
          });
        }
      }
    }
  }

  // Extract Rule section
  const ruleMatch = output.match(/\*\*Rule\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  if (ruleMatch) {
    result.advice.rule = ruleMatch[1].trim();
  }

  // Extract Tip section
  const tipMatch = output.match(/\*\*Tip\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  if (tipMatch) {
    result.advice.tip = tipMatch[1].trim();
  }

  return result;
}

// 4. Extract Correction and Refine from output
function extractSections(output) {
  const correctionMatch = output.match(/\*\*Correction\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  const refineMatch = output.match(/\*\*Refine\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  
  return {
    correction: correctionMatch ? correctionMatch[1].trim() : null,
    refine: refineMatch ? refineMatch[1].trim() : null
  };
}

// 5. Initialize database and save data
function saveToDatabase(userInput, output) {
  try {
    const dbPath = config.DbPath || "igt_data.db";
    const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, dbPath);
    
    // Check if database exists, if not, initialize it
    const dbExists = fs.existsSync(resolvedDbPath);
    const db = new Database(resolvedDbPath);
    
    if (!dbExists) {
      db.pragma("journal_mode = WAL");
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP,
          total_inputs INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS inputs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          original_text TEXT NOT NULL,
          correction TEXT,
          refine TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(id)
        );
        CREATE TABLE IF NOT EXISTS diagnoses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          input_id INTEGER,
          error_type TEXT NOT NULL,
          severity TEXT,
          explanation TEXT,
          FOREIGN KEY (input_id) REFERENCES inputs(id)
        );
        CREATE TABLE IF NOT EXISTS advice (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          input_id INTEGER,
          rule TEXT,
          tip TEXT,
          FOREIGN KEY (input_id) REFERENCES inputs(id)
        );
        CREATE INDEX IF NOT EXISTS idx_inputs_timestamp ON inputs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_diagnoses_input_id ON diagnoses(input_id);
        CREATE INDEX IF NOT EXISTS idx_diagnoses_error_type ON diagnoses(error_type);
        CREATE INDEX IF NOT EXISTS idx_advice_input_id ON advice(input_id);
      `);
    }
    
    db.pragma("journal_mode = WAL");
    
    // Parse output
    const parsed = parseDiagnosis(output);
    const sections = extractSections(output);
    
    // Insert input record
    const insertInput = db.prepare(`
      INSERT INTO inputs (session_id, original_text, correction, refine)
      VALUES (NULL, ?, ?, ?)
    `);
    const inputResult = insertInput.run(userInput, sections.correction, sections.refine);
    const inputId = inputResult.lastInsertRowid;
    
    // Insert diagnoses
    if (parsed.diagnoses.length > 0) {
      const insertDiagnosis = db.prepare(`
        INSERT INTO diagnoses (input_id, error_type, severity, explanation)
        VALUES (?, ?, ?, ?)
      `);
      const insertManyDiagnoses = db.transaction((diagnoses) => {
        for (const d of diagnoses) {
          insertDiagnosis.run(inputId, d.error_type, d.severity, d.explanation);
        }
      });
      insertManyDiagnoses(parsed.diagnoses);
    }
    
    // Insert advice
    if (parsed.advice.rule || parsed.advice.tip) {
      const insertAdvice = db.prepare(`
        INSERT INTO advice (input_id, rule, tip)
        VALUES (?, ?, ?)
      `);
      insertAdvice.run(inputId, parsed.advice.rule, parsed.advice.tip);
    }
    
    db.close();
  } catch (error) {
    // Silently fail - database logging should not break main functionality
    console.error("Warning: Database write failed:", error.message);
  }
}

// 6. Generate content with API key fallback
async function generateWithFallback(userInput, keys) {
  let lastError;
  
  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i];
    try {
      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel({
        model: config.Model || "gemini-2.5-flash-lite",
        systemInstruction: systemPrompt
      });
      
      const result = await model.generateContent(userInput);
      const text = result.response.text().trim();
      return text;
    } catch (error) {
      lastError = error;
      // Continue to next key silently
    }
  }
  
  throw lastError;
}

try {
  // Get all available API keys
  const availableKeys = [];
  if (process.env.GOOGLE_API_KEY) {
    availableKeys.push(process.env.GOOGLE_API_KEY);
  }
  if (config.ApiKeys && Array.isArray(config.ApiKeys)) {
    availableKeys.push(...config.ApiKeys);
  } else if (config.ApiKey) {
    availableKeys.push(config.ApiKey);
  }
  
  if (availableKeys.length === 0) {
    console.error("Error: No API keys found. Set GOOGLE_API_KEY env var or add to igt_config.json.");
    process.exit(1);
  }
  
  const text = await generateWithFallback(userInput, availableKeys);
  console.log(text);

  // Save to database (non-blocking for performance)
  setImmediate(() => {
    saveToDatabase(userInput, text);
  });
} catch (error) {
  console.error("Gemini Error: All API keys failed:", error.message);
  process.exit(1);
}
