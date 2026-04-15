import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// Load config to get database path
const configPath = path.join(projectRoot, "igt_config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const dbPath = config.DbPath || path.join(projectRoot, "igt_data.db");

// Resolve relative path
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);

console.log(`Initializing database: ${resolvedDbPath}`);

const db = new Database(resolvedDbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  -- Session tracking table
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    total_inputs INTEGER DEFAULT 0
  );

  -- User input and AI response table
  CREATE TABLE IF NOT EXISTS inputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    original_text TEXT NOT NULL,
    correction TEXT,
    refine TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  -- Diagnosed errors table
  CREATE TABLE IF NOT EXISTS diagnoses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input_id INTEGER,
    error_type TEXT NOT NULL,
    severity TEXT,
    explanation TEXT,
    FOREIGN KEY (input_id) REFERENCES inputs(id)
  );

  -- Rules and tips advice table
  CREATE TABLE IF NOT EXISTS advice (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input_id INTEGER,
    rule TEXT,
    tip TEXT,
    FOREIGN KEY (input_id) REFERENCES inputs(id)
  );

  -- Create indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_inputs_timestamp ON inputs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_diagnoses_input_id ON diagnoses(input_id);
  CREATE INDEX IF NOT EXISTS idx_diagnoses_error_type ON diagnoses(error_type);
  CREATE INDEX IF NOT EXISTS idx_advice_input_id ON advice(input_id);
`);

console.log("Database initialized successfully!");
console.log("Tables created: sessions, inputs, diagnoses, advice");
console.log("Indexes created for optimal query performance");

db.close();
