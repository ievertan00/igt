// Inspect inputs whose diagnoses table rows all have empty/null explanation.
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new Database(path.join(root, "igt_data.db"), { readonly: true });

const targets = db
  .prepare(
    `SELECT i.id,
            i.original_text,
            i.correction,
            (SELECT COUNT(*) FROM diagnoses d WHERE d.input_id = i.id) AS diag_count
       FROM inputs i
      WHERE EXISTS (
              SELECT 1 FROM diagnoses d
               WHERE d.input_id = i.id
                 AND (d.explanation IS NULL OR TRIM(d.explanation) = '')
            )
      ORDER BY i.id ASC`
  )
  .all();

console.log(`Inputs with at least one empty-explanation diagnosis: ${targets.length}`);

let withCorrection = 0;
let unchanged = 0;
let noCorrection = 0;
for (const t of targets) {
  const orig = (t.original_text || "").trim();
  const corr = (t.correction || "").trim();
  if (!corr) noCorrection++;
  else if (corr === orig) unchanged++;
  else withCorrection++;
}
console.log(`  with usable correction (corr != orig): ${withCorrection}`);
console.log(`  correction == original (nothing to diagnose): ${unchanged}`);
console.log(`  no correction at all: ${noCorrection}`);

console.log("\nSample (first 5):");
for (const t of targets.slice(0, 5)) {
  const orig = (t.original_text || "").trim().slice(0, 70);
  const corr = (t.correction || "").trim().slice(0, 70);
  console.log(`  input ${t.id} · ${t.diag_count} diag row(s)`);
  console.log(`    original  : ${JSON.stringify(orig)}`);
  console.log(`    correction: ${JSON.stringify(corr)}`);
}

db.close();
