/**
 * IGT Persistent Server - Node.js resident process
 * Avoids repeated Node.js startup overhead by staying resident
 * Communicates via stdin/stdout with JSON-RPC-like protocol
 */

import initializeLLMProviders from "./llm-init.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { performance } from 'perf_hooks';

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config
const configPath = path.join(__dirname, "igt_config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Initialize LLM providers ONCE at startup
const llmManager = initializeLLMProviders();

// Load system prompt
let systemPrompt;
if (config.Prompts && config.Prompts.SystemPrompt) {
  systemPrompt = config.Prompts.SystemPrompt;
} else {
  let systemPromptPath = config.SystemPromptPath || "system_prompt.txt";
  if (!path.isAbsolute(systemPromptPath)) {
    systemPromptPath = path.join(__dirname, systemPromptPath);
  }
  systemPrompt = fs.readFileSync(systemPromptPath, "utf8");
}

// Import database functions
const { classifyErrorType, getErrorTypePath } = await import("./error-types.mjs");
const Database = (await import("better-sqlite3")).default;

// Parse diagnosis from LLM output
function parseDiagnosis(output) {
  const result = {
    diagnoses: [],
    advice: { rule: null, tip: null }
  };

  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[1]);
      if (jsonData.diagnoses && Array.isArray(jsonData.diagnoses)) {
        for (const d of jsonData.diagnoses) {
          const rawType = (d.error_type || "").trim();
          const classifiedType = classifyErrorType(rawType);
          result.diagnoses.push({
            error_type: getErrorTypePath(classifiedType),
            severity: d.severity || "Minor",
            explanation: d.explanation || ""
          });
        }
      }
      result.advice.rule = jsonData.rule || null;
      result.advice.tip = jsonData.tip || null;
      return result;
    } catch (e) {
      // JSON parse failed, fall through to regex
    }
  }

  // Fallback: Regex-based parsing
  const diagnosisMatch = output.match(/\*\*Diagnosis\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  if (diagnosisMatch) {
    const diagnosisText = diagnosisMatch[1].trim();
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

  const ruleMatch = output.match(/\*\*Rule\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  if (ruleMatch) {
    result.advice.rule = ruleMatch[1].trim();
  }

  const tipMatch = output.match(/\*\*Tip\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  if (tipMatch) {
    result.advice.tip = tipMatch[1].trim();
  }

  return result;
}

// Extract Correction and Refine sections
function extractSections(output) {
  const correctionMatch = output.match(/\*\*Correction\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  const refineMatch = output.match(/\*\*Refine\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);

  return {
    correction: correctionMatch ? correctionMatch[1].trim() : null,
    refine: refineMatch ? refineMatch[1].trim() : null
  };
}

// Save to database
function saveToDatabase(userInput, output) {
  try {
    const dbPath = config.DbPath || "igt_data.db";
    const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, dbPath);

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

    const parsed = parseDiagnosis(output);
    const sections = extractSections(output);

    const insertInput = db.prepare(`
      INSERT INTO inputs (session_id, original_text, correction, refine)
      VALUES (NULL, ?, ?, ?)
    `);
    const inputResult = insertInput.run(userInput, sections.correction, sections.refine);
    const inputId = inputResult.lastInsertRowid;

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

    if (parsed.advice.rule || parsed.advice.tip) {
      const insertAdvice = db.prepare(`
        INSERT INTO advice (input_id, rule, tip)
        VALUES (?, ?, ?)
      `);
      insertAdvice.run(inputId, parsed.advice.rule, parsed.advice.tip);
    }

    db.close();
  } catch (error) {
    // Silently fail
  }
}

// Signal ready
console.error("[IGT-SERVER] Ready");

// Read lines from stdin
let buffer = "";
let processing = false;

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  
  // Process complete lines
  const processLine = (line) => {
    if (!line || processing) return;
    
    processing = true;
    processInput(line).finally(() => {
      processing = false;
    });
  };
  
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    const line = buffer.substring(0, newlineIndex).trim();
    buffer = buffer.substring(newlineIndex + 1);
    
    if (!line) continue;
    if (line === 'exit' || line === 'quit') {
      process.exit(0);
    }
    
    processLine(line);
  }
});

async function processInput(userInput) {
  const perfStart = performance.now();
  
  try {
    const t1 = performance.now();
    const text = await llmManager.generateWithFallback(userInput, systemPrompt, {
      taskType: "grammar"
    });
    const t2 = performance.now();
    
    console.error(`[PERF] LLM API call: ${(t2 - t1).toFixed(2)}ms`);
    
    // Output JSON response
    const response = {
      type: "result",
      content: text,
      perf: {
        llm: t2 - t1
      }
    };
    
    console.log(JSON.stringify(response));
    
    // Save to database (non-blocking)
    const t3 = performance.now();
    saveToDatabase(userInput, text);
    const t4 = performance.now();
    
    console.error(`[PERF] Database write: ${(t4 - t3).toFixed(2)}ms`);
    console.error(`[PERF] Total wall time: ${(t4 - perfStart).toFixed(2)}ms`);
    
  } catch (error) {
    const providerName = llmManager.getCurrentProviderName();
    const response = {
      type: "error",
      message: `${providerName.toUpperCase()} Error: ${error.message}`
    };
    console.log(JSON.stringify(response));
    console.error(`[ERROR] ${response.message}`);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
