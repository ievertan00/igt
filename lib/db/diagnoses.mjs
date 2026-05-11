import { getDb } from "./connection.mjs";

export async function insertDiagnoses(inputId, diagnoses) {
  if (!diagnoses || diagnoses.length === 0) return;
  const db = await getDb();
  const stmt = db.prepare(`
    INSERT INTO diagnoses (input_id, error_type, severity, explanation)
    VALUES (?, ?, ?, ?)
  `);
  const tx = db.transaction((rows) => {
    for (const d of rows) stmt.run(inputId, d.error_type, d.severity, d.explanation);
  });
  tx(diagnoses);
}

export async function insertAdvice(inputId, rule, tip) {
  if (!rule && !tip) return;
  const db = await getDb();
  db.prepare(`INSERT INTO advice (input_id, rule, tip) VALUES (?, ?, ?)`)
    .run(inputId, rule, tip);
}
