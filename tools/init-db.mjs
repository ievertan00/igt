// First-time DB setup and self-repair for squashed migrations.
// The server applies migrations automatically on boot; run this explicitly
// to set up a fresh database or to repair one with stale migration records.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import configLoader from "../lib/config-loader.mjs";
import { runMigrations } from "../lib/migrations.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const config = configLoader.load();
const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
const migrationsDir = path.join(projectRoot, "migrations");

console.log(`Initializing database: ${resolvedDbPath}`);

const db = new Database(resolvedDbPath);
db.pragma("journal_mode = WAL");

// When migrations are squashed, their numeric IDs are reused with new filenames.
// Old schema_version records for those IDs prevent the new files from running.
// If any expected table is absent, remove those stale IDs so runMigrations
// can re-apply. All current migrations are idempotent (IF NOT EXISTS / INSERT OR IGNORE).
function repairStaleMigrationIds(db) {
  const has = (table) =>
    !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(table);

  if (!has("schema_version")) return 0;
  if (has("status_messages")) return 0;

  const files = fs.readdirSync(migrationsDir).filter((f) => /^\d+_.+\.(sql|mjs)$/.test(f));
  const ids = files.map((f) => parseInt(f.match(/^(\d+)_/)[1], 10));
  const placeholders = ids.map(() => "?").join(", ");
  const { changes } = db
    .prepare(`DELETE FROM schema_version WHERE id IN (${placeholders})`)
    .run(...ids);
  return changes;
}

const staleCleaned = repairStaleMigrationIds(db);
if (staleCleaned > 0) {
  console.log(
    `Detected stale migration records from a pre-squash install — cleared ${staleCleaned} entries for repair.`
  );
}

const ran = await runMigrations(db, migrationsDir, {
  logger: (msg) => console.log(msg),
});

db.close();

if (ran.length === 0 && staleCleaned === 0) {
  console.log("Database already up to date.");
} else {
  console.log(`Applied ${ran.length} migration(s)${ran.length ? `: ${ran.join(", ")}` : ""}.`);
}
