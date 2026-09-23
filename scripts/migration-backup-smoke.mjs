import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "../lib/db/migrations.mjs";
import { backupBeforeMigrations, restoreDatabaseBackup } from "../lib/db/backup.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-migration-backup-"));
const dbPath = path.join(root, "igt_data.db");
const migrationDir = path.join(root, "migrations");
fs.mkdirSync(migrationDir);
fs.writeFileSync(path.join(migrationDir, "001_test.sql"), "CREATE TABLE sample (id INTEGER PRIMARY KEY);\n", "utf8");
let db = new Database(dbPath);
try {
  let backup;
  const ran = await runMigrations(db, migrationDir, {
    beforeApply: ({ firstFile }) => backupBeforeMigrations({ db, dbPath, firstMigration: firstFile }),
  });
  backup = fs.readdirSync(root).find((name) => name.includes(".backup-") && name.endsWith(".json"));
  assert.deepEqual(ran, ["001_test.sql"]);
  assert.ok(backup);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, backup), "utf8"));
  assert.equal(manifest.firstMigration, "001_test.sql");
  assert.equal(fs.existsSync(manifest.backup), true);
  db.exec("ALTER TABLE sample ADD COLUMN changed TEXT;");
  db.close();
  db = null;
  const restored = restoreDatabaseBackup({ backupPath: manifest.backup, dbPath });
  assert.equal(restored.restoredPath, dbPath);
  const restoredDb = new Database(dbPath);
  assert.equal(restoredDb.prepare("PRAGMA table_info(sample)").all().some((column) => column.name === "changed"), false);
  restoredDb.close();
  const reopened = new Database(dbPath);
  assert.deepEqual(await runMigrations(reopened, migrationDir), ["001_test.sql"]);
  assert.equal(reopened.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sample'").get()?.name, "sample");
  reopened.close();
  console.log("migration backup smoke ok");
} finally {
  if (db) db.close();
  await new Promise((resolve) => setTimeout(resolve, 250));
  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  } catch (error) {
    if (process.platform !== "win32") throw error;
  }
}
