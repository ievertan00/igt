// One-shot cleanup: delete diagnoses rows whose explanation is NULL/blank AND
// belong to an inputs row that has no usable correction (correction missing or
// equal to original). These are legacy junk: no way to recover an explanation.
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new Database(path.join(root, "igt_data.db"));
db.pragma("journal_mode = WAL");

const before = db.prepare(`SELECT COUNT(*) AS n FROM diagnoses`).get().n;
const stale = db
  .prepare(
    `SELECT COUNT(*) AS n FROM diagnoses
      WHERE (explanation IS NULL OR TRIM(explanation) = '')
        AND input_id IN (
          SELECT id FROM inputs
           WHERE correction IS NULL
              OR TRIM(correction) = ''
              OR TRIM(correction) = TRIM(original_text)
        )`
  )
  .get().n;
console.log(`Before: total=${before}, stale-to-delete=${stale}`);

const res = db
  .prepare(
    `DELETE FROM diagnoses
      WHERE (explanation IS NULL OR TRIM(explanation) = '')
        AND input_id IN (
          SELECT id FROM inputs
           WHERE correction IS NULL
              OR TRIM(correction) = ''
              OR TRIM(correction) = TRIM(original_text)
        )`
  )
  .run();
console.log(`Deleted: ${res.changes} row(s)`);

const after = db.prepare(`SELECT COUNT(*) AS n FROM diagnoses`).get().n;
const remainingEmpty = db
  .prepare(`SELECT COUNT(*) AS n FROM diagnoses WHERE explanation IS NULL OR TRIM(explanation) = ''`)
  .get().n;
console.log(`After:  total=${after}, remaining-empty=${remainingEmpty}`);

db.close();
