// Diagnostic: orphan-card and explanation-coverage stats for the SRS deck.
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new Database(path.join(root, "igt_data.db"), { readonly: true });

const diagTotals = db
  .prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN explanation IS NULL OR TRIM(explanation) = '' THEN 1 ELSE 0 END) AS empty
       FROM diagnoses`
  )
  .get();
console.log("diagnoses table:", diagTotals);

const cardTotals = db
  .prepare(
    `SELECT
       SUM(CASE WHEN source_type = 'input' THEN 1 ELSE 0 END) AS grammar_cards,
       SUM(CASE WHEN source_type = 'input' AND source_id IS NULL THEN 1 ELSE 0 END) AS orphan_cards,
       SUM(CASE WHEN source_type = 'input' AND source_id IS NULL AND due_date <= date('now') THEN 1 ELSE 0 END) AS orphan_due
     FROM srs_cards`
  )
  .get();
console.log("grammar cards:", cardTotals);

db.close();
