import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { classifyErrorType, getErrorTypePath } from "../lib/error-types.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// Load config
const configPath = path.join(projectRoot, "igt_config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const reviewPath = config.ReviewPath;

if (!reviewPath || !fs.existsSync(reviewPath)) {
  console.error("Error: ReviewPath not found in config or file does not exist.");
  process.exit(1);
}

// Load database
const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);

if (!fs.existsSync(resolvedDbPath)) {
  console.error("Error: Database file not found. Run init-db.mjs first.");
  process.exit(1);
}

const db = new Database(resolvedDbPath);
db.pragma("journal_mode = WAL");

// Read the review file
const content = fs.readFileSync(reviewPath, "utf8");

// Parse entries using regex
// Format: ### [timestamp]\n**User Input**: ...\n**Gemini Output**:\n...
const entryPattern = /### \[([^\]]+)\]\s*\*\*User Input\*\*:\s*([\s\S]*?)\*\*Gemini Output\*\*:\s*([\s\S]*?)(?=(?:\n---\n### \[)|$)/g;

const entries = [];
let match;

while ((match = entryPattern.exec(content)) !== null) {
  const timestamp = match[1].trim();
  const userInput = match[2].trim();
  let geminiOutput = match[3].trim();
  
  // Clean up Gemini output (remove .Trim() and other artifacts)
  geminiOutput = geminiOutput.replace(/\.Trim\(\)\s*$/g, "").trim();
  
  // Skip if user input is empty or too short
  if (userInput.length < 3) continue;
  
  entries.push({
    timestamp,
    userInput,
    geminiOutput
  });
}

console.log(`Found ${entries.length} entries in Review_&_Feedback.md`);

if (entries.length === 0) {
  console.log("No entries to import.");
  db.close();
  process.exit(0);
}

// Parse Gemini output to extract sections
function parseSections(output) {
  const correctionMatch = output.match(/\*\*Correction\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  const refineMatch = output.match(/\*\*Refine\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  const reviewMatch = output.match(/\*\*Review\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  const diagnosisMatch = output.match(/\*\*Diagnosis\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  const ruleMatch = output.match(/\*\*Rule\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  const tipMatch = output.match(/\*\*Tip\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  
  return {
    review: reviewMatch ? reviewMatch[1].trim() : null,
    correction: correctionMatch ? correctionMatch[1].trim() : null,
    refine: refineMatch ? refineMatch[1].trim() : null,
    diagnosis: diagnosisMatch ? diagnosisMatch[1].trim() : null,
    rule: ruleMatch ? ruleMatch[1].trim() : null,
    tip: tipMatch ? tipMatch[1].trim() : null
  };
}

// Parse diagnosis text to extract structured data
function parseDiagnosisText(diagnosisText) {
  const diagnoses = [];
  if (!diagnosisText) return diagnoses;
  
  // Match patterns like "- Article misuse (Minor): ..." or "1. Tense confusion (Major): ..."
  const items = diagnosisText.match(/[-*\d.]+\s*(.+?)\s*\((Minor|Moderate|Major)\)\s*[:：]?\s*(.*)/gi);
  if (items) {
    for (const item of items) {
      const m = item.match(/[-*\d.]+\s*(.+?)\s*\((Minor|Moderate|Major)\)\s*[:：]?\s*(.*)/i);
      if (m) {
        const rawType = m[1].trim().replace(/^-+\s*/, "");
        const classifiedType = classifyErrorType(rawType);
        diagnoses.push({
          error_type: getErrorTypePath(classifiedType),
          severity: m[2].trim(),
          explanation: m[3].trim()
        });
      }
    }
  }
  
  return diagnoses;
}

// Import entries into database
const insertInput = db.prepare(`
  INSERT INTO inputs (session_id, timestamp, original_text, correction, refine)
  VALUES (NULL, ?, ?, ?, ?)
`);

const insertDiagnosis = db.prepare(`
  INSERT INTO diagnoses (input_id, error_type, severity, explanation)
  VALUES (?, ?, ?, ?)
`);

const insertAdvice = db.prepare(`
  INSERT INTO advice (input_id, rule, tip)
  VALUES (?, ?, ?)
`);

const insertMany = db.transaction((entries) => {
  let imported = 0;
  let skipped = 0;
  
  for (const entry of entries) {
    // Check for duplicates (same timestamp + same input)
    const exists = db.prepare(`
      SELECT id FROM inputs WHERE timestamp = ? AND original_text = ?
    `).get(entry.timestamp, entry.userInput);
    
    if (exists) {
      skipped++;
      continue;
    }
    
    const sections = parseSections(entry.geminiOutput);
    
    // Insert input
    const result = insertInput.run(entry.timestamp, entry.userInput, sections.correction, sections.refine);
    const inputId = result.lastInsertRowid;
    
    // Parse and insert diagnoses
    if (sections.diagnosis) {
      const diagnoses = parseDiagnosisText(sections.diagnosis);
      for (const d of diagnoses) {
        insertDiagnosis.run(inputId, d.error_type, d.severity, d.explanation);
      }
    }
    
    // Insert advice
    if (sections.rule || sections.tip) {
      insertAdvice.run(inputId, sections.rule, sections.tip);
    }
    
    imported++;
  }
  
  return { imported, skipped };
});

console.log("Importing entries into database...");
const result = insertMany(entries);

console.log(`✅ Import complete!`);
console.log(`   Imported: ${result.imported}`);
console.log(`   Skipped (duplicates): ${result.skipped}`);

// Show summary
const summary = db.prepare(`
  SELECT 
    COUNT(*) as total_inputs,
    COUNT(DISTINCT d.id) as total_diagnoses,
    COUNT(DISTINCT d.error_type) as unique_error_types
  FROM inputs i
  LEFT JOIN diagnoses d ON i.id = d.input_id
`).get();

console.log(`\n📊 Database Summary:`);
console.log(`   Total inputs: ${summary.total_inputs}`);
console.log(`   Total diagnoses: ${summary.total_diagnoses}`);
console.log(`   Unique error types: ${summary.unique_error_types}`);

// Show top errors
const topErrors = db.prepare(`
  SELECT error_type, COUNT(*) as count
  FROM diagnoses
  GROUP BY error_type
  ORDER BY count DESC
  LIMIT 5
`).all();

if (topErrors.length > 0) {
  console.log(`\n🔴 Top 5 Error Types:`);
  for (const err of topErrors) {
    console.log(`   ${err.error_type}: ${err.count}`);
  }
}

db.close();
