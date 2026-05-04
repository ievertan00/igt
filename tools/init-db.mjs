// Thin wrapper around the migration runner. Use this for first-time DB setup;
// the server applies migrations automatically on boot, so this is mainly here
// for explicit invocations and for one-off CLI work.
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import configLoader from "../lib/config-loader.mjs";
import { runMigrations } from "../lib/migrations.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const config = configLoader.load();
const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);

console.log(`Initializing database: ${resolvedDbPath}`);

const db = new Database(resolvedDbPath);
db.pragma("journal_mode = WAL");

const ran = await runMigrations(db, path.join(projectRoot, "migrations"), {
  logger: (msg) => console.log(msg),
});

db.close();

if (ran.length === 0) {
  console.log("Database already up to date.");
} else {
  console.log(`Applied ${ran.length} migration(s): ${ran.join(", ")}`);
}
