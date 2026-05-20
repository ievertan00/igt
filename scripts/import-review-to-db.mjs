import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { classifyErrorType, getErrorTypePath } from "../lib/domain/error-types.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// Load config
const configPath = path.join(projectRoot, "igt_config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Accept file path from CLI arg, fall back to config
const reviewPath = process.argv[2] || config.ReviewPath;

if (!reviewPath || !fs.existsSync(reviewPath)) {
  console.error("Error: Review log file not found.");
  console.error("Usage: node scripts/import-review-to-db.mjs <path-to-review-log.md>");
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

// Parse entries — format: ### [timestamp]\n...sections...\n---\n
const entryPattern = /### \[([^\]]+)\]([\s\S]*?)(?=\n---\n### \[|\n---\s*$|$)/g;

const entries = [];
let match;

while ((match = entryPattern.exec(content)) !== null) {
  const timestamp = match[1].trim();
  const block = match[2];

  const userInput = extractSection(block, "User Input");
  if (!userInput || userInput.length < 3) continue;

  entries.push({ timestamp, userInput, block });
}

console.log(`Found ${entries.length} entries in ${path.basename(reviewPath)}`);

if (entries.length === 0) {
  console.log("No entries to import.");
  db.close();
  process.exit(0);
}

// Extract a named section from an entry block.
// Sections are delimited by \n**SectionName**: headers.
function extractSection(block, name) {
  const start = block.indexOf(`**${name}**:`);
  if (start === -1) return null;
  const contentStart = start + `**${name}**:`.length;
  // Next section header starts with \n** followed by an uppercase letter
  const nextHeader = block.slice(contentStart).search(/\n\*\*[A-Z]/);
  const contentEnd = nextHeader === -1 ? block.length : contentStart + nextHeader;
  return block.slice(contentStart, contentEnd).trim() || null;
}

// Parse diagnosis block into structured records.
// Handles formats found in the log:
//   "- ErrorType (Severity): explanation"
//   "- ErrorType (Severity)"
//   "- ErrorType: Severity"  (severity after colon)
//   "- Severity: Minor"      (continuation line for the previous item)
function parseDiagnosisText(diagnosisText) {
  const diagnoses = [];
  if (!diagnosisText) return diagnoses;

  const lines = diagnosisText.split("\n");
  let pending = null; // item waiting for a severity continuation line

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    // Continuation: "- Severity: Minor/Moderate/Major"
    const contMatch = t.match(/^[-*]?\s*Severity\s*[:：]\s*(Minor|Moderate|Major)/i);
    if (contMatch) {
      if (pending) {
        pending.severity = contMatch[1];
        diagnoses.push(pending);
        pending = null;
      }
      continue;
    }

    // New bullet item
    const bulletMatch = t.match(/^[-*\d.]+\s+([\s\S]+)/);
    if (!bulletMatch) continue;

    // Flush previous pending item (had no severity continuation)
    if (pending) {
      if (pending.severity) diagnoses.push(pending);
      pending = null;
    }

    const text = bulletMatch[1].trim();
    let errorType = text;
    let severity = null;
    let explanation = null;

    // Try "(Minor|Moderate|Major)" anywhere in the text
    const parenSev = text.match(/\((Minor|Moderate|Major)\)/i);
    if (parenSev) {
      severity = parenSev[1];
      errorType = text.slice(0, parenSev.index).replace(/[.,()\s]+$/, "").trim();
      const after = text.slice(parenSev.index + parenSev[0].length).replace(/^[:\s.]+/, "").trim();
      if (after) explanation = after;
    } else {
      // Try "ErrorType: Severity" (severity at end after colon)
      const colonSev = text.match(/^(.+?)\s*[:：]\s*(Minor|Moderate|Major)\s*\.?$/i);
      if (colonSev) {
        errorType = colonSev[1].trim();
        severity = colonSev[2];
      }
    }

    // Clean up errorType: strip trailing punctuation / parens
    errorType = errorType.replace(/\s*\([^)]*\)\s*$/, "").replace(/[.,;:]+$/, "").trim();

    const classifiedType = classifyErrorType(errorType);
    pending = {
      error_type: getErrorTypePath(classifiedType),
      severity,
      explanation: explanation || null,
    };
    if (severity) {
      diagnoses.push(pending);
      pending = null;
    }
  }

  // Flush last pending item
  if (pending && pending.severity) diagnoses.push(pending);

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
    
    const correction = extractSection(entry.block, "Correction");
    const refine = extractSection(entry.block, "Refine");
    const diagnosisText = extractSection(entry.block, "Diagnosis");
    const rule = extractSection(entry.block, "Rule");
    const tip = extractSection(entry.block, "Tip");

    // Insert input
    const result = insertInput.run(entry.timestamp, entry.userInput, correction, refine);
    const inputId = result.lastInsertRowid;
    
    // Parse and insert diagnoses
    if (diagnosisText) {
      const diagnoses = parseDiagnosisText(diagnosisText);
      for (const d of diagnoses) {
        insertDiagnosis.run(inputId, d.error_type, d.severity, d.explanation);
      }
    }

    // Insert advice
    if (rule || tip) {
      insertAdvice.run(inputId, rule, tip);
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
