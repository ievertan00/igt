import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const exportIndex = args.indexOf("--export");
const outputFileName = exportIndex !== -1 ? args[exportIndex + 1] : null;

// Load config
const configPath = path.join(__dirname, "igt_config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, dbPath);

if (!fs.existsSync(resolvedDbPath)) {
  console.error("Error: Database file not found. Run IGT first to collect data.");
  process.exit(1);
}

const db = new Database(resolvedDbPath, { readonly: true });

// Query all inputs with diagnoses
const query = `
  SELECT 
    i.original_text,
    i.correction,
    i.refine,
    i.timestamp,
    d.error_type,
    d.severity,
    d.explanation,
    a.rule,
    a.tip
  FROM inputs i
  LEFT JOIN diagnoses d ON i.id = d.input_id
  LEFT JOIN advice a ON i.id = a.input_id
  WHERE d.error_type IS NOT NULL
  ORDER BY i.timestamp DESC
`;

const rows = db.prepare(query).all();

if (rows.length === 0) {
  console.log("No diagnosis data found in database. Run IGT grammar checks first.");
  db.close();
  process.exit(0);
}

// Generate Anki-compatible CSV
function generateCSV(rows) {
  const cards = new Map();

  for (const row of rows) {
    const key = `${row.original_text}||${row.error_type}`;

    if (!cards.has(key)) {
      cards.set(key, {
        front: row.original_text,
        back: buildBack(row),
        tags: `IGT::${sanitizeTag(row.error_type)} ::${row.severity || "Unknown"}`
      });
    }
  }
  
  // CSV header
  let csv = "Front,Back,Tags\n";
  
  for (const card of cards.values()) {
    csv += `${escapeCSV(card.front)},${escapeCSV(card.back)},${escapeCSV(card.tags)}\n`;
  }
  
  return csv;
}

function buildBack(row) {
  let parts = [];

  // Add correction if exists
  if (row.correction) {
    parts.push(`<b>✅ Correct:</b><br>${escapeHTML(row.correction)}`);
  }

  // Add refine if exists
  if (row.refine) {
    parts.push(`<b>✨ Better:</b><br>${escapeHTML(row.refine)}`);
  }

  // Add error explanation
  if (row.explanation) {
    parts.push(`<b>❌ Error:</b><br>${escapeHTML(row.explanation)}`);
  }

  // Add rule if exists
  if (row.rule) {
    parts.push(`<b>📖 Rule:</b><br>${escapeHTML(row.rule).replace(/\n/g, "<br>")}`);
  }

  // Add tip if exists
  if (row.tip) {
    parts.push(`<b>💡 Tip:</b><br>${escapeHTML(row.tip).replace(/\n/g, "<br>")}`);
  }

  return parts.join("<br><br>");
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCSV(str) {
  if (!str) return '""';
  // Wrap in quotes, escape internal quotes by doubling them
  // Keep real newlines as-is (Anki handles them in quoted CSV fields)
  return '"' + str.replace(/"/g, '""') + '"';
}

function sanitizeTag(str) {
  if (!str) return "Unknown";
  // Replace special characters for Anki tags
  return str.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const csv = generateCSV(rows);

// Determine output file path
let outputPath;
if (outputFileName) {
  outputPath = path.isAbsolute(outputFileName)
    ? outputFileName
    : path.join(__dirname, outputFileName);
} else {
  const dateStr = new Date().toISOString().split("T")[0];
  // Use ReportPath from config if available
  if (config.ReportPath) {
    const reportDir = path.isAbsolute(config.ReportPath) ? config.ReportPath : path.join(__dirname, config.ReportPath);
    outputPath = path.join(reportDir, `igt_cards_${dateStr}.csv`);
  } else {
    outputPath = path.join(__dirname, `igt_cards_${dateStr}.csv`);
  }
}

fs.writeFileSync(outputPath, csv, "utf8");

console.log(`✅ Exported ${csv.split("\n").length - 1} cards to: ${outputPath}`);
console.log("Import this file into Anki: File -> Import -> Select CSV file");

db.close();
