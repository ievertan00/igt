/**
 * Migration runner. Idempotent — applies any migration whose numeric prefix isn't
 * already in `schema_version`. Files are sorted lexically (so prefixes must be
 * zero-padded). `.sql` runs via db.exec(); `.mjs` exports `up(db)` and is imported.
 *
 * Restore-from-backup replays missing migrations cleanly because the prefix is the
 * source of truth, not the file's content hash.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const __dirname = import.meta.dirname;
const DEFAULT_DIR = path.join(__dirname, "..", "migrations");

function parseId(filename) {
  const m = filename.match(/^(\d+)_/);
  return m ? parseInt(m[1], 10) : null;
}

export async function runMigrations(db, dir = DEFAULT_DIR, { logger = null, beforeApply = null } = {}) {
  if (!fs.existsSync(dir)) return [];

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = new Set(db.prepare("SELECT id FROM schema_version").all().map((r) => r.id));
  const files = fs.readdirSync(dir)
    .filter((f) => /^\d+_.+\.(sql|mjs)$/.test(f))
    .sort();

  const pending = files.filter((file) => {
    const id = parseId(file);
    return id !== null && !applied.has(id);
  });
  if (pending.length > 0 && beforeApply) {
    await beforeApply({ firstFile: pending[0], pendingFiles: pending });
  }

  const ranNow = [];
  let canonicalPracticeBank = null;
  for (const file of files) {
    const id = parseId(file);
    if (id === null || applied.has(id)) continue;

    const fp = path.join(dir, file);
    if (logger) logger(`[migrations] applying ${file}`);

    // Migrations 041–056 transform or publish Practice questions that migration
    // 038 restores from the current full export during a fresh rebuild. If that
    // export already matches byte-for-byte on content and activation, those later
    // transformations are represented in the snapshot; record them without
    // replaying their obsolete intermediate preconditions. Usage counters remain
    // outside the export and are never part of this fast-forward check.
    if (id >= 41 && id <= 56) {
      canonicalPracticeBank ??= await import("../features/practice/canonical-bank.mjs");
      if (canonicalPracticeBank.isCanonicalPracticeBank(db)) {
        db.prepare("INSERT INTO schema_version (id, filename) VALUES (?, ?)").run(id, file);
        ranNow.push(file);
        continue;
      }
    }

    if (file.endsWith(".sql")) {
      const sql = fs.readFileSync(fp, "utf8");
      db.exec(sql);
    } else {
      const mod = await import(pathToFileURL(fp).href);
      if (typeof mod.up !== "function") {
        throw new Error(`Migration ${file} missing exported up(db) function`);
      }
      await mod.up(db);
    }

    db.prepare("INSERT INTO schema_version (id, filename) VALUES (?, ?)").run(id, file);
    ranNow.push(file);
  }

  return ranNow;
}
