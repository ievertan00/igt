// Diagnostic: orphan-card stats + spot-check that the read-layer filter
// suppresses NULL/empty diagnoses correctly.
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
       SUM(CASE WHEN source_type = 'input' AND source_id IS NULL THEN 1 ELSE 0 END) AS orphan_cards
     FROM srs_cards`
  )
  .get();
console.log("grammar cards:", cardTotals);

// Find an input row whose diagnoses are a mix of empty + non-empty so we can
// confirm the join filter drops the empties without losing the real prose.
const mixed = db
  .prepare(
    `SELECT input_id,
            SUM(CASE WHEN explanation IS NULL OR TRIM(explanation) = '' THEN 1 ELSE 0 END) AS empty_n,
            SUM(CASE WHEN explanation IS NOT NULL AND TRIM(explanation) != '' THEN 1 ELSE 0 END) AS filled_n
       FROM diagnoses
      GROUP BY input_id
     HAVING empty_n > 0 AND filled_n > 0
      LIMIT 3`
  )
  .all();

if (mixed.length === 0) {
  console.log("\nNo inputs found with mixed empty/non-empty diagnoses.");
} else {
  console.log("\nSpot-check inputs with mixed empty + filled diagnoses:");
  for (const m of mixed) {
    const filtered = db
      .prepare(
        `SELECT GROUP_CONCAT(d.explanation, '\n') AS exp
           FROM diagnoses d
          WHERE d.input_id = ?
            AND d.explanation IS NOT NULL
            AND TRIM(d.explanation) != ''`
      )
      .get(m.input_id);
    const unfiltered = db
      .prepare(`SELECT GROUP_CONCAT(d.explanation, '\n') AS exp FROM diagnoses d WHERE d.input_id = ?`)
      .get(m.input_id);
    console.log(`  input ${m.input_id}  empty=${m.empty_n}  filled=${m.filled_n}`);
    console.log(`    unfiltered: ${JSON.stringify((unfiltered.exp || "").slice(0, 120))}`);
    console.log(`    filtered  : ${JSON.stringify((filtered.exp || "").slice(0, 120))}`);
  }
}

db.close();
