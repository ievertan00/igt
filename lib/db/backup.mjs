import fs from "node:fs";
import path from "node:path";

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function backupBeforeMigrations({ db, dbPath, firstMigration, logger = null }) {
  if (!dbPath || !fs.existsSync(dbPath)) return null;
  const backupPath = `${dbPath}.backup-${timestamp()}`;
  await db.backup(backupPath);
  const manifestPath = `${backupPath}.json`;
  const manifest = {
    source: dbPath,
    backup: backupPath,
    firstMigration,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (logger) logger(`[migrations] backup created: ${backupPath}`);
  return { backupPath, manifestPath, firstMigration };
}

export function restoreDatabaseBackup({ backupPath, dbPath }) {
  if (!backupPath || !fs.existsSync(backupPath)) throw new Error(`Backup not found: ${backupPath}`);
  if (!dbPath) throw new Error("Database path is required");
  const currentPath = fs.existsSync(dbPath) ? `${dbPath}.before-restore-${timestamp()}` : null;
  if (currentPath) {
    fs.renameSync(dbPath, currentPath);
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = `${dbPath}${suffix}`;
      if (fs.existsSync(sidecar)) fs.renameSync(sidecar, `${currentPath}${suffix}`);
    }
  }
  fs.copyFileSync(backupPath, dbPath);
  return { restoredPath: dbPath, previousPath: currentPath };
}
